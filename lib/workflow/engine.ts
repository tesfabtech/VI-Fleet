import "server-only";

import { prisma } from "@/lib/prisma";
import {
  evaluateApproverEligibility,
  getEligibleApproverIdsForStage,
} from "./eligibility";
import {
  ApproverEligibilityError,
  DuplicateDecisionError,
  MandatoryStageCannotBeSkippedError,
  SelfApprovalProhibitedError,
  StageNotActiveError,
  UnauthorizedWorkflowActionError,
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "./errors";
import type {
  CancelWorkflowInput,
  RecordDecisionInput,
  ResubmitWorkflowInput,
  SkipOptionalStageInput,
  StartWorkflowInstanceInput,
} from "./types";

/**
 * Starts a new workflow instance for a business entity.
 * - Resolves the current published workflow version.
 * - Binds the instance to this exact immutable version.
 * - Initializes the first stage instance in IN_PROGRESS status.
 * - Records audit events.
 */
export async function startWorkflowInstance(input: StartWorkflowInstanceInput) {
  const {
    organizationId,
    workflowType,
    entityType,
    entityId,
    requesterId,
    departmentId,
  } = input;

  if (!workflowType) {
    throw new WorkflowValidationError("Workflow type is required.");
  }
  if (!entityType || !entityId) {
    throw new WorkflowValidationError("Entity type and entity ID are required.");
  }
  if (!requesterId) {
    throw new WorkflowValidationError("Requester ID is required.");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Verify requester belongs to organization and is active
    const requester = await tx.user.findFirst({
      where: { id: requesterId, organizationId, deletedAt: null },
    });
    if (!requester || requester.status !== "ACTIVE") {
      throw new WorkflowValidationError(
        "Requester not found or not active in the organization.",
      );
    }

    // 2. Verify department if provided
    if (departmentId) {
      const dept = await tx.department.findFirst({
        where: { id: departmentId, organizationId, deletedAt: null },
      });
      if (!dept || dept.status !== "ACTIVE") {
        throw new WorkflowValidationError(
          "Department not found or not active in the organization.",
        );
      }
    }

    // 3. Find active workflow for this workflowType
    const workflow = await tx.approvalWorkflow.findFirst({
      where: {
        organizationId,
        workflowType,
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        currentVersion: {
          include: {
            stages: {
              orderBy: { stageOrder: "asc" },
            },
          },
        },
      },
    });

    if (!workflow) {
      throw new WorkflowNotFoundError(
        `No active approval workflow found for process "${workflowType}".`,
      );
    }

    if (!workflow.currentVersionId || !workflow.currentVersion) {
      throw new WorkflowValidationError(
        `Approval workflow "${workflow.name}" has no published version.`,
      );
    }

    const version = workflow.currentVersion;
    if (version.status !== "PUBLISHED") {
      throw new WorkflowValidationError(
        `Current workflow version (v${version.versionNumber}) is not published.`,
      );
    }

    if (version.stages.length === 0) {
      throw new WorkflowValidationError(
        `Published workflow version (v${version.versionNumber}) has no configured stages.`,
      );
    }

    const firstStage = version.stages[0];

    // 4. Create workflow instance
    const instance = await tx.approvalWorkflowInstance.create({
      data: {
        organizationId,
        workflowId: workflow.id,
        workflowVersionId: version.id,
        entityType,
        entityId,
        departmentId: departmentId ?? null,
        requesterId,
        currentStageId: firstStage.id,
        status: "IN_PROGRESS",
      },
    });

    // 5. Create initial stage instance
    const stageInstance = await tx.approvalStageInstance.create({
      data: {
        organizationId,
        instanceId: instance.id,
        stageId: firstStage.id,
        stageOrder: firstStage.stageOrder,
        iteration: 1,
        status: "IN_PROGRESS",
      },
    });

    // 6. Record audit events
    await tx.approvalWorkflowEvent.create({
      data: {
        organizationId,
        instanceId: instance.id,
        eventType: "INSTANCE_STARTED",
        actorId: requesterId,
        toStatus: "IN_PROGRESS",
        details: {
          workflowId: workflow.id,
          versionNumber: version.versionNumber,
          entityType,
          entityId,
          departmentId: departmentId ?? null,
        },
      },
    });

    await tx.approvalWorkflowEvent.create({
      data: {
        organizationId,
        instanceId: instance.id,
        stageInstanceId: stageInstance.id,
        eventType: "STAGE_ENTERED",
        actorId: requesterId,
        toStatus: "IN_PROGRESS",
        details: {
          stageId: firstStage.id,
          stageName: firstStage.name,
          stageOrder: firstStage.stageOrder,
        },
      },
    });

    return {
      instance,
      stageInstance,
      firstStage,
    };
  });
}

