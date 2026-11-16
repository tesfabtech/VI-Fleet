"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  decodeSpecialRequirements,
  encodeSpecialRequirements,
  formatAddisDateTime,
  isUuid,
} from "@/lib/department-auth";
import {
  appendTripHistoryEntry,
  canTransitionTripStatus,
  getBufferedWindow,
  TURNAROUND_BUFFER_MINUTES,
} from "@/lib/trip-scheduling";

export type TripActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  tripId?: string;
};

const TRANSPORT_MANAGERS = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
  "SYSTEM_ADMINISTRATOR",
];

const parseAddisDate = (val: string): Date | null => {
  const s = val.trim();
  if (!s) return null;
  const d = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00+03:00` : s,
  );
  return Number.isNaN(d.getTime()) ? null : d;
};

function revalidateTripPaths(tripId?: string, requestId?: string) {
  try {
    revalidatePath("/transport");
    revalidatePath("/transport/trips");
    revalidatePath("/transport/vehicles");
    revalidatePath("/transport/drivers");
    revalidatePath("/organization");
    revalidatePath("/organization/requests");
    revalidatePath("/department");
    revalidatePath("/department/requests");
    revalidatePath("/driver");
    if (tripId) revalidatePath(`/transport/trips/${tripId}`);
    if (requestId) {
      revalidatePath(`/transport/trips/schedule/${requestId}`);
      revalidatePath(`/organization/requests/${requestId}`);
      revalidatePath(`/department/requests/${requestId}`);
    }
  } catch {
    // Ignore outside request context
  }
}

async function requireTransportManagerContext() {
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
    !TRANSPORT_MANAGERS.includes(user.role) ||
    !user.organizationId ||
    !user.organization ||
    user.organization.deletedAt !== null ||
    user.organization.status !== "ACTIVE"
  ) {
    return {
      ok: false as const,
      error: "Only authorized Transport Managers can schedule or reassign trips.",
    };
  }

  const actorName =
    [user.firstName, user.middleName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user.email ||
    "Transport Manager";

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

export async function scheduleOrReassignTrip(
  _prev: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  try {
    const authRes = await requireTransportManagerContext();
    if (!authRes.ok) return { error: authRes.error };
    const { ctx } = authRes;

    const requestId = String(formData.get("requestId") ?? "").trim();
    const vehicleId = String(formData.get("vehicleId") ?? "").trim();
    const driverId = String(formData.get("driverId") ?? "").trim();
    const scheduledStart = parseAddisDate(
      String(formData.get("scheduledStart") ?? ""),
    );
    const scheduledEnd = parseAddisDate(
      String(formData.get("scheduledEnd") ?? ""),
    );
    const dispatchNotes = String(formData.get("notes") ?? "")
      .trim()
      .slice(0, 800);

    if (!isUuid(requestId)) return { error: "Invalid transportation request ID." };
    if (!isUuid(vehicleId)) return { error: "Please select an eligible vehicle." };
    if (!isUuid(driverId)) return { error: "Please select an eligible driver." };
    if (!scheduledStart || !scheduledEnd) {
      return {
        error: "Please provide valid scheduled start and end dates/times.",
      };
    }
    if (scheduledEnd <= scheduledStart) {
      return {
        error: "Scheduled end time must be after the scheduled start time.",
      };
    }

    const { bufferedStart, bufferedEnd } = getBufferedWindow(
      scheduledStart,
      scheduledEnd,
      TURNAROUND_BUFFER_MINUTES,
    );

    const outcome = await prisma.$transaction(async (tx) => {
      // Lock Vehicle and Driver rows in deterministic order to prevent READ COMMITTED double-booking race conditions
      await tx.$executeRaw`
        SELECT id FROM vehicles
        WHERE id = ${vehicleId}::uuid AND organization_id = ${ctx.organizationId}::uuid
        FOR UPDATE
      `;
      await tx.$executeRaw`
        SELECT id FROM drivers
        WHERE id = ${driverId}::uuid AND organization_id = ${ctx.organizationId}::uuid
        FOR UPDATE
      `;

      const [request, vehicle, driver, existingTrip] = await Promise.all([
        tx.transportationRequest.findFirst({
          where: {
            id: requestId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          include: { department: { select: { name: true } } },
        }),
        tx.vehicle.findFirst({
          where: {
            id: vehicleId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          include: {
            maintenanceRecords: {
              where: {
                deletedAt: null,
                status: "SCHEDULED",
                maintenanceDate: {
                  gte: new Date(
                    Date.UTC(
                      scheduledStart.getUTCFullYear(),
                      scheduledStart.getUTCMonth(),
                      scheduledStart.getUTCDate(),
                    ),
                  ),
                  lte: new Date(
                    Date.UTC(
                      scheduledEnd.getUTCFullYear(),
                      scheduledEnd.getUTCMonth(),
                      scheduledEnd.getUTCDate(),
                      23,
                      59,
                      59,
                    ),
                  ),
                },
              },
              select: { title: true },
            },
            maintenanceSchedules: {
              where: { deletedAt: null, status: "SCHEDULED" },
              select: {
                title: true,
                nextServiceDate: true,
                nextServiceOdometer: true,
              },
            },
          },
        }),
        tx.driver.findFirst({
          where: {
            id: driverId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        }),
        tx.trip.findUnique({
          where: {
            organizationId_transportationRequestId: {
              organizationId: ctx.organizationId,
              transportationRequestId: requestId,
            },
          },
        }),
      ]);

      if (!request) {
        return {
          ok: false as const,
          error: "Transportation request not found.",
        };
      }
      if (request.status !== "APPROVED") {
        return {
          ok: false as const,
          error: `Only APPROVED requests can be scheduled (current status: ${request.status}).`,
        };
      }

      if (
        existingTrip &&
        (existingTrip.status === "IN_PROGRESS" ||
          existingTrip.status === "COMPLETED")
      ) {
        return {
          ok: false as const,
          error: `Cannot modify assignment because the trip is already ${existingTrip.status}.`,
        };
      }

      if (!vehicle || vehicle.status !== "ACTIVE") {
        return {
          ok: false as const,
          error: "Selected vehicle is not active or does not belong to your organization.",
        };
      }
      if (vehicle.availability === "UNAVAILABLE") {
        return {
          ok: false as const,
          error: `Vehicle ${vehicle.registrationNumber} is currently marked UNAVAILABLE.`,
        };
      }

      const meta = decodeSpecialRequirements(request.specialRequirements);
      const isCargoOverride = meta.vehiclePreference === "PICKUP_CARGO";
      if (
        vehicle.seatingCapacity !== null &&
        vehicle.seatingCapacity < request.passengerCount &&
        !isCargoOverride
      ) {
        return {
          ok: false as const,
          error: `Vehicle ${vehicle.registrationNumber} seats ${vehicle.seatingCapacity}, which is less than the requested ${request.passengerCount} passengers.`,
        };
      }

      if (vehicle.maintenanceRecords.length > 0) {
        return {
          ok: false as const,
          error: `Vehicle ${vehicle.registrationNumber} has scheduled maintenance (${vehicle.maintenanceRecords[0].title}) during this trip date.`,
        };
      }

      const currentOdo = vehicle.currentOdometer
        ? Number(vehicle.currentOdometer)
        : null;
      for (const sched of vehicle.maintenanceSchedules) {
        if (
          sched.nextServiceOdometer &&
          currentOdo !== null &&
          currentOdo >= Number(sched.nextServiceOdometer)
        ) {
          return {
            ok: false as const,
            error: `Vehicle ${vehicle.registrationNumber} is overdue for scheduled service (${sched.title} at ${Number(sched.nextServiceOdometer)} km).`,
          };
        }
      }

      if (!driver || driver.status !== "ACTIVE") {
        return {
          ok: false as const,
          error: "Selected driver is not active or does not belong to your organization.",
        };
      }

      if (driver.licenseExpiryDate) {
        const expEnd = new Date(driver.licenseExpiryDate);
        expEnd.setUTCHours(23, 59, 59, 999);
        if (expEnd.getTime() < scheduledEnd.getTime()) {
          return {
            ok: false as const,
            error: `Driver ${driver.firstName} ${driver.lastName}'s license (${driver.licenseNumber}) expires before the trip ends.`,
          };
        }
      }

      // Check overlapping SCHEDULED or IN_PROGRESS trips (including 30-min turnaround buffer)
      const [conflictingVehicleTrip, conflictingDriverTrip] = await Promise.all([
        tx.trip.findFirst({
          where: {
            organizationId: ctx.organizationId,
            vehicleId: vehicle.id,
            deletedAt: null,
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
            ...(existingTrip ? { id: { not: existingTrip.id } } : {}),
            scheduledStart: { lt: bufferedEnd },
            scheduledEnd: { gt: bufferedStart },
          },
          include: {
            transportationRequest: { select: { purpose: true, destination: true } },
          },
        }),
        tx.trip.findFirst({
          where: {
            organizationId: ctx.organizationId,
            driverId: driver.id,
            deletedAt: null,
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
            ...(existingTrip ? { id: { not: existingTrip.id } } : {}),
            scheduledStart: { lt: bufferedEnd },
            scheduledEnd: { gt: bufferedStart },
          },
          include: {
            transportationRequest: { select: { purpose: true, destination: true } },
          },
        }),
      ]);

      if (conflictingVehicleTrip) {
        return {
          ok: false as const,
          error: `Vehicle ${vehicle.registrationNumber} is already booked on "${conflictingVehicleTrip.transportationRequest.purpose}" (${formatAddisDateTime(conflictingVehicleTrip.scheduledStart)} – ${formatAddisDateTime(conflictingVehicleTrip.scheduledEnd)}, including 30m turnaround buffer).`,
        };
      }

      if (conflictingDriverTrip) {
        return {
          ok: false as const,
          error: `Driver ${driver.firstName} ${driver.lastName} is already assigned to "${conflictingDriverTrip.transportationRequest.purpose}" (${formatAddisDateTime(conflictingDriverTrip.scheduledStart)} – ${formatAddisDateTime(conflictingDriverTrip.scheduledEnd)}, including 30m turnaround buffer).`,
        };
      }

      const nowIso = formatAddisDateTime(new Date());
      const actionLabel = existingTrip
        ? existingTrip.status === "CANCELLED"
          ? "REACTIVATED_AND_SCHEDULED"
          : "REASSIGNED"
        : "SCHEDULED";

      const updatedNotes = appendTripHistoryEntry(
        existingTrip?.notes,
        {
          timestamp: nowIso,
          actor: ctx.actorName,
          action: actionLabel,
          detail: `Vehicle ${vehicle.registrationNumber}, Driver ${driver.firstName} ${driver.lastName} (${formatAddisDateTime(scheduledStart)} -> ${formatAddisDateTime(scheduledEnd)})`,
        },
        dispatchNotes,
      );

      const savedTrip = existingTrip
        ? await tx.trip.update({
            where: { id: existingTrip.id },
            data: {
              vehicleId: vehicle.id,
              driverId: driver.id,
              scheduledStart,
              scheduledEnd,
              status: "SCHEDULED",
              deletedAt: null,
              notes: updatedNotes,
            },
            select: { id: true },
          })
        : await tx.trip.create({
            data: {
              organizationId: ctx.organizationId,
              transportationRequestId: request.id,
              vehicleId: vehicle.id,
              driverId: driver.id,
              scheduledStart,
              scheduledEnd,
              status: "SCHEDULED",
              notes: updatedNotes,
            },
            select: { id: true },
          });

      // Clear any previous transportFlagReason on the request now that it is scheduled
      if (meta.transportFlagReason) {
        await tx.transportationRequest.update({
          where: { id: request.id },
          data: {
            specialRequirements: encodeSpecialRequirements({
              ...meta,
              transportFlagReason: "",
            }),
          },
        });
      }

      await tx.alert.create({
        data: {
          organizationId: ctx.organizationId,
          tripId: savedTrip.id,
          vehicleId: vehicle.id,
          driverId: driver.id,
          alertType: "TRIP_SCHEDULED",
          severity: "INFO",
          title: `Trip Scheduled: ${request.purpose}`.slice(0, 200),
          message: `${ctx.actorName} assigned ${vehicle.registrationNumber} and driver ${driver.firstName} ${driver.lastName} for ${request.department.name} (${request.origin} → ${request.destination}).`,
          status: "OPEN",
          occurredAt: new Date(),
        },
      });

      return { ok: true as const, tripId: savedTrip.id };
    });

    if (!outcome.ok) return { error: outcome.error };

    revalidateTripPaths(outcome.tripId, requestId);
    return {
      ok: true,
      tripId: outcome.tripId,
      message: "Trip scheduled and vehicle & driver assigned.",
    };
  } catch (err) {
    console.error("scheduleOrReassignTrip failed:", err);
    return {
      error: "Could not schedule trip due to a server or concurrency error. Please refresh and try again.",
    };
  }
}

