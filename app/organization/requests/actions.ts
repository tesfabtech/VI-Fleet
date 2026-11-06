"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  decodeSpecialRequirements,
  encodeSpecialRequirements,
} from "@/lib/department-auth";

export type ReviewActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  staleConflict?: boolean;
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );

const ORG_ADMIN_ROLES = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];

const TRANSPORT_ROLES = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];

async function requireVerifiedOrgRole(allowedRoles: string[]) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Your session has expired. Please sign in again.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: {
        select: { id: true, name: true, status: true, deletedAt: true },
      },
    },
  });

  if (
    !user ||
    user.deletedAt !== null ||
    user.status !== "ACTIVE" ||
    !allowedRoles.includes(user.role) ||
    !user.organizationId ||
    !user.organization ||
    user.organization.deletedAt !== null ||
    user.organization.status !== "ACTIVE"
  ) {
    return {
      ok: false as const,
      error: "You are not authorized to perform this organization action.",
    };
  }

  const actorName =
    [user.firstName, user.middleName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user.email ||
    "Administrator";

  return {
    ok: true as const,
    ctx: {
      userId: user.id,
      userRole: user.role,
      actorName,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
    },
  };
}

function revalidateReviewPaths(requestId?: string) {
  try {
    revalidatePath("/organization");
    revalidatePath("/organization/requests");
    revalidatePath("/transport");
    revalidatePath("/department");
    revalidatePath("/department/requests");
    if (requestId) {
      revalidatePath(`/organization/requests/${requestId}`);
      revalidatePath(`/department/requests/${requestId}`);
    }
  } catch {
    // Ignore outside request context
  }
}

export async function approveTransportationRequest(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  try {
    const authRes = await requireVerifiedOrgRole(ORG_ADMIN_ROLES);
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = String(formData.get("requestId") ?? "").trim();
    const expectedUpdatedAt = String(
      formData.get("expectedUpdatedAt") ?? "",
    ).trim();
    const adminReviewNote = String(formData.get("adminReviewNote") ?? "")
      .trim()
      .slice(0, 500);

    if (!isUuid(requestId)) return { error: "Invalid request ID." };

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.transportationRequest.findFirst({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          department: { select: { name: true } },
        },
      });

      if (!existing) {
        return {
          ok: false as const,
          error: "Transportation request not found.",
        };
      }

      if (existing.status !== "PENDING") {
        return {
          ok: false as const,
          error: `This request cannot be approved because its status is already ${existing.status}.`,
        };
      }

      // Stale-review protection: verify the requester didn't edit the request while the Admin was reviewing it
      if (
        expectedUpdatedAt &&
        existing.updatedAt.toISOString() !== expectedUpdatedAt
      ) {
        return {
          ok: false as const,
          staleConflict: true,
          error:
            "This request was modified by the requester while you were reviewing it. The page has been refreshed with the latest details—please review again before approving.",
        };
      }

      // Prevent approving expired requests whose departure time is already in the past
      if (existing.requestedStart.getTime() < Date.now()) {
        return {
          ok: false as const,
          error:
            "Cannot approve an expired request whose departure time has already passed. Please reject it instead.",
        };
      }

      const currentMeta = decodeSpecialRequirements(
        existing.specialRequirements,
      );
      const updatedSpecialRequirements = encodeSpecialRequirements({
        ...currentMeta,
        adminReviewNote: adminReviewNote || currentMeta.adminReviewNote || "",
        transportFlagReason: "",
      });

      const now = new Date();

      const updated = await tx.transportationRequest.updateMany({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          status: "PENDING",
          deletedAt: null,
          ...(expectedUpdatedAt
            ? { updatedAt: new Date(expectedUpdatedAt) }
            : {}),
        },
        data: {
          status: "APPROVED",
          reviewedById: ctx.userId,
          reviewedAt: now,
          rejectionReason: null,
          specialRequirements: updatedSpecialRequirements,
        },
      });

      if (updated.count === 0) {
        return {
          ok: false as const,
          staleConflict: true,
          error:
            "This request was updated or reviewed concurrently. Please refresh the page.",
        };
      }

      await tx.alert.create({
        data: {
          organizationId: ctx.organizationId,
          alertType: "REQUEST_APPROVED_FOR_DISPATCH",
          severity: currentMeta.priority === "URGENT" ? "WARNING" : "INFO",
          title: `${currentMeta.priority === "URGENT" ? "[URGENT] " : ""}Approved for Dispatch: ${existing.purpose}`.slice(
            0,
            200,
          ),
          message: `${ctx.actorName} approved ${existing.department.name} request (${existing.origin} → ${existing.destination}, ${existing.passengerCount} pax).${
            adminReviewNote ? ` Dispatch note: ${adminReviewNote}` : ""
          }`,
          status: "OPEN",
          occurredAt: now,
        },
      });

      return { ok: true as const };
    });

    if (!outcome.ok) {
      return { error: outcome.error, staleConflict: outcome.staleConflict };
    }

    revalidateReviewPaths(requestId);
    return {
      ok: true,
      message:
        "Transportation request approved and routed to the Transport Manager for vehicle & driver dispatch.",
    };
  } catch (err) {
    console.error("approveTransportationRequest failed:", err);
    return { error: "Failed to approve request. Please try again." };
  }
}

