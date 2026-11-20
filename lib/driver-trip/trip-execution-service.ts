import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type AuthContext,
  type StartTripInput,
  type CompleteTripInput,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "./types";
import { requireDriverRole } from "./auth-context";
import { validateStartingOdometer, validateEndingOdometer } from "./odometer-service";
import { recordTripStatusHistory } from "./history-service";
import { serializeTripForClient, serializeCompletionReport } from "./serializer";

export async function startTrip(
  tripId: string,
  input: StartTripInput,
  authContext: AuthContext,
) {
  const driver = requireDriverRole(authContext);

  return await prisma.$transaction(async (tx) => {
    // 1. Lock trip and fetch related entities
    const trip = await tx.trip.findFirst({
      where: {
        id: tripId,
        organizationId: authContext.organizationId,
        deletedAt: null,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            status: true,
            availability: true,
            currentOdometer: true,
          },
        },
        transportationRequest: {
          select: {
            id: true,
            purpose: true,
            origin: true,
            destination: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundError("Trip assignment not found.");
    }

    // 2. Ownership / Assignment check
    if (trip.driverId !== driver.id) {
      throw new ForbiddenError("You are not the assigned driver for this trip.");
    }

    // 3. Idempotency & state transition checks
    if (trip.status === "IN_PROGRESS") {
      const existingOdo = trip.startOdometer ? Number(trip.startOdometer) : null;
      if (existingOdo === input.startOdometer) {
        return { alreadyStarted: true, trip: serializeTripForClient(trip) };
      }
      throw new ConflictError("This trip is already in progress.");
    }

    if (trip.status === "COMPLETED" || trip.status === "CANCELLED") {
      throw new ConflictError(`Cannot start trip because it is already ${trip.status}.`);
    }

    if (trip.status !== "SCHEDULED") {
      throw new ConflictError(`Trip cannot be started from current status: ${trip.status}.`);
    }

    if (trip.vehicle.status !== "ACTIVE") {
      throw new ConflictError(`Vehicle ${trip.vehicle.registrationNumber} is not marked ACTIVE.`);
    }

    // 4. Validate starting odometer
    const odoResult = validateStartingOdometer(
      trip.vehicle.currentOdometer ? Number(trip.vehicle.currentOdometer) : null,
      input.startOdometer,
    );

    const now = new Date();
    const startOdoDecimal = new Prisma.Decimal(odoResult.odometer!);

    // 5. Dual-write structured history and legacy notes
    const updatedNotes = await recordTripStatusHistory({
      tx,
      organizationId: authContext.organizationId,
      tripId: trip.id,
      changedById: authContext.userId,
      actorName: authContext.userName,
      previousStatus: "SCHEDULED",
      newStatus: "IN_PROGRESS",
      actionLabel: "STARTED_TRIP",
      detail: `Started by ${authContext.userName}. Starting Odometer: ${odoResult.odometer} km${input.notes ? ` — ${input.notes}` : ""}`,
      reason: odoResult.suspiciousReason || undefined,
      existingNotes: trip.notes,
      userNote: input.notes,
    });

    // 6. Mutate Trip
    const updatedTrip = await tx.trip.update({
      where: { id: trip.id },
      data: {
        status: "IN_PROGRESS",
        actualStart: now,
        startOdometer: startOdoDecimal,
        notes: updatedNotes,
      },
      include: {
        vehicle: true,
        transportationRequest: true,
      },
    });

    // 7. Update Vehicle availability to ASSIGNED and update odometer if forward
    const vehicleCurrentOdo = trip.vehicle.currentOdometer
      ? Number(trip.vehicle.currentOdometer)
      : 0;
    const nextVehicleOdo = Math.max(vehicleCurrentOdo, odoResult.odometer!);

    await tx.vehicle.update({
      where: { id: trip.vehicle.id },
      data: {
        availability: "ASSIGNED",
        currentOdometer: new Prisma.Decimal(nextVehicleOdo),
      },
    });

    // 8. Generate Alert
    await tx.alert.create({
      data: {
        organizationId: authContext.organizationId,
        tripId: trip.id,
        vehicleId: trip.vehicle.id,
        driverId: driver.id,
        alertType: "TRIP_STARTED",
        severity: odoResult.isSuspicious ? "WARNING" : "INFO",
        title: `Trip Started: ${trip.transportationRequest.purpose}`.slice(0, 200),
        message: `${authContext.userName} started trip for ${trip.transportationRequest.department.name} (${trip.transportationRequest.origin} → ${trip.transportationRequest.destination}). Vehicle ${trip.vehicle.registrationNumber} (Odometer: ${odoResult.odometer} km).${odoResult.suspiciousReason ? ` Warning: ${odoResult.suspiciousReason}` : ""}`,
        status: "OPEN",
        occurredAt: now,
      },
    });

    return { alreadyStarted: false, trip: serializeTripForClient(updatedTrip) };
  });
}

export async function completeTrip(
  tripId: string,
  input: CompleteTripInput,
  authContext: AuthContext,
) {
  const driver = requireDriverRole(authContext);

  if (!input.outcome || !["SUCCESSFUL", "COMPLETED_WITH_ISSUES", "NOT_COMPLETED"].includes(input.outcome)) {
    throw new ValidationError("Valid completion outcome (SUCCESSFUL, COMPLETED_WITH_ISSUES, NOT_COMPLETED) is required.");
  }

  if (input.outcome !== "SUCCESSFUL" && (!input.description || input.description.trim().length < 5)) {
    throw new ValidationError("Please provide a description (at least 5 characters) explaining the issues or reason for non-completion.");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Trip
    const trip = await tx.trip.findFirst({
      where: {
        id: tripId,
        organizationId: authContext.organizationId,
        deletedAt: null,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            currentOdometer: true,
          },
        },
        transportationRequest: {
          select: {
            id: true,
            purpose: true,
            origin: true,
            destination: true,
            department: { select: { name: true } },
          },
        },
        completionReport: true,
      },
    });

    if (!trip) {
      throw new NotFoundError("Trip assignment not found.");
    }

    // 2. Authorization check
    if (trip.driverId !== driver.id) {
      throw new ForbiddenError("You are not the assigned driver for this trip.");
    }

    // 3. Idempotency check
    if (trip.status === "COMPLETED") {
      if (trip.completionReport) {
        return {
          alreadyCompleted: true,
          trip: serializeTripForClient(trip),
          completionReport: serializeCompletionReport(trip.completionReport),
        };
      }
      throw new ConflictError("This trip is already marked completed.");
    }

    if (trip.status !== "IN_PROGRESS") {
      throw new ConflictError(`Trip cannot be completed from status: ${trip.status}. Trip must be IN_PROGRESS.`);
    }

    // 4. Validate ending odometer and distance
    const startOdo = trip.startOdometer
      ? Number(trip.startOdometer)
      : trip.vehicle.currentOdometer
        ? Number(trip.vehicle.currentOdometer)
        : null;

    const odoResult = validateEndingOdometer(
      startOdo,
      input.endOdometer,
      input.odometerUnavailableReason,
    );

    const now = new Date();
    const endOdoDecimal = odoResult.odometer !== null ? new Prisma.Decimal(odoResult.odometer) : null;
    const distanceDecimal = odoResult.distanceKm !== null ? new Prisma.Decimal(odoResult.distanceKm) : null;

    // 5. Dual-write structured history and legacy notes
    const detailMsg = `Completed by ${authContext.userName} (${input.outcome}).${odoResult.odometer !== null ? ` Ending Odo: ${odoResult.odometer} km, Distance: ${odoResult.distanceKm} km.` : ` Odometer Unavailable (${input.odometerUnavailableReason}).`}${input.description ? ` Notes: ${input.description}` : ""}`;

    const updatedNotes = await recordTripStatusHistory({
      tx,
      organizationId: authContext.organizationId,
      tripId: trip.id,
      changedById: authContext.userId,
      actorName: authContext.userName,
      previousStatus: "IN_PROGRESS",
      newStatus: "COMPLETED",
      actionLabel: "COMPLETED_TRIP",
      detail: detailMsg,
      reason: odoResult.suspiciousReason || undefined,
      existingNotes: trip.notes,
      userNote: input.description,
    });

    // 6. Mutate Trip: Immediately becomes COMPLETED operationally
    const updatedTrip = await tx.trip.update({
      where: { id: trip.id },
      data: {
        status: "COMPLETED",
        actualEnd: now,
        endOdometer: endOdoDecimal,
        distanceKm: distanceDecimal,
        notes: updatedNotes,
      },
    });

    // 7. Mutate Vehicle: Immediately released to AVAILABLE operationally
    const vehicleCurrentOdo = trip.vehicle.currentOdometer
      ? Number(trip.vehicle.currentOdometer)
      : 0;
    const nextVehicleOdo = odoResult.odometer !== null
      ? Math.max(vehicleCurrentOdo, odoResult.odometer)
      : vehicleCurrentOdo;

    await tx.vehicle.update({
      where: { id: trip.vehicle.id },
      data: {
        availability: "AVAILABLE",
        ...(odoResult.odometer !== null ? { currentOdometer: new Prisma.Decimal(nextVehicleOdo) } : {}),
      },
    });

    // 8. Create TripCompletionReport (reviewStatus = PENDING_REVIEW)
    const completionReport = await tx.tripCompletionReport.create({
      data: {
        organizationId: authContext.organizationId,
        tripId: trip.id,
        submittedByDriverId: driver.id,
        outcome: input.outcome,
        description: input.description?.trim() || null,
        submittedEndOdometer: endOdoDecimal,
        odometerUnavailableReason: input.odometerUnavailableReason?.trim() || null,
        reviewStatus: "PENDING_REVIEW",
        submittedAt: now,
      },
    });

    // 9. Create Alert for Transport Managers
    const isWarning =
      input.outcome !== "SUCCESSFUL" ||
      odoResult.isSuspicious ||
      Boolean(input.odometerUnavailableReason);

    await tx.alert.create({
      data: {
        organizationId: authContext.organizationId,
        tripId: trip.id,
        vehicleId: trip.vehicle.id,
        driverId: driver.id,
        alertType: "TRIP_COMPLETED",
        severity: isWarning ? "WARNING" : "INFO",
        title: `Trip Completed (${input.outcome}): ${trip.transportationRequest.purpose}`.slice(0, 200),
        message: `${authContext.userName} completed trip for ${trip.transportationRequest.department.name}. Operational status: COMPLETED. Completion report submitted and awaiting manager review.${odoResult.suspiciousReason ? ` Note: ${odoResult.suspiciousReason}` : ""}`,
        status: "OPEN",
        occurredAt: now,
      },
    });

    return {
      alreadyCompleted: false,
      trip: serializeTripForClient(updatedTrip),
      completionReport: serializeCompletionReport(completionReport),
    };
  });
}
