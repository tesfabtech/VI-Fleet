import { prisma } from "@/lib/prisma";
import {
  type AuthContext,
  type CreateInterruptionReportInput,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "./types";
import { requireDriverRole } from "./auth-context";
import { formatAddisDateTime } from "@/lib/department-auth";
import { appendTripHistoryEntry } from "@/lib/trip-scheduling";

const VALID_CATEGORIES = [
  "VEHICLE_BREAKDOWN",
  "ACCIDENT_OR_INCIDENT",
  "ROAD_BLOCKED",
  "WEATHER_CONDITIONS",
  "DRIVER_UNAVAILABLE",
  "PASSENGER_OR_CARGO_ISSUE",
  "OTHER",
];

export async function submitInterruptionReport(
  tripId: string,
  input: CreateInterruptionReportInput,
  authContext: AuthContext,
) {
  const driver = requireDriverRole(authContext);

  if (!input.category || !VALID_CATEGORIES.includes(input.category)) {
    throw new ValidationError(`Invalid interruption category: ${input.category}`);
  }

  const cleanDescription = (input.description ?? "").trim();
  if (cleanDescription.length < 5) {
    throw new ValidationError("Please provide a detailed description of the interruption (at least 5 characters).");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch trip
    const trip = await tx.trip.findFirst({
      where: {
        id: tripId,
        organizationId: authContext.organizationId,
        deletedAt: null,
      },
      include: {
        vehicle: {
          select: { id: true, registrationNumber: true },
        },
        transportationRequest: {
          select: { id: true, purpose: true, origin: true, destination: true },
        },
      },
    });

    if (!trip) {
      throw new NotFoundError("Trip not found.");
    }

    // 2. Assignment check
    if (trip.driverId !== driver.id) {
      throw new ForbiddenError("You are not the assigned driver for this trip.");
    }

    // 3. Status check: Only active trips can experience in-transit interruptions
    if (trip.status !== "IN_PROGRESS") {
      throw new ConflictError(`Cannot report an interruption for a trip in ${trip.status} status. Only IN_PROGRESS trips can report interruptions.`);
    }

    const now = new Date();

    // 4. Create TripInterruptionReport
    const report = await tx.tripInterruptionReport.create({
      data: {
        organizationId: authContext.organizationId,
        tripId: trip.id,
        reportedByDriverId: driver.id,
        category: input.category,
        description: cleanDescription,
        status: "PENDING_REVIEW",
        reportedAt: now,
      },
    });

    // 5. Append to legacy notes history (trip status itself remains IN_PROGRESS!)
    const updatedNotes = appendTripHistoryEntry(
      trip.notes,
      {
        timestamp: formatAddisDateTime(now),
        actor: authContext.userName,
        action: "INTERRUPTION_REPORTED",
        detail: `[${input.category}] ${cleanDescription}`,
      },
      null,
    );

    await tx.trip.update({
      where: { id: trip.id },
      data: { notes: updatedNotes },
    });

    // 6. Generate Alert for Transport Office
    const isCritical =
      input.category === "VEHICLE_BREAKDOWN" ||
      input.category === "ACCIDENT_OR_INCIDENT";

    await tx.alert.create({
      data: {
        organizationId: authContext.organizationId,
        tripId: trip.id,
        vehicleId: trip.vehicle.id,
        driverId: driver.id,
        alertType: "TRIP_INTERRUPTION_REPORTED",
        severity: isCritical ? "CRITICAL" : "WARNING",
        title: `Trip Interrupted (${input.category}): ${trip.transportationRequest.purpose}`.slice(0, 200),
        message: `Driver ${driver.firstName} ${driver.lastName} reported an interruption for trip ${trip.transportationRequest.origin} → ${trip.transportationRequest.destination} (Vehicle: ${trip.vehicle.registrationNumber}). Category: ${input.category}. Note: ${cleanDescription}. Trip remains IN_PROGRESS pending manager review.`,
        status: "OPEN",
        occurredAt: now,
      },
    });

    return report;
  });
}

export async function getTripInterruptionReports(
  tripId: string,
  authContext: AuthContext,
) {
  return await prisma.tripInterruptionReport.findMany({
    where: {
      tripId,
      organizationId: authContext.organizationId,
    },
    orderBy: { reportedAt: "desc" },
    include: {
      reportedByDriver: {
        select: { id: true, firstName: true, lastName: true },
      },
      reviewedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}