export async function rejectTransportationRequest(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  try {
    const authRes = await requireVerifiedOrgRole(ORG_ADMIN_ROLES);
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = String(formData.get("requestId") ?? "").trim();
    const expectedUpdatedAt = String(
      formData.get("expectedUpdatedAt") ?? "",
    ).trim();
    const rejectionReason = String(
      formData.get("rejectionReason") ?? "",
    ).trim();

    if (!isUuid(requestId)) return { error: "Invalid request ID." };
    if (rejectionReason.length < 5 || rejectionReason.length > 500) {
      return {
        error: "Please provide a clear rejection reason (5–500 characters).",
      };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.transportationRequest.findFirst({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: { department: { select: { name: true } } },
      });

      if (!existing) {
        return {
          ok: false as const,
          error: "Transportation request not found.",
        };
      }

      if (existing.status !== "PENDING") {
        return {
          ok: false as const,
          error: `This request cannot be rejected because its status is already ${existing.status}.`,
        };
      }

      if (
        expectedUpdatedAt &&
        existing.updatedAt.toISOString() !== expectedUpdatedAt
      ) {
        return {
          ok: false as const,
          staleConflict: true,
          error:
            "This request was modified by the requester while you were reviewing it. Please inspect the updated fields before rejecting.",
        };
      }

      const now = new Date();
      const updated = await tx.transportationRequest.updateMany({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          status: "PENDING",
          deletedAt: null,
          ...(expectedUpdatedAt
            ? { updatedAt: new Date(expectedUpdatedAt) }
            : {}),
        },
        data: {
          status: "REJECTED",
          reviewedById: ctx.userId,
          reviewedAt: now,
          rejectionReason,
        },
      });

      if (updated.count === 0) {
        return {
          ok: false as const,
          staleConflict: true,
          error:
            "This request was updated or reviewed concurrently. Please refresh the page.",
        };
      }

      await tx.alert.create({
        data: {
          organizationId: ctx.organizationId,
          alertType: "TRANSPORTATION_REQUEST_REJECTED",
          severity: "INFO",
          title: `Transport Request Rejected: ${existing.purpose}`.slice(0, 200),
          message: `${ctx.actorName} rejected ${existing.department.name} request (${existing.origin} → ${existing.destination}). Reason: ${rejectionReason}`,
          status: "OPEN",
          occurredAt: now,
        },
      });

      return { ok: true as const };
    });

    if (!outcome.ok) {
      return { error: outcome.error, staleConflict: outcome.staleConflict };
    }

    revalidateReviewPaths(requestId);
    return {
      ok: true,
      message: "Transportation request rejected and requester notified.",
    };
  } catch (err) {
    console.error("rejectTransportationRequest failed:", err);
    return { error: "Failed to reject request. Please try again." };
  }
}

