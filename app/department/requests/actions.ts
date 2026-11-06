"use server";

import { revalidatePath } from "next/cache";
import type { TransportationRequestStatus, TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  encodeSpecialRequirements,
  requireDepartmentActionContext,
  type PriorityOption,
  type TripTypeOption,
  type VehiclePreferenceOption,
} from "@/lib/department-auth";

export type RequestActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  requestId?: string;
  deletedPermanently?: boolean;
  overlapWarning?: boolean;
  fieldErrors?: Record<string, string>;
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );

const canCancelStatus = (
  status: TransportationRequestStatus,
  tripStatus?: TripStatus | null,
  deletedAt?: Date | null,
) =>
  !deletedAt &&
  (status === "PENDING" ||
    (status === "APPROVED" && (!tripStatus || tripStatus === "SCHEDULED")));

const canSoftDeleteStatus = (
  status: TransportationRequestStatus,
  tripStatus?: TripStatus | null,
  deletedAt?: Date | null,
) => {
  if (deletedAt) return false;
  if (status === "PENDING" || status === "REJECTED" || status === "CANCELLED") {
    return !tripStatus || tripStatus === "CANCELLED" || tripStatus === "COMPLETED";
  }
  if (status === "APPROVED") {
    return tripStatus === "CANCELLED" || tripStatus === "COMPLETED";
  }
  return false;
};

const canHardDeleteStatus = (
  tripStatus?: TripStatus | null,
  deletedAt?: Date | null,
) => Boolean(deletedAt) && (!tripStatus || tripStatus === "CANCELLED");

