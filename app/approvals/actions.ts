"use server";

import { revalidatePath } from "next/cache";
import type { ApprovalDecisionType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordApprovalDecision, skipOptionalStage } from "@/lib/workflow";
import { decodeSpecialRequirements } from "@/lib/department-auth";

export type ApproverActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function processWorkflowDecisionAction(
  _prev: ApproverActionState,
  formData: FormData,
): Promise<ApproverActionState> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Your session has expired. Please sign in again." };
    }

    const instanceId = String(formData.get("instanceId") ?? "").trim();
    const decisionType = String(
      formData.get("decisionType") ?? "",
    ).trim() as ApprovalDecisionType;
    const comment = String(formData.get("comment") ?? "").trim();

    if (!instanceId) return { error: "Invalid workflow instance ID." };
    if (!["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(decisionType)) {
      return { error: `Invalid decision type "${decisionType}".` };
    }

    if (
      (decisionType === "REJECT" || decisionType === "REQUEST_CHANGES") &&
      comment.length < 3
    ) {
      return {
        error: `A comment of at least 3 characters is required for ${decisionType}.`,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        deletedAt: true,
      },
    });

    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.deletedAt !== null ||
      !user.organizationId
    ) {
      return { error: "User is not active in this organization." };
    }

    const organizationId = user.organizationId;
    const actorName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email ||
      "Approver";

    const outcome = await prisma.$transaction(async (tx) => {
      // 1. Record decision through workflow engine (Sole creator of ApprovalDecision)
      const decisionResult = await recordApprovalDecision({
        organizationId,
        instanceId,
        approverId: user.id,
        decisionType,
        comment: comment || null,
        tx,
      });

      // 2. Load instance to inspect entityType and entityId
      const instance = await tx.approvalWorkflowInstance.findUniqueOrThrow({
        where: { id: instanceId },
      });

      // 3. Synchronize TransportationRequest status atomically if applicable
      if (instance.entityType === "TRANSPORTATION_REQUEST") {
        const req = await tx.transportationRequest.findUniqueOrThrow({
          where: { id: instance.entityId },
          include: { department: { select: { name: true } } },
        });

        const now = new Date();

        if (decisionResult.outcome === "WORKFLOW_APPROVED") {
          await tx.transportationRequest.update({
            where: { id: req.id },
            data: {
              status: "APPROVED",
              reviewedById: user.id,
              reviewedAt: now,
              rejectionReason: null,
            },
          });

          const currentMeta = decodeSpecialRequirements(
            req.specialRequirements,
          );
          await tx.alert.create({
            data: {
              organizationId,
              alertType: "REQUEST_APPROVED_FOR_DISPATCH",
              severity: currentMeta.priority === "URGENT" ? "WARNING" : "INFO",
              title: `${
                currentMeta.priority === "URGENT" ? "[URGENT] " : ""
              }Approved for Dispatch: ${req.purpose}`.slice(0, 200),
              message: `${actorName} completed final workflow approval for ${
                req.department.name
              } request (${req.origin} → ${req.destination}, ${
                req.passengerCount
              } pax).${comment ? ` Approver note: ${comment}` : ""}`,
              status: "OPEN",
              occurredAt: now,
            },
          });
        } else if (decisionResult.outcome === "REJECTED") {
          await tx.transportationRequest.update({
            where: { id: req.id },
            data: {
              status: "REJECTED",
              rejectionReason: comment,
              reviewedById: user.id,
              reviewedAt: now,
            },
          });

          await tx.alert.create({
            data: {
              organizationId,
              alertType: "TRANSPORTATION_REQUEST_SUBMITTED",
              severity: "WARNING",
              title: `Request Rejected: ${req.purpose}`.slice(0, 200),
              message: `${actorName} rejected ${req.department.name} request (${req.origin} → ${req.destination}). Reason: ${comment}`,
              status: "OPEN",
              occurredAt: now,
            },
          });
        } else if (decisionResult.outcome === "CHANGES_REQUESTED") {
          await tx.transportationRequest.update({
            where: { id: req.id },
            data: {
              status: "CHANGES_REQUESTED",
            },
          });

          await tx.alert.create({
            data: {
              organizationId,
              alertType: "TRANSPORTATION_REQUEST_SUBMITTED",
              severity: "WARNING",
              title: `Changes Requested: ${req.purpose}`.slice(0, 200),
              message: `${actorName} requested changes on ${req.department.name} request (${req.origin} → ${req.destination}). Notes: ${comment}`,
              status: "OPEN",
              occurredAt: now,
            },
          });
        }
      }

      return decisionResult;
    });

    try {
      revalidatePath("/approvals");
      revalidatePath(`/approvals/${instanceId}`);
      revalidatePath("/department");
      revalidatePath("/department/requests");
      revalidatePath("/organization");
      revalidatePath("/organization/requests");
      revalidatePath("/transport");
    } catch {}

    const messages: Record<string, string> = {
      WORKFLOW_APPROVED:
        "Decision recorded: Approval workflow completed and request approved!",
      STAGE_ADVANCED:
        "Decision recorded: Stage approved and workflow advanced to next stage.",
      DECISION_RECORDED:
        "Your approval decision was recorded. Waiting for remaining required approvers.",
      REJECTED: "Decision recorded: Request rejected and workflow terminated.",
      CHANGES_REQUESTED:
        "Decision recorded: Changes requested and returned to requester.",
    };

    return {
      ok: true,
      message: messages[outcome.outcome] ?? "Decision recorded successfully.",
    };
  } catch (err: any) {
    console.error("processWorkflowDecisionAction failed:", err);
    return {
      error:
        err?.message || "Failed to record approval decision. Please try again.",
    };
  }
}

