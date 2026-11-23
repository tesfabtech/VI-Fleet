import "server-only";

import { prisma } from "@/lib/prisma";
import { isPlatformOnlyPermission } from "@/lib/rbac";
import {
  WorkflowImmutableError,
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "./errors";
import type {
  AddStageInput,
  CreateDraftFromVersionInput,
  CreateWorkflowDraftInput,
  PublishVersionInput,
  ReorderStagesInput,
  UpdateStageInput,
  WorkflowValidationResult,
} from "./types";

/**
 * Creates a new ApprovalWorkflow along with its initial draft version (version 1).
 */
export async function createWorkflowDraft(input: CreateWorkflowDraftInput) {
  const { organizationId, name, description, workflowType, createdById } = input;

  if (!name || name.trim().length === 0) {
    throw new WorkflowValidationError("Workflow name is required.");
  }
  if (!workflowType || workflowType.trim().length === 0) {
    throw new WorkflowValidationError("Workflow type is required.");
  }

  return prisma.$transaction(async (tx) => {
    // Verify creator if provided
    if (createdById) {
      const creator = await tx.user.findFirst({
        where: { id: createdById, organizationId, deletedAt: null },
      });
      if (!creator) {
        throw new WorkflowNotFoundError("Creator user not found in organization.");
      }
    }

    const workflow = await tx.approvalWorkflow.create({
      data: {
        organizationId,
        name: name.trim(),
        description: description?.trim() ?? null,
        workflowType: workflowType.trim(),
        status: "ACTIVE",
        createdById: createdById ?? null,
      },
    });

    const version = await tx.approvalWorkflowVersion.create({
      data: {
        organizationId,
        workflowId: workflow.id,
        versionNumber: 1,
        status: "DRAFT",
      },
    });

    return { workflow, version };
  });
}

/**
 * Adds an approval stage to a draft workflow version.
 */
export async function addStageToDraft(input: AddStageInput) {
  const {
    organizationId,
    versionId,
    name,
    description,
    stageOrder,
    isOptional = false,
    approvalPolicy = "ANY_ONE",
    requiredPermissionCode,
    approvers,
  } = input;

  if (!name || name.trim().length === 0) {
    throw new WorkflowValidationError("Stage name is required.");
  }

  if (!approvers || approvers.length === 0) {
    throw new WorkflowValidationError("At least one approver (user or role) is required for each stage.");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Verify version exists and is in DRAFT status
    const version = await tx.approvalWorkflowVersion.findFirst({
      where: { id: versionId, organizationId },
      include: { stages: { orderBy: { stageOrder: "asc" } } },
    });

    if (!version) {
      throw new WorkflowNotFoundError("Workflow version not found.");
    }

    if (version.status !== "DRAFT") {
      throw new WorkflowImmutableError(
        `Cannot add stages to a ${version.status.toLowerCase()} workflow version.`,
      );
    }

    // 2. Validate permission code if specified
    if (requiredPermissionCode) {
      if (isPlatformOnlyPermission(requiredPermissionCode)) {
        throw new WorkflowValidationError(
          `Permission "${requiredPermissionCode}" is platform-only and cannot be required for organization workflows.`,
        );
      }
      const perm = await tx.permission.findUnique({
        where: { code: requiredPermissionCode },
      });
      if (!perm || perm.isPlatformOnly) {
        throw new WorkflowValidationError(
          `Invalid permission code "${requiredPermissionCode}". Permission does not exist in the catalog.`,
        );
      }
    }

    // 3. Determine stage order
    let computedOrder: number;
    if (typeof stageOrder === "number" && stageOrder > 0) {
      computedOrder = stageOrder;
    } else {
      const maxOrder = version.stages.reduce(
        (max, s) => (s.stageOrder > max ? s.stageOrder : max),
        0,
      );
      computedOrder = maxOrder + 1;
    }

    // 4. Validate approvers
    for (const approver of approvers) {
      if (approver.approverType === "USER") {
        if (!approver.userId) {
          throw new WorkflowValidationError("User approver must have a valid userId.");
        }
        const user = await tx.user.findFirst({
          where: { id: approver.userId, organizationId, deletedAt: null },
        });
        if (!user) {
          throw new WorkflowValidationError(
            `Approver user "${approver.userId}" not found in organization.`,
          );
        }
        if (user.role === "SYSTEM_ADMINISTRATOR") {
          throw new WorkflowValidationError(
            "System administrators cannot be configured as organization stage approvers.",
          );
        }
      } else if (approver.approverType === "ROLE") {
        if (!approver.roleId) {
          throw new WorkflowValidationError("Role approver must have a valid roleId.");
        }
        const role = await tx.organizationRole.findFirst({
          where: { id: approver.roleId, organizationId, deletedAt: null },
        });
        if (!role) {
          throw new WorkflowValidationError(
            `Approver role "${approver.roleId}" not found in organization.`,
          );
        }
        if (role.status !== "ACTIVE") {
          throw new WorkflowValidationError(
            `Approver role "${role.name}" is inactive and cannot be assigned.`,
          );
        }
      } else {
        throw new WorkflowValidationError(`Invalid approver type "${approver.approverType}".`);
      }
    }

    // 5. Create stage
    const stage = await tx.approvalWorkflowStage.create({
      data: {
        organizationId,
        versionId,
        name: name.trim(),
        description: description?.trim() ?? null,
        stageOrder: computedOrder,
        isOptional,
        approvalPolicy,
        requiredPermissionCode: requiredPermissionCode?.trim() ?? null,
      },
    });

    // 6. Create approvers
    for (const approver of approvers) {
      await tx.approvalStageApprover.create({
        data: {
          organizationId,
          stageId: stage.id,
          approverType: approver.approverType,
          userId: approver.approverType === "USER" ? approver.userId! : null,
          roleId: approver.approverType === "ROLE" ? approver.roleId! : null,
        },
      });
    }

    return tx.approvalWorkflowStage.findUniqueOrThrow({
      where: { id: stage.id },
      include: {
        approvers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            role: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  });
}

/**
 * Updates an existing stage in a draft workflow version.
 */
export async function updateDraftStage(input: UpdateStageInput) {
  const {
    organizationId,
    stageId,
    name,
    description,
    isOptional,
    approvalPolicy,
    requiredPermissionCode,
    approvers,
  } = input;

  return prisma.$transaction(async (tx) => {
    const stage = await tx.approvalWorkflowStage.findFirst({
      where: { id: stageId, organizationId },
      include: { version: true },
    });

    if (!stage) {
      throw new WorkflowNotFoundError("Stage not found.");
    }

    if (stage.version.status !== "DRAFT") {
      throw new WorkflowImmutableError(
        `Cannot update stage of a ${stage.version.status.toLowerCase()} workflow version.`,
      );
    }

    if (name !== undefined && name.trim().length === 0) {
      throw new WorkflowValidationError("Stage name cannot be empty.");
    }

    if (requiredPermissionCode) {
      if (isPlatformOnlyPermission(requiredPermissionCode)) {
        throw new WorkflowValidationError(
          `Permission "${requiredPermissionCode}" is platform-only and cannot be required for organization workflows.`,
        );
      }
      const perm = await tx.permission.findUnique({
        where: { code: requiredPermissionCode },
      });
      if (!perm || perm.isPlatformOnly) {
        throw new WorkflowValidationError(
          `Invalid permission code "${requiredPermissionCode}". Permission does not exist in the catalog.`,
        );
      }
    }

    // Update basic stage fields
    const updatedStage = await tx.approvalWorkflowStage.update({
      where: { id: stageId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() ?? null } : {}),
        ...(isOptional !== undefined ? { isOptional } : {}),
        ...(approvalPolicy !== undefined ? { approvalPolicy } : {}),
        ...(requiredPermissionCode !== undefined
          ? { requiredPermissionCode: requiredPermissionCode?.trim() ?? null }
          : {}),
      },
    });

    // Update approvers if provided
    if (approvers !== undefined) {
      if (approvers.length === 0) {
        throw new WorkflowValidationError("Stage must have at least one approver.");
      }

      // Remove existing approvers
      await tx.approvalStageApprover.deleteMany({
        where: { stageId },
      });

      // Validate and recreate approvers
      for (const approver of approvers) {
        if (approver.approverType === "USER") {
          if (!approver.userId) {
            throw new WorkflowValidationError("User approver must have a valid userId.");
          }
          const user = await tx.user.findFirst({
            where: { id: approver.userId, organizationId, deletedAt: null },
          });
          if (!user) {
            throw new WorkflowValidationError(
              `Approver user "${approver.userId}" not found in organization.`,
            );
          }
          if (user.role === "SYSTEM_ADMINISTRATOR") {
            throw new WorkflowValidationError(
              "System administrators cannot be configured as organization stage approvers.",
            );
          }
        } else if (approver.approverType === "ROLE") {
          if (!approver.roleId) {
            throw new WorkflowValidationError("Role approver must have a valid roleId.");
          }
          const role = await tx.organizationRole.findFirst({
            where: { id: approver.roleId, organizationId, deletedAt: null },
          });
          if (!role) {
            throw new WorkflowValidationError(
              `Approver role "${approver.roleId}" not found in organization.`,
            );
          }
          if (role.status !== "ACTIVE") {
            throw new WorkflowValidationError(
              `Approver role "${role.name}" is inactive and cannot be assigned.`,
            );
          }
        }

        await tx.approvalStageApprover.create({
          data: {
            organizationId,
            stageId: stage.id,
            approverType: approver.approverType,
            userId: approver.approverType === "USER" ? approver.userId! : null,
            roleId: approver.approverType === "ROLE" ? approver.roleId! : null,
          },
        });
      }
    }

    return tx.approvalWorkflowStage.findUniqueOrThrow({
      where: { id: updatedStage.id },
      include: {
        approvers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            role: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  });
}

/**
 * Reorders the stages of a draft workflow version.
 * Ensures stage orders form an explicit consecutive sequence 1..N.
 */
export async function reorderDraftStages(input: ReorderStagesInput) {
  const { organizationId, versionId, stageOrders } = input;

  return prisma.$transaction(async (tx) => {
    const version = await tx.approvalWorkflowVersion.findFirst({
      where: { id: versionId, organizationId },
      include: { stages: true },
    });

    if (!version) {
      throw new WorkflowNotFoundError("Workflow version not found.");
    }

    if (version.status !== "DRAFT") {
      throw new WorkflowImmutableError(
        `Cannot reorder stages of a ${version.status.toLowerCase()} workflow version.`,
      );
    }

    if (stageOrders.length !== version.stages.length) {
      throw new WorkflowValidationError(
        `All ${version.stages.length} stages must be included in the reordering input.`,
      );
    }

    // Verify orders are 1..N
    const orders = stageOrders.map((s) => s.stageOrder).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        throw new WorkflowValidationError(
          "Stage orders must form a consecutive sequence starting from 1 (e.g. 1, 2, 3).",
        );
      }
    }

    // To prevent unique constraint violations on (version_id, stage_order) during swap,
    // temporarily shift stage_order by 100000
    for (const item of stageOrders) {
      await tx.approvalWorkflowStage.update({
        where: { id: item.stageId },
        data: { stageOrder: item.stageOrder + 100000 },
      });
    }

    for (const item of stageOrders) {
      await tx.approvalWorkflowStage.update({
        where: { id: item.stageId },
        data: { stageOrder: item.stageOrder },
      });
    }

    return tx.approvalWorkflowStage.findMany({
      where: { versionId, organizationId },
      orderBy: { stageOrder: "asc" },
      include: { approvers: true },
    });
  });
}

/**
 * Removes a stage from a draft workflow version and re-sequences remaining stages.
 */
export async function removeDraftStage(params: {
  organizationId: string;
  stageId: string;
}) {
  const { organizationId, stageId } = params;

  return prisma.$transaction(async (tx) => {
    const stage = await tx.approvalWorkflowStage.findFirst({
      where: { id: stageId, organizationId },
      include: { version: true },
    });

    if (!stage) {
      throw new WorkflowNotFoundError("Stage not found.");
    }

    if (stage.version.status !== "DRAFT") {
      throw new WorkflowImmutableError(
        `Cannot remove stage from a ${stage.version.status.toLowerCase()} workflow version.`,
      );
    }

    const versionId = stage.versionId;

    // Delete stage (approvers cascade)
    await tx.approvalWorkflowStage.delete({
      where: { id: stageId },
    });

    // Re-sequence remaining stages consecutively 1..N
    const remainingStages = await tx.approvalWorkflowStage.findMany({
      where: { versionId, organizationId },
      orderBy: { stageOrder: "asc" },
    });

    for (let i = 0; i < remainingStages.length; i++) {
      const newOrder = i + 1;
      if (remainingStages[i].stageOrder !== newOrder) {
        await tx.approvalWorkflowStage.update({
          where: { id: remainingStages[i].id },
          data: { stageOrder: newOrder },
        });
      }
    }

    return { removedStageId: stageId };
  });
}

/**
 * Validates a draft workflow version prior to publication.
 */
export async function validateWorkflowDraft(params: {
  organizationId: string;
  versionId: string;
}): Promise<WorkflowValidationResult> {
  const { organizationId, versionId } = params;

  const version = await prisma.approvalWorkflowVersion.findFirst({
    where: { id: versionId, organizationId },
    include: {
      stages: {
        orderBy: { stageOrder: "asc" },
        include: {
          approvers: {
            include: {
              role: true,
              user: true,
            },
          },
        },
      },
    },
  });

  if (!version) {
    return { valid: false, errors: ["Workflow version not found."] };
  }

  const errors: string[] = [];

  if (version.status !== "DRAFT") {
    errors.push(`Workflow version is already ${version.status.toLowerCase()}. Only draft versions can be validated for publication.`);
  }

  if (version.stages.length === 0) {
    errors.push("Workflow must contain at least one approval stage.");
  }

  // Validate consecutive stage ordering
  const orders = version.stages.map((s) => s.stageOrder);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      errors.push(`Stage orders must be consecutive starting from 1. Found order ${orders[i]} at position ${i + 1}.`);
      break;
    }
  }

  // Validate each stage
  for (const stage of version.stages) {
    if (!stage.name || stage.name.trim().length === 0) {
      errors.push(`Stage at order ${stage.stageOrder} must have a name.`);
    }

    if (stage.approvers.length === 0) {
      errors.push(`Stage "${stage.name}" (order ${stage.stageOrder}) must have at least one approver configured.`);
    }

    // Validate required permission code if specified
    if (stage.requiredPermissionCode) {
      if (isPlatformOnlyPermission(stage.requiredPermissionCode)) {
        errors.push(`Stage "${stage.name}" specifies platform-only permission "${stage.requiredPermissionCode}". Platform permissions cannot be used in organization workflows.`);
      }
    }

    // Validate approvers
    for (const approver of stage.approvers) {
      if (approver.approverType === "USER") {
        if (!approver.user || approver.user.status !== "ACTIVE" || approver.user.deletedAt !== null) {
          errors.push(`Stage "${stage.name}" contains an inactive, deleted, or missing approver user (${approver.userId}).`);
        }
      } else if (approver.approverType === "ROLE") {
        if (!approver.role || approver.role.status !== "ACTIVE" || approver.role.deletedAt !== null) {
          errors.push(`Stage "${stage.name}" contains an inactive, deleted, or missing approver role (${approver.roleId}).`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Publishes a draft workflow version.
 * - Validates the draft.
 * - Archives any previously published version of the workflow.
 * - Sets this version to PUBLISHED.
 * - Sets this version as the workflow's currentVersion.
 */
export async function publishWorkflowVersion(input: PublishVersionInput) {
  const { organizationId, versionId, publishedById } = input;

  return prisma.$transaction(async (tx) => {
    // 1. Verify publisher
    const publisher = await tx.user.findFirst({
      where: { id: publishedById, organizationId, deletedAt: null },
    });
    if (!publisher) {
      throw new WorkflowNotFoundError("Publisher user not found in organization.");
    }

    // 2. Load version
    const version = await tx.approvalWorkflowVersion.findFirst({
      where: { id: versionId, organizationId },
      include: {
        workflow: true,
        stages: {
          orderBy: { stageOrder: "asc" },
          include: { approvers: { include: { role: true, user: true } } },
        },
      },
    });

    if (!version) {
      throw new WorkflowNotFoundError("Workflow version not found.");
    }

    if (version.status !== "DRAFT") {
      throw new WorkflowImmutableError(
        `Workflow version is already ${version.status.toLowerCase()}. Only DRAFT versions can be published.`,
      );
    }

    // 3. Validate
    const validation = await validateWorkflowDraft({ organizationId, versionId });
    if (!validation.valid) {
      throw new WorkflowValidationError(
        `Cannot publish invalid workflow: ${validation.errors.join("; ")}`,
        validation.errors,
      );
    }

    const now = new Date();

    // 4. Archive any existing published version for this workflow
    const existingPublished = await tx.approvalWorkflowVersion.findFirst({
      where: {
        organizationId,
        workflowId: version.workflowId,
        status: "PUBLISHED",
      },
    });

    if (existingPublished) {
      await tx.approvalWorkflowVersion.update({
        where: { id: existingPublished.id },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
        },
      });
    }

    // 5. Publish this version
    const publishedVersion = await tx.approvalWorkflowVersion.update({
      where: { id: versionId },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        publishedById,
      },
      include: {
        stages: {
          orderBy: { stageOrder: "asc" },
          include: { approvers: true },
        },
      },
    });

    // 6. Update workflow pointer to this current published version
    await tx.approvalWorkflow.update({
      where: { id: version.workflowId },
      data: {
        currentVersionId: publishedVersion.id,
      },
    });

    return publishedVersion;
  });
}

/**
 * Creates a new draft version from an existing version (or latest published version).
 * Deep-copies all stages and approvers into the new draft version.
 */
export async function createDraftFromVersion(input: CreateDraftFromVersionInput) {
  const { organizationId, workflowId, fromVersionId } = input;

  return prisma.$transaction(async (tx) => {
    // 1. Verify workflow
    const workflow = await tx.approvalWorkflow.findFirst({
      where: { id: workflowId, organizationId, deletedAt: null },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });

    if (!workflow) {
      throw new WorkflowNotFoundError("Workflow not found in organization.");
    }

    // Check if there is already an existing DRAFT version
    const existingDraft = workflow.versions.find((v) => v.status === "DRAFT");
    if (existingDraft) {
      throw new WorkflowValidationError(
        `A draft version (Version ${existingDraft.versionNumber}) already exists for this workflow. Please publish or discard it before creating a new draft.`,
      );
    }

    // 2. Identify source version
    let sourceVersionId = fromVersionId;
    if (!sourceVersionId) {
      sourceVersionId = workflow.currentVersionId ?? workflow.versions[0]?.id;
    }

    if (!sourceVersionId) {
      throw new WorkflowNotFoundError("No source version available to clone.");
    }

    const sourceVersion = await tx.approvalWorkflowVersion.findFirst({
      where: { id: sourceVersionId, organizationId, workflowId },
      include: {
        stages: {
          orderBy: { stageOrder: "asc" },
          include: { approvers: true },
        },
      },
    });

    if (!sourceVersion) {
      throw new WorkflowNotFoundError("Source workflow version not found.");
    }

    // 3. Compute next version number
    const maxVersionNumber = workflow.versions.reduce(
      (max, v) => (v.versionNumber > max ? v.versionNumber : max),
      0,
    );
    const nextVersionNumber = maxVersionNumber + 1;

    // 4. Create new DRAFT version
    const newVersion = await tx.approvalWorkflowVersion.create({
      data: {
        organizationId,
        workflowId,
        versionNumber: nextVersionNumber,
        status: "DRAFT",
      },
    });

    // 5. Deep copy stages and approvers
    for (const sourceStage of sourceVersion.stages) {
      const newStage = await tx.approvalWorkflowStage.create({
        data: {
          organizationId,
          versionId: newVersion.id,
          name: sourceStage.name,
          description: sourceStage.description,
          stageOrder: sourceStage.stageOrder,
          isOptional: sourceStage.isOptional,
          approvalPolicy: sourceStage.approvalPolicy,
          requiredPermissionCode: sourceStage.requiredPermissionCode,
        },
      });

      for (const approver of sourceStage.approvers) {
        await tx.approvalStageApprover.create({
          data: {
            organizationId,
            stageId: newStage.id,
            approverType: approver.approverType,
            userId: approver.userId,
            roleId: approver.roleId,
          },
        });
      }
    }

    return tx.approvalWorkflowVersion.findUniqueOrThrow({
      where: { id: newVersion.id },
      include: {
        stages: {
          orderBy: { stageOrder: "asc" },
          include: { approvers: true },
        },
      },
    });
  });
}