export async function updateTripLifecycleStatus(
  _prev: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Session expired. Please sign in again." };
    }

    const tripId = String(formData.get("tripId") ?? "").trim();
    const targetStatus = String(formData.get("targetStatus") ?? "").trim() as
      | "IN_PROGRESS"
      | "COMPLETED"
      | "CANCELLED";
    const rawOdometer = String(formData.get("odometer") ?? "").trim();
    const statusNote = String(formData.get("statusNote") ?? "")
      .trim()
      .slice(0, 500);

    if (!isUuid(tripId)) return { error: "Invalid trip ID." };
    if (!["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(targetStatus)) {
      return { error: "Invalid target trip status." };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        deletedAt: true,
        organizationId: true,
      },
    });

    if (!user || user.deletedAt || user.status !== "ACTIVE" || !user.organizationId) {
      return { error: "Unauthorized user account." };
    }

    const actorName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.email ||
      "User";

    const outcome = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findFirst({
        where: {
          id: tripId,
          organizationId: user.organizationId!,
          deletedAt: null,
        },
        include: {
          driver: { select: { id: true, userId: true, firstName: true, lastName: true } },
          vehicle: { select: { id: true, registrationNumber: true, currentOdometer: true } },
          transportationRequest: { select: { id: true, purpose: true, origin: true, destination: true } },
        },
      });

      if (!trip) return { ok: false as const, error: "Trip not found." };

      const isManager = TRANSPORT_MANAGERS.includes(user.role);
      const isAssignedDriver =
        user.role === "DRIVER" && trip.driver.userId === user.id;

      if (!isManager && !isAssignedDriver) {
        return {
          ok: false as const,
          error: "Only a Transport Manager or the assigned driver can update this trip.",
        };
      }

      if (!canTransitionTripStatus(trip.status, targetStatus)) {
        return {
          ok: false as const,
          error: `Invalid transition from ${trip.status} to ${targetStatus}.`,
        };
      }

      const now = new Date();
      const nowLabel = formatAddisDateTime(now);

      if (targetStatus === "IN_PROGRESS") {
        const startOdo = rawOdometer ? Number(rawOdometer) : null;
        if (
          startOdo !== null &&
          (Number.isNaN(startOdo) || startOdo < 0 || startOdo > 9_999_999)
        ) {
          return {
            ok: false as const,
            error: "Please enter a valid starting odometer reading.",
          };
        }

        const updatedNotes = appendTripHistoryEntry(trip.notes, {
          timestamp: nowLabel,
          actor: actorName,
          action: "STARTED_TRIP",
          detail: `Trip started${startOdo !== null ? ` (Start Odometer: ${startOdo} km)` : ""}${statusNote ? ` — ${statusNote}` : ""}`,
        });

        await tx.trip.update({
          where: { id: trip.id },
          data: {
            status: "IN_PROGRESS",
            actualStart: now,
            ...(startOdo !== null
              ? { startOdometer: new Prisma.Decimal(startOdo) }
              : {}),
            notes: updatedNotes,
          },
        });

        // Mark Vehicle.availability = "ASSIGNED" when trip is actively IN_PROGRESS
        await tx.vehicle.update({
          where: { id: trip.vehicle.id },
          data: {
            availability: "ASSIGNED",
            ...(startOdo !== null
              ? { currentOdometer: new Prisma.Decimal(startOdo) }
              : {}),
          },
        });

        return {
          ok: true as const,
          requestId: trip.transportationRequest.id,
          message: "Trip marked IN_PROGRESS and vehicle marked ASSIGNED.",
        };
      }

      if (targetStatus === "COMPLETED") {
        const endOdo = rawOdometer ? Number(rawOdometer) : null;
        const startOdo = trip.startOdometer ? Number(trip.startOdometer) : null;

        if (
          endOdo !== null &&
          (Number.isNaN(endOdo) || endOdo < 0 || endOdo > 9_999_999)
        ) {
          return {
            ok: false as const,
            error: "Please enter a valid ending odometer reading.",
          };
        }
        if (endOdo !== null && startOdo !== null && endOdo < startOdo) {
          return {
            ok: false as const,
            error: `Ending odometer (${endOdo} km) cannot be less than starting odometer (${startOdo} km).`,
          };
        }

        const distanceKm =
          endOdo !== null && startOdo !== null
            ? Math.max(0, Number((endOdo - startOdo).toFixed(2)))
            : null;

        const updatedNotes = appendTripHistoryEntry(trip.notes, {
          timestamp: nowLabel,
          actor: actorName,
          action: "COMPLETED_TRIP",
          detail: `Trip completed${distanceKm !== null ? ` (${distanceKm} km)` : ""}${statusNote ? ` — ${statusNote}` : ""}`,
        });

        await tx.trip.update({
          where: { id: trip.id },
          data: {
            status: "COMPLETED",
            actualEnd: now,
            ...(endOdo !== null
              ? { endOdometer: new Prisma.Decimal(endOdo) }
              : {}),
            ...(distanceKm !== null
              ? { distanceKm: new Prisma.Decimal(distanceKm) }
              : {}),
            notes: updatedNotes,
          },
        });

        await tx.vehicle.update({
          where: { id: trip.vehicle.id },
          data: {
            availability: "AVAILABLE",
            ...(endOdo !== null
              ? { currentOdometer: new Prisma.Decimal(endOdo) }
              : {}),
          },
        });

        return {
          ok: true as const,
          requestId: trip.transportationRequest.id,
          message: "Trip marked COMPLETED and vehicle released to AVAILABLE.",
        };
      }

      // CANCELLED (or breakdown during IN_PROGRESS)
      if (statusNote.length < 5) {
        return {
          ok: false as const,
          error:
            "Please provide a clear reason (at least 5 characters) when cancelling a trip or reporting a breakdown.",
        };
      }

      const wasInProgress = trip.status === "IN_PROGRESS";
      const updatedNotes = appendTripHistoryEntry(trip.notes, {
        timestamp: nowLabel,
        actor: actorName,
        action: wasInProgress ? "BREAKDOWN_OR_ABORTED" : "CANCELLED_TRIP",
        detail: statusNote,
      });

      await tx.trip.update({
        where: { id: trip.id },
        data: {
          status: "CANCELLED",
          notes: updatedNotes,
        },
      });

      await tx.vehicle.update({
        where: { id: trip.vehicle.id },
        data: { availability: "AVAILABLE" },
      });

      await tx.alert.create({
        data: {
          organizationId: user.organizationId!,
          tripId: trip.id,
          vehicleId: trip.vehicle.id,
          driverId: trip.driver.id,
          alertType: wasInProgress
            ? "TRIP_BREAKDOWN_REPORTED"
            : "TRIP_DISPATCH_CANCELLED",
          severity: wasInProgress ? "CRITICAL" : "WARNING",
          title: `${wasInProgress ? "[BREAKDOWN] " : ""}Trip Cancelled: ${trip.transportationRequest.purpose}`.slice(
            0,
            200,
          ),
          message: `${actorName} cancelled trip for ${trip.transportationRequest.origin} → ${trip.transportationRequest.destination} (Vehicle ${trip.vehicle.registrationNumber}). Reason: ${statusNote}. Request returned to Awaiting Dispatch.`,
          status: "OPEN",
          occurredAt: now,
        },
      });

      return {
        ok: true as const,
        requestId: trip.transportationRequest.id,
        message:
          "Trip cancelled, vehicle released, and request returned to Awaiting Dispatch.",
      };
    });

    if (!outcome.ok) return { error: outcome.error };

    revalidateTripPaths(tripId, outcome.requestId);
    return {
      ok: true,
      tripId,
      message: outcome.message,
    };
  } catch (err) {
    console.error("updateTripLifecycleStatus failed:", err);
    return { error: "Failed to update trip status. Please try again." };
  }
}