export async function skipWorkflowStageAction(
  _prev: ApproverActionState,
  formData: FormData,
): Promise<ApproverActionState> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Your session has expired. Please sign in again." };
    }

    const instanceId = String(formData.get("instanceId") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();

    if (!instanceId) return { error: "Invalid workflow instance ID." };
    if (reason.length < 3) {
      return { error: "A skip reason of at least 3 characters is required." };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        deletedAt: true,
      },
    });

    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.deletedAt !== null ||
      !user.organizationId
    ) {
      return { error: "User is not active in this organization." };
    }

    const organizationId = user.organizationId;
    const actorName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email ||
      "Approver";

    const outcome = await prisma.$transaction(async (tx) => {
      const skipResult = await skipOptionalStage({
        organizationId,
        instanceId,
        actorId: user.id,
        reason,
        tx,
      });

      const instance = await tx.approvalWorkflowInstance.findUniqueOrThrow({
        where: { id: instanceId },
      });

      if (instance.entityType === "TRANSPORTATION_REQUEST") {
        const req = await tx.transportationRequest.findUniqueOrThrow({
          where: { id: instance.entityId },
          include: { department: { select: { name: true } } },
        });

        const now = new Date();

        if (skipResult.outcome === "WORKFLOW_APPROVED") {
          await tx.transportationRequest.update({
            where: { id: req.id },
            data: {
              status: "APPROVED",
              reviewedById: user.id,
              reviewedAt: now,
              rejectionReason: null,
            },
          });

          const currentMeta = decodeSpecialRequirements(
            req.specialRequirements,
          );
          await tx.alert.create({
            data: {
              organizationId,
              alertType: "REQUEST_APPROVED_FOR_DISPATCH",
              severity: currentMeta.priority === "URGENT" ? "WARNING" : "INFO",
              title: `${
                currentMeta.priority === "URGENT" ? "[URGENT] " : ""
              }Approved for Dispatch: ${req.purpose}`.slice(0, 200),
              message: `${actorName} skipped optional stage, completing approval for ${req.department.name} request (${req.origin} → ${req.destination}, ${req.passengerCount} pax).`,
              status: "OPEN",
              occurredAt: now,
            },
          });
        }
      }

      return skipResult;
    });

    try {
      revalidatePath("/approvals");
      revalidatePath(`/approvals/${instanceId}`);
      revalidatePath("/department");
      revalidatePath("/department/requests");
      revalidatePath("/organization");
      revalidatePath("/organization/requests");
      revalidatePath("/transport");
    } catch {}

    return {
      ok: true,
      message:
        outcome.outcome === "WORKFLOW_APPROVED"
          ? "Optional stage skipped: Approval workflow completed and request approved!"
          : "Optional stage skipped: Workflow advanced to next stage.",
    };
  } catch (err: any) {
    console.error("skipWorkflowStageAction failed:", err);
    return {
      error: err?.message || "Failed to skip optional stage. Please try again.",
    };
  }
}