/**
 * Retrieves the comprehensive state of a workflow instance.
 */
export async function getWorkflowInstanceState(params: {
  organizationId: string;
  instanceId: string;
}) {
  const { organizationId, instanceId } = params;

  const instance = await prisma.approvalWorkflowInstance.findFirst({
    where: { id: instanceId, organizationId },
    include: {
      workflow: { select: { id: true, name: true, workflowType: true } },
      workflowVersion: {
        select: {
          id: true,
          versionNumber: true,
          status: true,
          stages: {
            orderBy: { stageOrder: "asc" },
            include: {
              approvers: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true, email: true } },
                  role: { select: { id: true, name: true, slug: true } },
                },
              },
            },
          },
        },
      },
      department: { select: { id: true, name: true } },
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      cancelledBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      stageInstances: {
        orderBy: [{ stageOrder: "asc" }, { iteration: "asc" }],
        include: {
          stage: true,
          decisions: {
            include: {
              approver: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  if (!instance) {
    throw new WorkflowNotFoundError("Workflow instance not found.");
  }

  // Identify current active stage instance
  const activeStageInstance = instance.stageInstances.find(
    (si) => si.status === "IN_PROGRESS",
  );

  let eligibleApproverIds: string[] = [];
  if (activeStageInstance) {
    eligibleApproverIds = await getEligibleApproverIdsForStage({
      organizationId,
      stageId: activeStageInstance.stageId,
      requesterId: instance.requesterId,
      departmentId: instance.departmentId,
    });
  }

  return {
    instance,
    activeStageInstance: activeStageInstance ?? null,
    eligibleApproverIds,
  };
}

/**
 * Helper to advance a workflow instance to the next stage or complete it.
 * Must be executed within an active Prisma transaction.
 */
async function advanceWorkflowOrComplete(params: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  organizationId: string;
  instanceId: string;
  currentStageOrder: number;
  actorId: string;
}) {
  const { tx, organizationId, instanceId, currentStageOrder, actorId } = params;

  const instance = await tx.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: instanceId },
    include: {
      workflowVersion: {
        include: {
          stages: { orderBy: { stageOrder: "asc" } },
        },
      },
    },
  });

  const nextStage = instance.workflowVersion.stages.find(
    (s) => s.stageOrder > currentStageOrder,
  );

  const now = new Date();

  if (!nextStage) {
    // All stages completed: workflow approved!
    const updatedInstance = await tx.approvalWorkflowInstance.update({
      where: { id: instanceId },
      data: {
        status: "APPROVED",
        completedAt: now,
        currentStageId: null,
      },
    });

    await tx.approvalWorkflowEvent.create({
      data: {
        organizationId,
        instanceId,
        eventType: "INSTANCE_APPROVED",
        actorId,
        fromStatus: "IN_PROGRESS",
        toStatus: "APPROVED",
        details: { completedAt: now.toISOString() },
      },
    });

    return {
      outcome: "WORKFLOW_APPROVED" as const,
      instance: updatedInstance,
      nextStageInstance: null,
    };
  }

  // Advance to next stage
  const updatedInstance = await tx.approvalWorkflowInstance.update({
    where: { id: instanceId },
    data: {
      currentStageId: nextStage.id,
    },
  });

  const nextStageInstance = await tx.approvalStageInstance.create({
    data: {
      organizationId,
      instanceId,
      stageId: nextStage.id,
      stageOrder: nextStage.stageOrder,
      iteration: 1,
      status: "IN_PROGRESS",
      enteredAt: now,
    },
  });

  await tx.approvalWorkflowEvent.create({
    data: {
      organizationId,
      instanceId,
      stageInstanceId: nextStageInstance.id,
      eventType: "STAGE_ENTERED",
      actorId,
      fromStatus: "IN_PROGRESS",
      toStatus: "IN_PROGRESS",
      details: {
        stageId: nextStage.id,
        stageName: nextStage.name,
        stageOrder: nextStage.stageOrder,
      },
    },
  });

  return {
    outcome: "STAGE_ADVANCED" as const,
    instance: updatedInstance,
    nextStageInstance,
  };
}

