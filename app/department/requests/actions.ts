"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  canCancelTransportationRequest,
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
  overlapWarning?: boolean;
  fieldErrors?: Record<string, string>;
};

const parseAddisDate = (val: string) => {
  const s = val.trim();
  if (!s) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00+03:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
};

function validateRequestForm(formData: FormData, isNew: boolean) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const purpose = get("purpose");
  const description = get("description");
  const origin = get("origin");
  const destination = get("destination");
  const passengerCount = Number(get("passengerCount"));
  const requestedStart = parseAddisDate(get("requestedStart"));
  const requestedEnd = parseAddisDate(get("requestedEnd"));
  const tripType: TripTypeOption = get("tripType") === "ONE_WAY" ? "ONE_WAY" : "ROUND_TRIP";
  const priority: PriorityOption = get("priority") === "URGENT" ? "URGENT" : "STANDARD";
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
    fieldErrors.description = "Description must be between 10 and 2,000 characters.";
  if (origin.length < 2 || origin.length > 255)
    fieldErrors.origin = "Origin / pickup point is required (max 255 chars).";
  if (destination.length < 2 || destination.length > 255)
    fieldErrors.destination = "Destination is required (max 255 chars).";
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 200)
    fieldErrors.passengerCount = "Passenger count must be a whole number (1–200).";

  if (!requestedStart) fieldErrors.requestedStart = "Valid departure date/time is required.";
  if (!requestedEnd) fieldErrors.requestedEnd = "Valid return/end date/time is required.";

  if (requestedStart && requestedEnd) {
    const now = Date.now();
    const minLeadMs = (priority === "URGENT" ? 15 : 120) * 60_000;
    if (requestedEnd <= requestedStart) {
      fieldErrors.requestedEnd = "End date/time must be after departure time.";
    } else if (requestedEnd.getTime() - requestedStart.getTime() > 14 * 86_400_000) {
      fieldErrors.requestedEnd = "Single trip duration cannot exceed 14 days.";
    }
    if (requestedStart.getTime() < now + (isNew ? minLeadMs : 0)) {
      fieldErrors.requestedStart =
        priority === "URGENT"
          ? "Urgent requests must be at least 15 minutes from now."
          : "Standard requests require at least 2 hours lead time (or switch Priority to Urgent).";
    } else if (requestedStart.getTime() > now + 180 * 86_400_000) {
      fieldErrors.requestedStart = "Requests cannot be scheduled more than 180 days ahead.";
    }
  }

  if (contactPhone && !/^[0-9+\-\s()]{7,30}$/.test(contactPhone))
    fieldErrors.contactPhone = "Enter a valid phone number (7–30 digits).";

  if (priority === "URGENT" && extraRequirements.length < 5 && description.length < 25)
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
    return { error: "You have reached the maximum of 10 open pending requests." };
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
        title: `${data.priority === "URGENT" ? "[URGENT] " : ""}New Transport Request: ${data.purpose}`,
        message: `${ctx.userName} (${ctx.departmentName}) requested transport (${data.origin} → ${data.destination}) for ${data.passengerCount} pax.`,
        status: "OPEN",
        occurredAt: new Date(),
      },
    });
    return req;
  });

  revalidatePath("/department");
  revalidatePath("/department/requests");
  return { ok: true, requestId: created.id, message: "Request submitted." };
}

export async function updateTransportationRequest(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const authRes = await requireDepartmentActionContext();
  if (!authRes.ok) return { error: authRes.error };
  const { ctx } = authRes;

  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) return { error: "Missing request ID." };

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
    return { error: "This request was already reviewed or cancelled and cannot be edited." };
  }

  revalidatePath("/department");
  revalidatePath("/department/requests");
  revalidatePath(`/department/requests/${requestId}`);
  return { ok: true, requestId, message: "Transportation request updated." };
}

export async function cancelTransportationRequest(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const authRes = await requireDepartmentActionContext();
  if (!authRes.ok) return { error: authRes.error };
  const { ctx } = authRes;

  const requestId = String(formData.get("requestId") ?? "").trim();
  const cancellationReason = String(formData.get("cancellationReason") ?? "").trim();
  if (!requestId) return { error: "Missing request ID." };
  if (cancellationReason.length < 5 || cancellationReason.length > 500) {
    return { error: "Please enter a cancellation reason (5–500 characters)." };
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
      include: { trip: { select: { id: true, status: true, vehicleId: true } } },
    });

    if (!req) return { ok: false as const, error: "Request not found." };
    if (!canCancelTransportationRequest(req.status, req.trip?.status)) {
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
      return { ok: false as const, error: "Request status changed concurrently. Please refresh." };
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
          title: `Approved Trip Cancelled: ${req.purpose}`,
          message: `${ctx.userName} (${ctx.departmentName}) cancelled scheduled trip (${req.origin} → ${req.destination}). Reason: ${cancellationReason}`,
          status: "OPEN",
          occurredAt: new Date(),
        },
      });
    }

    return { ok: true as const };
  });

  if (!res.ok) return { error: res.error };

  revalidatePath("/department");
  revalidatePath("/department/requests");
  revalidatePath(`/department/requests/${requestId}`);
  return { ok: true, requestId, message: "Request cancelled." };
}