const parseAddisDate = (val: string) => {
  const s = val.trim();
  if (!s) return null;
  const d = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00+03:00` : s,
  );
  return Number.isNaN(d.getTime()) ? null : d;
};

function revalidateDepartmentPaths(requestId?: string) {
  try {
    revalidatePath("/department");
    revalidatePath("/department/requests");
    revalidatePath("/department/requests/recycle-bin");
    if (requestId) revalidatePath(`/department/requests/${requestId}`);
  } catch {
    // Ignore revalidate errors outside request context
  }
}

function extractRequestId(
  arg1?: RequestActionState | FormData | string,
  arg2?: FormData,
): string {
  if (typeof arg1 === "string") return arg1.trim();
  if (arg1 instanceof FormData) return String(arg1.get("requestId") ?? "").trim();
  if (arg2 instanceof FormData) return String(arg2.get("requestId") ?? "").trim();
  return "";
}

function validateRequestForm(formData: FormData, isNew: boolean) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const purpose = get("purpose");
  const description = get("description");
  const origin = get("origin");
  const destination = get("destination");
  const passengerCount = Number(get("passengerCount"));
  const requestedStart = parseAddisDate(get("requestedStart"));
  const requestedEnd = parseAddisDate(get("requestedEnd"));
  const tripType: TripTypeOption =
    get("tripType") === "ONE_WAY" ? "ONE_WAY" : "ROUND_TRIP";
  const priority: PriorityOption =
    get("priority") === "URGENT" ? "URGENT" : "STANDARD";
  const allowedVehicles: VehiclePreferenceOption[] = [
    "ANY",
    "SEDAN",
    "SUV_4X4",
    "MINIBUS",
    "BUS",
    "PICKUP_CARGO",
  ];
  const rawVeh = get("vehiclePreference") as VehiclePreferenceOption;
  const vehiclePreference = allowedVehicles.includes(rawVeh) ? rawVeh : "ANY";
  const contactName = get("contactName").slice(0, 120);
  const contactPhone = get("contactPhone").slice(0, 30);
  const cargoDetails = get("cargoDetails").slice(0, 300);
  const extraRequirements = get("extraRequirements").slice(0, 1000);
  const notes = get("notes").slice(0, 1000) || null;
  const confirmOverlap = formData.get("confirmOverlap") === "true";

  const fieldErrors: Record<string, string> = {};

  if (purpose.length < 3 || purpose.length > 200)
    fieldErrors.purpose = "Purpose must be between 3 and 200 characters.";
  if (description.length < 10 || description.length > 2000)
    fieldErrors.description =
      "Description must be between 10 and 2,000 characters.";
  if (origin.length < 2 || origin.length > 255)
    fieldErrors.origin = "Origin / pickup point is required (max 255 chars).";
  if (destination.length < 2 || destination.length > 255)
    fieldErrors.destination = "Destination is required (max 255 chars).";
  if (
    !Number.isInteger(passengerCount) ||
    passengerCount < 1 ||
    passengerCount > 200
  )
    fieldErrors.passengerCount =
      "Passenger count must be a whole number (1–200).";

  if (!requestedStart)
    fieldErrors.requestedStart = "Valid departure date/time is required.";
  if (!requestedEnd)
    fieldErrors.requestedEnd = "Valid return/end date/time is required.";

  if (requestedStart && requestedEnd) {
    const now = Date.now();
    const minLeadMs = (priority === "URGENT" ? 15 : 120) * 60_000;
    if (requestedEnd <= requestedStart) {
      fieldErrors.requestedEnd = "End date/time must be after departure time.";
    } else if (
      requestedEnd.getTime() - requestedStart.getTime() >
      14 * 86_400_000
    ) {
      fieldErrors.requestedEnd = "Single trip duration cannot exceed 14 days.";
    }

    if (isNew && requestedStart.getTime() < now + minLeadMs) {
      fieldErrors.requestedStart =
        priority === "URGENT"
          ? "Urgent requests must be at least 15 minutes from now."
          : "Standard requests require at least 2 hours lead time (or switch Priority to Urgent).";
    } else if (requestedStart.getTime() > now + 180 * 86_400_000) {
      fieldErrors.requestedStart =
        "Requests cannot be scheduled more than 180 days ahead.";
    }
  }

  if (contactPhone && !/^[0-9+\-\s()]{7,30}$/.test(contactPhone))
    fieldErrors.contactPhone = "Enter a valid phone number (7–30 digits).";

  if (
    priority === "URGENT" &&
    extraRequirements.length < 5 &&
    description.length < 25
  )
    fieldErrors.extraRequirements = "Please state a brief urgency justification.";

  if (Object.keys(fieldErrors).length > 0 || !requestedStart || !requestedEnd) {
    return { fieldErrors, error: "Please fix the highlighted fields." };
  }

  return {
    data: {
      purpose,
      description,
      origin,
      destination,
      passengerCount,
      requestedStart,
      requestedEnd,
      notes,
      priority,
      confirmOverlap,
      specialRequirements: encodeSpecialRequirements({
        tripType,
        priority,
        vehiclePreference,
        contactName,
        contactPhone,
        cargoDetails,
        extraRequirements,
      }),
    },
  };
}

export async function createTransportationRequest(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  try {
    const authRes = await requireDepartmentActionContext();
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const { data, fieldErrors, error } = validateRequestForm(formData, true);
    if (!data) return { error, fieldErrors };

    const pendingCount = await prisma.transportationRequest.count({
      where: {
        organizationId: ctx.organizationId,
        departmentId: ctx.departmentId,
        requestedById: ctx.userId,
        status: "PENDING",
        deletedAt: null,
      },
    });
    if (pendingCount >= 10) {
      return {
        error: "You have reached the maximum of 10 open pending requests.",
      };
    }

    if (!data.confirmOverlap) {
      const overlap = await prisma.transportationRequest.findFirst({
        where: {
          organizationId: ctx.organizationId,
          departmentId: ctx.departmentId,
          requestedById: ctx.userId,
          status: { in: ["PENDING", "APPROVED"] },
          deletedAt: null,
          requestedStart: { lt: data.requestedEnd },
          requestedEnd: { gt: data.requestedStart },
        },
        select: { purpose: true, destination: true },
      });
      if (overlap) {
        return {
          overlapWarning: true,
          error: `Overlaps with your active request "${overlap.purpose}" (${overlap.destination}). Check "Confirm overlapping schedule" below to submit anyway.`,
        };
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const req = await tx.transportationRequest.create({
        data: {
          organizationId: ctx.organizationId,
          departmentId: ctx.departmentId,
          requestedById: ctx.userId,
          purpose: data.purpose,
          description: data.description,
          origin: data.origin,
          destination: data.destination,
          passengerCount: data.passengerCount,
          requestedStart: data.requestedStart,
          requestedEnd: data.requestedEnd,
          specialRequirements: data.specialRequirements,
          notes: data.notes,
          status: "PENDING",
        },
        select: { id: true },
      });

      await tx.alert.create({
        data: {
          organizationId: ctx.organizationId,
          alertType: "TRANSPORTATION_REQUEST_SUBMITTED",
          severity: data.priority === "URGENT" ? "WARNING" : "INFO",
          title: `${data.priority === "URGENT" ? "[URGENT] " : ""}New Transport Request: ${data.purpose}`.slice(
            0,
            200,
          ),
          message: `${ctx.userName} (${ctx.departmentName}) requested transport (${data.origin} → ${data.destination}) for ${data.passengerCount} pax.`,
          status: "OPEN",
          occurredAt: new Date(),
        },
      });
      return req;
    });

    revalidateDepartmentPaths(created.id);
    return { ok: true, requestId: created.id, message: "Request submitted." };
  } catch (err) {
    console.error("createTransportationRequest failed:", err);
    return {
      error: "Could not submit your transportation request. Please try again.",
    };
  }
}

export async function updateTransportationRequest(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  try {
    const authRes = await requireDepartmentActionContext();
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = String(formData.get("requestId") ?? "").trim();
    if (!isUuid(requestId)) return { error: "Invalid request ID." };

    const { data, fieldErrors, error } = validateRequestForm(formData, false);
    if (!data) return { error, fieldErrors };

    const updated = await prisma.transportationRequest.updateMany({
      where: {
        id: requestId,
        organizationId: ctx.organizationId,
        departmentId: ctx.departmentId,
        requestedById: ctx.userId,
        status: "PENDING",
        deletedAt: null,
      },
      data: {
        purpose: data.purpose,
        description: data.description,
        origin: data.origin,
        destination: data.destination,
        passengerCount: data.passengerCount,
        requestedStart: data.requestedStart,
        requestedEnd: data.requestedEnd,
        specialRequirements: data.specialRequirements,
        notes: data.notes,
      },
    });

    if (updated.count === 0) {
      return {
        error:
          "This request was already reviewed, cancelled, or moved to the Recycle Bin.",
      };
    }

    revalidateDepartmentPaths(requestId);
    return {
      ok: true,
      requestId,
      message: "Transportation request updated.",
    };
  } catch (err) {
    console.error("updateTransportationRequest failed:", err);
    return { error: "Could not save your changes. Please try again." };
  }
}

export async function cancelTransportationRequest(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  try {
    const authRes = await requireDepartmentActionContext();
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = String(formData.get("requestId") ?? "").trim();
    const cancellationReason = String(
      formData.get("cancellationReason") ?? "",
    ).trim();
    if (!isUuid(requestId)) return { error: "Invalid request ID." };
    if (cancellationReason.length < 5 || cancellationReason.length > 500) {
      return {
        error: "Please enter a cancellation reason (5–500 characters).",
      };
    }

    const res = await prisma.$transaction(async (tx) => {
      const req = await tx.transportationRequest.findFirst({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          departmentId: ctx.departmentId,
          requestedById: ctx.userId,
          deletedAt: null,
        },
        include: {
          trip: { select: { id: true, status: true, vehicleId: true } },
        },
      });

      if (!req) return { ok: false as const, error: "Request not found." };
      if (!canCancelStatus(req.status, req.trip?.status, req.deletedAt)) {
        return {
          ok: false as const,
          error: `Cannot cancel request when status is ${req.status}${req.trip ? ` (Trip: ${req.trip.status})` : ""}.`,
        };
      }

      const updated = await tx.transportationRequest.updateMany({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          departmentId: ctx.departmentId,
          requestedById: ctx.userId,
          status: req.status,
          deletedAt: null,
        },
        data: { status: "CANCELLED", cancellationReason },
      });

      if (updated.count === 0) {
        return {
          ok: false as const,
          error: "Request status changed concurrently. Please refresh.",
        };
      }

      if (req.trip?.status === "SCHEDULED") {
        await tx.trip.update({
          where: { id: req.trip.id },
          data: {
            status: "CANCELLED",
            notes: `Cancelled by ${ctx.userName}: ${cancellationReason}`,
          },
        });
        await tx.vehicle.updateMany({
          where: {
            id: req.trip.vehicleId,
            organizationId: ctx.organizationId,
            availability: "ASSIGNED",
          },
          data: { availability: "AVAILABLE" },
        });
        await tx.alert.create({
          data: {
            organizationId: ctx.organizationId,
            tripId: req.trip.id,
            vehicleId: req.trip.vehicleId,
            alertType: "APPROVED_REQUEST_CANCELLED",
            severity: "WARNING",
            title: `Approved Trip Cancelled: ${req.purpose}`.slice(0, 200),
            message: `${ctx.userName} (${ctx.departmentName}) cancelled scheduled trip (${req.origin} → ${req.destination}). Reason: ${cancellationReason}`,
            status: "OPEN",
            occurredAt: new Date(),
          },
        });
      }

      return { ok: true as const };
    });

    if (!res.ok) return { error: res.error };

    revalidateDepartmentPaths(requestId);
    return { ok: true, requestId, message: "Request cancelled." };
  } catch (err) {
    console.error("cancelTransportationRequest failed:", err);
    return { error: "Could not cancel the request. Please try again." };
  }
}

export async function softDeleteTransportationRequest(
  arg1?: RequestActionState | FormData | string,
  arg2?: FormData,
): Promise<RequestActionState> {
  try {
    const authRes = await requireDepartmentActionContext();
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = extractRequestId(arg1, arg2);
    if (!isUuid(requestId)) return { error: "Invalid request ID." };

    const req = await prisma.transportationRequest.findFirst({
      where: {
        id: requestId,
        organizationId: ctx.organizationId,
        departmentId: ctx.departmentId,
        requestedById: ctx.userId,
        deletedAt: null,
      },
      include: { trip: { select: { status: true } } },
    });

    if (!req) {
      return { error: "Request not found or already in the Recycle Bin." };
    }

    if (!canSoftDeleteStatus(req.status, req.trip?.status, req.deletedAt)) {
      return {
        error:
          "Approved requests with a scheduled or active trip must be cancelled before moving to the Recycle Bin.",
      };
    }

    const updated = await prisma.transportationRequest.updateMany({
      where: {
        id: requestId,
        organizationId: ctx.organizationId,
        departmentId: ctx.departmentId,
        requestedById: ctx.userId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    if (updated.count === 0) {
      return {
        error: "Could not move request to the Recycle Bin. Please refresh.",
      };
    }

    revalidateDepartmentPaths(requestId);
    return {
      ok: true,
      requestId,
      message: "Request moved to the Recycle Bin.",
    };
  } catch (err) {
    console.error("softDeleteTransportationRequest failed:", err);
    return {
      error: "Failed to move request to the Recycle Bin. Please try again.",
    };
  }
}

export async function restoreTransportationRequest(
  arg1?: RequestActionState | FormData | string,
  arg2?: FormData,
): Promise<RequestActionState> {
  try {
    const authRes = await requireDepartmentActionContext();
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = extractRequestId(arg1, arg2);
    if (!isUuid(requestId)) return { error: "Invalid request ID." };

    const updated = await prisma.transportationRequest.updateMany({
      where: {
        id: requestId,
        organizationId: ctx.organizationId,
        departmentId: ctx.departmentId,
        requestedById: ctx.userId,
        deletedAt: { not: null },
      },
      data: { deletedAt: null },
    });

    if (updated.count === 0) {
      return { error: "Request was not found in your Recycle Bin." };
    }

    revalidateDepartmentPaths(requestId);
    return {
      ok: true,
      requestId,
      message: "Request restored from the Recycle Bin.",
    };
  } catch (err) {
    console.error("restoreTransportationRequest failed:", err);
    return { error: "Failed to restore request. Please try again." };
  }
}

export async function permanentlyDeleteTransportationRequest(
  arg1?: RequestActionState | FormData | string,
  arg2?: FormData,
): Promise<RequestActionState> {
  try {
    const authRes = await requireDepartmentActionContext();
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = extractRequestId(arg1, arg2);
    if (!isUuid(requestId)) return { error: "Invalid request ID." };

    const res = await prisma.$transaction(async (tx) => {
      const req = await tx.transportationRequest.findFirst({
        where: {
          id: requestId,
          organizationId: ctx.organizationId,
          departmentId: ctx.departmentId,
          requestedById: ctx.userId,
          deletedAt: { not: null },
        },
        include: { trip: { select: { id: true, status: true } } },
      });

      if (!req) {
        return {
          ok: false as const,
          error:
            "Only requests inside the Recycle Bin can be permanently deleted.",
        };
      }

      if (!canHardDeleteStatus(req.trip?.status, req.deletedAt)) {
        return {
          ok: false as const,
          error:
            "Requests linked to a completed or active trip record must remain archived for fleet audit history.",
        };
      }

      if (req.trip) {
        await tx.alert.deleteMany({
          where: { organizationId: ctx.organizationId, tripId: req.trip.id },
        });
        await tx.trip.delete({
          where: { id: req.trip.id },
        });
      }

      await tx.transportationRequest.delete({
        where: { id: req.id },
      });

      return { ok: true as const };
    });

    if (!res.ok) return { error: res.error };

    revalidateDepartmentPaths();
    return {
      ok: true,
      deletedPermanently: true,
      message: "Transportation request permanently deleted.",
    };
  } catch (err) {
    console.error("permanentlyDeleteTransportationRequest failed:", err);
    return {
      error: "Failed to permanently delete request. Please try again.",
    };
  }
}

export async function emptyDepartmentRecycleBin(
  _prev?: RequestActionState,
  _formData?: FormData,
): Promise<RequestActionState> {
  try {
    const authRes = await requireDepartmentActionContext();
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const res = await prisma.$transaction(async (tx) => {
      const trashed = await tx.transportationRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          departmentId: ctx.departmentId,
          requestedById: ctx.userId,
          deletedAt: { not: null },
        },
        select: {
          id: true,
          deletedAt: true,
          trip: { select: { id: true, status: true } },
        },
      });

      const deletable = trashed.filter((r) =>
        canHardDeleteStatus(r.trip?.status, r.deletedAt),
      );

      if (deletable.length === 0) {
        return {
          ok: false as const,
          error:
            "No eligible requests in the Recycle Bin to delete permanently.",
        };
      }

      const tripIds = deletable
        .map((r) => r.trip?.id)
        .filter((id): id is string => Boolean(id));
      if (tripIds.length > 0) {
        await tx.alert.deleteMany({
          where: {
            organizationId: ctx.organizationId,
            tripId: { in: tripIds },
          },
        });
        await tx.trip.deleteMany({
          where: { id: { in: tripIds }, organizationId: ctx.organizationId },
        });
      }

      const del = await tx.transportationRequest.deleteMany({
        where: {
          id: { in: deletable.map((r) => r.id) },
          organizationId: ctx.organizationId,
          departmentId: ctx.departmentId,
          requestedById: ctx.userId,
        },
      });

      return {
        ok: true as const,
        count: del.count,
        skipped: trashed.length - del.count,
      };
    });

    if (!res.ok) return { error: res.error };

    revalidateDepartmentPaths();
    return {
      ok: true,
      message: `Permanently deleted ${res.count} request(s) from the Recycle Bin${
        res.skipped > 0
          ? ` (${res.skipped} completed-trip audit record(s) retained).`
          : "."
      }`,
    };
  } catch (err) {
    console.error("emptyDepartmentRecycleBin failed:", err);
    return { error: "Failed to empty the Recycle Bin. Please try again." };
  }
}