/**
 * Records an approval decision for an active stage instance.
 *
 * Enforces:
 * - Transactional isolation and concurrency safety.
 * - Instance and stage must be IN_PROGRESS.
 * - Self-approval prevention.
 * - Server-side approver eligibility evaluation.
 * - Duplicate decision prevention (one decision per approver per stage iteration).
 * - Decision policies:
 *   - REJECT: Immediately terminates the workflow.
 *   - REQUEST_CHANGES: Pauses workflow and returns it to requester.
 *   - APPROVE with ANY_ONE: First valid approval completes stage and advances.
 *   - APPROVE with ALL: Completes stage only when all required eligible approvers have approved.
 */
export async function recordApprovalDecision(input: RecordDecisionInput) {
  const {
    organizationId,
    instanceId,
    approverId,
    decisionType,
    comment,
  } = input;

  if (decisionType === "REJECT" || decisionType === "REQUEST_CHANGES") {
    if (!comment || comment.trim().length < 3) {
      throw new WorkflowValidationError(
        `A comment of at least 3 characters is required when choosing ${decisionType}.`,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    // 1. Load instance and active stage instance with row lock consideration
    const instance = await tx.approvalWorkflowInstance.findFirst({
      where: { id: instanceId, organizationId },
      include: {
        workflowVersion: {
          include: {
            stages: {
              include: { approvers: true },
            },
          },
        },
        stageInstances: {
          where: { status: "IN_PROGRESS" },
          orderBy: [{ stageOrder: "desc" }, { iteration: "desc" }],
          take: 1,
          include: { stage: true },
        },
      },
    });

    if (!instance) {
      throw new WorkflowNotFoundError("Workflow instance not found.");
    }

    if (instance.status !== "IN_PROGRESS") {
      throw new StageNotActiveError(
        `Cannot record decision on a workflow with status "${instance.status}". Decisions can only be recorded on IN_PROGRESS workflows.`,
      );
    }

    const activeStageInstance = instance.stageInstances[0];
    if (!activeStageInstance || activeStageInstance.status !== "IN_PROGRESS") {
      throw new StageNotActiveError(
        "No active stage instance found for this workflow.",
      );
    }

    const currentStage = activeStageInstance.stage;

    // 2. Self-approval check
    if (approverId === instance.requesterId) {
      throw new SelfApprovalProhibitedError(
        "Requesters are prohibited from approving their own workflow requests.",
      );
    }

    // 3. Server-side approver eligibility check
    const eligibility = await evaluateApproverEligibility({
      organizationId,
      stageId: currentStage.id,
      userId: approverId,
      requesterId: instance.requesterId,
      departmentId: instance.departmentId,
      tx,
    });

    if (!eligibility.eligible) {
      throw new ApproverEligibilityError(
        eligibility.reason ?? "User is not authorized to approve this stage.",
      );
    }

    // 4. Duplicate decision prevention
    const existingDecision = await tx.approvalDecision.findUnique({
      where: {
        stageInstanceId_approverId: {
          stageInstanceId: activeStageInstance.id,
          approverId,
        },
      },
    });

    if (existingDecision) {
      throw new DuplicateDecisionError(
        "Approver has already recorded a decision for this stage iteration.",
      );
    }

    const now = new Date();

    // 5. Create decision record
    const decision = await tx.approvalDecision.create({
      data: {
        organizationId,
        instanceId,
        stageInstanceId: activeStageInstance.id,
        approverId,
        decisionType,
        comment: comment?.trim() ?? null,
        decidedAt: now,
      },
    });

    // Record decision audit event
    await tx.approvalWorkflowEvent.create({
      data: {
        organizationId,
        instanceId,
        stageInstanceId: activeStageInstance.id,
        eventType: "DECISION_RECORDED",
        actorId: approverId,
        fromStatus: "IN_PROGRESS",
        toStatus: "IN_PROGRESS",
        details: {
          decisionId: decision.id,
          decisionType,
          comment: comment?.trim() ?? null,
        },
      },
    });

    // 6. Handle decision logic
    if (decisionType === "REJECT") {
      // Conditionally update active stage instance to guarantee concurrency safety
      const affectedStage = await tx.approvalStageInstance.updateMany({
        where: { id: activeStageInstance.id, status: "IN_PROGRESS" },
        data: {
          status: "REJECTED",
          completedAt: now,
          decisionSummary: `Rejected: ${comment?.trim()}`,
        },
      });

      if (affectedStage.count === 0) {
        throw new StageNotActiveError(
          "Stage is no longer active for decisions.",
        );
      }

      // Mark workflow instance REJECTED
      const updatedInstance = await tx.approvalWorkflowInstance.update({
        where: { id: instanceId },
        data: {
          status: "REJECTED",
          completedAt: now,
          currentStageId: null,
        },
      });

      await tx.approvalWorkflowEvent.create({
        data: {
          organizationId,
          instanceId,
          stageInstanceId: activeStageInstance.id,
          eventType: "INSTANCE_REJECTED",
          actorId: approverId,
          fromStatus: "IN_PROGRESS",
          toStatus: "REJECTED",
          details: { reason: comment?.trim() },
        },
      });

      const updatedStageInstance = await tx.approvalStageInstance.findUniqueOrThrow({
        where: { id: activeStageInstance.id },
      });

      return {
        outcome: "REJECTED" as const,
        decision,
        stageInstance: updatedStageInstance,
        instance: updatedInstance,
      };
    }

    if (decisionType === "REQUEST_CHANGES") {
      // Conditionally update active stage instance to guarantee concurrency safety
      const affectedStage = await tx.approvalStageInstance.updateMany({
        where: { id: activeStageInstance.id, status: "IN_PROGRESS" },
        data: {
          status: "CHANGES_REQUESTED",
          decisionSummary: `Changes requested: ${comment?.trim()}`,
        },
      });

      if (affectedStage.count === 0) {
        throw new StageNotActiveError(
          "Stage is no longer active for decisions.",
        );
      }

      // Mark workflow instance CHANGES_REQUESTED
      const updatedInstance = await tx.approvalWorkflowInstance.update({
        where: { id: instanceId },
        data: {
          status: "CHANGES_REQUESTED",
        },
      });

      await tx.approvalWorkflowEvent.create({
        data: {
          organizationId,
          instanceId,
          stageInstanceId: activeStageInstance.id,
          eventType: "CHANGES_REQUESTED",
          actorId: approverId,
          fromStatus: "IN_PROGRESS",
          toStatus: "CHANGES_REQUESTED",
          details: { reason: comment?.trim() },
        },
      });

      const updatedStageInstance = await tx.approvalStageInstance.findUniqueOrThrow({
        where: { id: activeStageInstance.id },
      });

      return {
        outcome: "CHANGES_REQUESTED" as const,
        decision,
        stageInstance: updatedStageInstance,
        instance: updatedInstance,
      };
    }

    if (decisionType === "APPROVE") {
      if (currentStage.approvalPolicy === "ANY_ONE") {
        // ANY_ONE: Conditionally update stage instance to guarantee atomic first-approver win
        const affectedStage = await tx.approvalStageInstance.updateMany({
          where: { id: activeStageInstance.id, status: "IN_PROGRESS" },
          data: {
            status: "APPROVED",
            completedAt: now,
            decisionSummary: `Approved by ${approverId}`,
          },
        });

        if (affectedStage.count === 0) {
          throw new StageNotActiveError(
            "Stage was already completed by another concurrent decision.",
          );
        }

        await tx.approvalWorkflowEvent.create({
          data: {
            organizationId,
            instanceId,
            stageInstanceId: activeStageInstance.id,
            eventType: "STAGE_COMPLETED",
            actorId: approverId,
            fromStatus: "IN_PROGRESS",
            toStatus: "APPROVED",
            details: { policy: "ANY_ONE", approvedBy: approverId },
          },
        });

        const advanceResult = await advanceWorkflowOrComplete({
          tx,
          organizationId,
          instanceId,
          currentStageOrder: activeStageInstance.stageOrder,
          actorId: approverId,
        });

        return {
          outcome: advanceResult.outcome,
          decision,
          instance: advanceResult.instance,
          nextStageInstance: advanceResult.nextStageInstance,
        };
      }

      if (currentStage.approvalPolicy === "ALL") {
        // ALL: Every required eligible approver must approve
        const requiredApproverIds = await getEligibleApproverIdsForStage({
          organizationId,
          stageId: currentStage.id,
          requesterId: instance.requesterId,
          departmentId: instance.departmentId,
          tx,
        });

        // Query all APPROVE decisions recorded for this stage instance
        const allApproveDecisions = await tx.approvalDecision.findMany({
          where: {
            stageInstanceId: activeStageInstance.id,
            decisionType: "APPROVE",
          },
          select: { approverId: true },
        });

        const approvedUserIds = new Set(allApproveDecisions.map((d) => d.approverId));
        // Add the current decision's approver
        approvedUserIds.add(approverId);

        const pendingApproverIds = requiredApproverIds.filter(
          (id) => !approvedUserIds.has(id),
        );

        if (pendingApproverIds.length > 0) {
          // Stage remains IN_PROGRESS awaiting remaining approvers
          return {
            outcome: "DECISION_RECORDED" as const,
            decision,
            stageInstance: activeStageInstance,
            pendingApproverIds,
          };
        }

        // All required approvers have approved!
        const affectedStage = await tx.approvalStageInstance.updateMany({
          where: { id: activeStageInstance.id, status: "IN_PROGRESS" },
          data: {
            status: "APPROVED",
            completedAt: now,
            decisionSummary: `Approved by all ${requiredApproverIds.length} required approvers`,
          },
        });

        if (affectedStage.count === 0) {
          throw new StageNotActiveError(
            "Stage was already completed by another concurrent decision.",
          );
        }

        await tx.approvalWorkflowEvent.create({
          data: {
            organizationId,
            instanceId,
            stageInstanceId: activeStageInstance.id,
            eventType: "STAGE_COMPLETED",
            actorId: approverId,
            fromStatus: "IN_PROGRESS",
            toStatus: "APPROVED",
            details: {
              policy: "ALL",
              totalApprovers: requiredApproverIds.length,
            },
          },
        });

        const advanceResult = await advanceWorkflowOrComplete({
          tx,
          organizationId,
          instanceId,
          currentStageOrder: activeStageInstance.stageOrder,
          actorId: approverId,
        });

        return {
          outcome: advanceResult.outcome,
          decision,
          instance: advanceResult.instance,
          nextStageInstance: advanceResult.nextStageInstance,
        };
      }
    }

    throw new WorkflowValidationError(`Unsupported decision type "${decisionType}".`);
  });
}

/**
 * Skips an optional stage through an explicit engine operation.
 * - Stage MUST be configured as isOptional = true.
 * - Records who skipped it, when, and why.
 * - Mandatory stages cannot be skipped.
 */
export async function skipOptionalStage(input: SkipOptionalStageInput) {
  const { organizationId, instanceId, actorId, reason } = input;

  if (!reason || reason.trim().length < 3) {
    throw new WorkflowValidationError(
      "A reason of at least 3 characters is required to skip an optional stage.",
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Verify actor exists and is active
    const actor = await tx.user.findFirst({
      where: { id: actorId, organizationId, deletedAt: null },
    });
    if (!actor || actor.status !== "ACTIVE") {
      throw new WorkflowValidationError("Actor not found or not active in the organization.");
    }

    // 2. Load instance and active stage
    const instance = await tx.approvalWorkflowInstance.findFirst({
      where: { id: instanceId, organizationId },
      include: {
        stageInstances: {
          where: { status: "IN_PROGRESS" },
          orderBy: [{ stageOrder: "desc" }, { iteration: "desc" }],
          take: 1,
          include: { stage: true },
        },
      },
    });

    if (!instance) {
      throw new WorkflowNotFoundError("Workflow instance not found.");
    }

    if (instance.status !== "IN_PROGRESS") {
      throw new StageNotActiveError(
        `Cannot skip stage on a workflow with status "${instance.status}".`,
      );
    }

    const activeStageInstance = instance.stageInstances[0];
    if (!activeStageInstance || activeStageInstance.status !== "IN_PROGRESS") {
      throw new StageNotActiveError("No active stage instance found.");
    }

    const stage = activeStageInstance.stage;

    // 3. Mandatory stage check: Only optional stages can be skipped
    if (!stage.isOptional) {
      throw new MandatoryStageCannotBeSkippedError(
        `Stage "${stage.name}" is mandatory and cannot be skipped.`,
      );
    }

    const now = new Date();

    // 4. Mark stage instance as SKIPPED
    await tx.approvalStageInstance.update({
      where: { id: activeStageInstance.id },
      data: {
        status: "SKIPPED",
        completedAt: now,
        decisionSummary: `Skipped by ${actorId}: ${reason.trim()}`,
      },
    });

    // 5. Record skip decision and audit events
    const decision = await tx.approvalDecision.create({
      data: {
        organizationId,
        instanceId,
        stageInstanceId: activeStageInstance.id,
        approverId: actorId,
        decisionType: "SKIP",
        comment: reason.trim(),
        decidedAt: now,
      },
    });

    await tx.approvalWorkflowEvent.create({
      data: {
        organizationId,
        instanceId,
        stageInstanceId: activeStageInstance.id,
        eventType: "STAGE_SKIPPED",
        actorId,
        fromStatus: "IN_PROGRESS",
        toStatus: "SKIPPED",
        details: {
          skippedStageId: stage.id,
          stageName: stage.name,
          reason: reason.trim(),
        },
      },
    });

    // 6. Advance to next stage or complete workflow
    const advanceResult = await advanceWorkflowOrComplete({
      tx,
      organizationId,
      instanceId,
      currentStageOrder: activeStageInstance.stageOrder,
      actorId,
    });

    return {
      outcome: advanceResult.outcome,
      decision,
      instance: advanceResult.instance,
      nextStageInstance: advanceResult.nextStageInstance,
    };
  });
}

/**
 * Resubmits a workflow request that has had changes requested.
 * - Transitions workflow back to IN_PROGRESS.
 * - Creates a new iteration of the stage where changes were requested.
 * - Records audit event.
 */
export async function resubmitWorkflowInstance(input: ResubmitWorkflowInput) {
  const { organizationId, instanceId, requesterId, comment } = input;

  return prisma.$transaction(async (tx) => {
    const instance = await tx.approvalWorkflowInstance.findFirst({
      where: { id: instanceId, organizationId },
      include: {
        stageInstances: {
          orderBy: [{ stageOrder: "desc" }, { iteration: "desc" }],
          take: 1,
          include: { stage: true },
        },
      },
    });

    if (!instance) {
      throw new WorkflowNotFoundError("Workflow instance not found.");
    }

    if (instance.status !== "CHANGES_REQUESTED") {
      throw new StageNotActiveError(
        `Cannot resubmit a workflow with status "${instance.status}". Workflow must be in CHANGES_REQUESTED status.`,
      );
    }

    // Only the requester (or authorized admin) can resubmit
    if (requesterId !== instance.requesterId) {
      throw new UnauthorizedWorkflowActionError(
        "Only the original requester may resubmit corrected requests.",
      );
    }

    const lastStageInstance = instance.stageInstances[0];
    if (!lastStageInstance) {
      throw new StageNotActiveError("No stage instance found to resume.");
    }

    const now = new Date();
    const nextIteration = lastStageInstance.iteration + 1;

    // Conditionally update workflow instance to guarantee concurrency safety
    const affected = await tx.approvalWorkflowInstance.updateMany({
      where: { id: instanceId, status: "CHANGES_REQUESTED" },
      data: {
        status: "IN_PROGRESS",
        currentStageId: lastStageInstance.stageId,
      },
    });

    if (affected.count !== 1) {
      throw new StageNotActiveError(
        "Workflow instance is no longer in CHANGES_REQUESTED status.",
      );
    }

    // Create fresh stage instance iteration
    const newStageInstance = await tx.approvalStageInstance.create({
      data: {
        organizationId,
        instanceId,
        stageId: lastStageInstance.stageId,
        stageOrder: lastStageInstance.stageOrder,
        iteration: nextIteration,
        status: "IN_PROGRESS",
        enteredAt: now,
      },
    });

    // Fetch updated instance
    const updatedInstance = await tx.approvalWorkflowInstance.findUniqueOrThrow({
      where: { id: instanceId },
    });

    await tx.approvalWorkflowEvent.create({
      data: {
        organizationId,
        instanceId,
        stageInstanceId: newStageInstance.id,
        eventType: "REQUEST_RESUBMITTED",
        actorId: requesterId,
        fromStatus: "CHANGES_REQUESTED",
        toStatus: "IN_PROGRESS",
        details: {
          iteration: nextIteration,
          comment: comment?.trim() ?? null,
        },
      },
    });

    return {
      instance: updatedInstance,
      stageInstance: newStageInstance,
    };
  });
}

/**
 * Cancels an in-flight workflow instance when permitted.
 */
export async function cancelWorkflowInstance(input: CancelWorkflowInput) {
  const { organizationId, instanceId, actorId, reason } = input;

  if (!reason || reason.trim().length < 3) {
    throw new WorkflowValidationError(
      "A cancellation reason of at least 3 characters is required.",
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Verify actor
    const actor = await tx.user.findFirst({
      where: { id: actorId, organizationId, deletedAt: null },
    });
    if (!actor || actor.status !== "ACTIVE") {
      throw new WorkflowValidationError("Actor not found or not active in the organization.");
    }

    // 2. Load instance
    const instance = await tx.approvalWorkflowInstance.findFirst({
      where: { id: instanceId, organizationId },
      include: {
        stageInstances: {
          where: { status: "IN_PROGRESS" },
        },
      },
    });

    if (!instance) {
      throw new WorkflowNotFoundError("Workflow instance not found.");
    }

    if (
      instance.status === "APPROVED" ||
      instance.status === "REJECTED" ||
      instance.status === "CANCELLED"
    ) {
      throw new StageNotActiveError(
        `Cannot cancel workflow instance in terminal status "${instance.status}".`,
      );
    }

    const now = new Date();

    // 3. Cancel any currently active stage instance
    for (const activeStage of instance.stageInstances) {
      await tx.approvalStageInstance.update({
        where: { id: activeStage.id },
        data: {
          status: "REJECTED", // or terminal
          completedAt: now,
          decisionSummary: `Workflow cancelled: ${reason.trim()}`,
        },
      });
    }

    // 4. Update workflow instance
    const updatedInstance = await tx.approvalWorkflowInstance.update({
      where: { id: instanceId },
      data: {
        status: "CANCELLED",
        completedAt: now,
        cancelledById: actorId,
        cancelledAt: now,
        cancellationReason: reason.trim(),
        currentStageId: null,
      },
    });

    // 5. Audit event
    await tx.approvalWorkflowEvent.create({
      data: {
        organizationId,
        instanceId,
        eventType: "INSTANCE_CANCELLED",
        actorId,
        fromStatus: instance.status,
        toStatus: "CANCELLED",
        details: { reason: reason.trim() },
      },
    });

    return updatedInstance;
  });
}

/**
 * Retrieves the full audit history of events for a workflow instance.
 */
export async function getWorkflowHistory(params: {
  organizationId: string;
  instanceId: string;
}) {
  const { organizationId, instanceId } = params;

  return prisma.approvalWorkflowEvent.findMany({
    where: { instanceId, organizationId },
    orderBy: { createdAt: "asc" },
    include: {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      stageInstance: {
        select: {
          id: true,
          stageOrder: true,
          iteration: true,
          stage: { select: { name: true } },
        },
      },
    },
  });
}