export async function adminCancelApprovedRequest(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  try {
    const authRes = await requireVerifiedOrgRole(ORG_ADMIN_ROLES);
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = String(formData.get("requestId") ?? "").trim();
    const cancellationReason = String(
      formData.get("cancellationReason") ?? "",
    ).trim();

    if (!isUuid(requestId)) return { error: "Invalid request ID." };
    if (cancellationReason.length < 5 || cancellationReason.length > 500) {
      return {
        error:
          "Please provide a cancellation reason (5–500 characters) for audit records.",
      };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.transportationRequest.findFirst({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          trip: { select: { id: true, status: true, vehicleId: true } },
        },
      });

      if (!existing) {
        return {
          ok: false as const,
          error: "Transportation request not found.",
        };
      }

      if (existing.status !== "APPROVED") {
        return {
          ok: false as const,
          error: `Only APPROVED requests can be cancelled here (current status: ${existing.status}).`,
        };
      }

      if (
        existing.trip?.status === "IN_PROGRESS" ||
        existing.trip?.status === "COMPLETED"
      ) {
        return {
          ok: false as const,
          error: `Cannot cancel an approved request whose trip is already ${existing.trip.status}.`,
        };
      }

      const updated = await tx.transportationRequest.updateMany({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          status: "APPROVED",
          deletedAt: null,
        },
        data: {
          status: "CANCELLED",
          cancellationReason: `[Cancelled by ${ctx.actorName}] ${cancellationReason}`,
        },
      });

      if (updated.count === 0) {
        return {
          ok: false as const,
          error: "Request state changed concurrently. Please refresh.",
        };
      }

      if (existing.trip?.status === "SCHEDULED") {
        await tx.trip.update({
          where: { id: existing.trip.id },
          data: {
            status: "CANCELLED",
            notes: `Cancelled by Organization Admin (${ctx.actorName}): ${cancellationReason}`,
          },
        });

        await tx.vehicle.updateMany({
          where: {
            id: existing.trip.vehicleId,
            organizationId: ctx.organizationId,
            availability: "ASSIGNED",
          },
          data: { availability: "AVAILABLE" },
        });
      }

      await tx.alert.create({
        data: {
          organizationId: ctx.organizationId,
          tripId: existing.trip?.id ?? null,
          vehicleId: existing.trip?.vehicleId ?? null,
          alertType: "ADMIN_CANCELLED_APPROVED_REQUEST",
          severity: "WARNING",
          title: `Approved Request Cancelled by Admin: ${existing.purpose}`.slice(
            0,
            200,
          ),
          message: `${ctx.actorName} cancelled approved request (${existing.origin} → ${existing.destination}). Reason: ${cancellationReason}`,
          status: "OPEN",
          occurredAt: new Date(),
        },
      });

      return { ok: true as const };
    });

    if (!outcome.ok) return { error: outcome.error };

    revalidateReviewPaths(requestId);
    return {
      ok: true,
      message:
        "Approved request cancelled and any scheduled vehicle has been released.",
    };
  } catch (err) {
    console.error("adminCancelApprovedRequest failed:", err);
    return { error: "Failed to cancel approved request. Please try again." };
  }
}

export async function flagUnfulfillableRequest(
  requestId: string,
  reason: string,
): Promise<ReviewActionState> {
  try {
    const authRes = await requireVerifiedOrgRole(TRANSPORT_ROLES);
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const trimmedReason = reason.trim();
    if (!isUuid(requestId)) return { error: "Invalid request ID." };
    if (trimmedReason.length < 5 || trimmedReason.length > 300) {
      return {
        error: "Please enter a brief reason (5–300 characters) for the Admin.",
      };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.transportationRequest.findFirst({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          status: "APPROVED",
          deletedAt: null,
        },
        include: { trip: { select: { id: true, status: true } } },
      });

      if (!existing) {
        return {
          ok: false as const,
          error: "Approved request not found.",
        };
      }

      if (existing.trip && existing.trip.status !== "CANCELLED") {
        return {
          ok: false as const,
          error: "This request already has an assigned trip.",
        };
      }

      const currentMeta = decodeSpecialRequirements(
        existing.specialRequirements,
      );
      const updatedMeta = encodeSpecialRequirements({
        ...currentMeta,
        transportFlagReason: `${trimmedReason} (by ${ctx.actorName})`,
      });

      await tx.transportationRequest.update({
        where: { id: existing.id },
        data: { specialRequirements: updatedMeta },
      });

      await tx.alert.create({
        data: {
          organizationId: ctx.organizationId,
          alertType: "DISPATCH_UNFULFILLABLE",
          severity: "WARNING",
          title: `Cannot Fulfil Approved Request: ${existing.purpose}`.slice(
            0,
            200,
          ),
          message: `Transport Manager (${ctx.actorName}) flagged approved request (${existing.origin} → ${existing.destination}) as unfulfillable: ${trimmedReason}`,
          status: "OPEN",
          occurredAt: new Date(),
        },
      });

      return { ok: true as const };
    });

    if (!outcome.ok) return { error: outcome.error };

    revalidateReviewPaths(requestId);
    return {
      ok: true,
      message: "Escalated to Organization Administrator for review.",
    };
  } catch (err) {
    console.error("flagUnfulfillableRequest failed:", err);
    return { error: "Could not flag request. Please try again." };
  }
}