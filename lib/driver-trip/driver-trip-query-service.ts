import { prisma } from "@/lib/prisma";
import type {
  TripStatus,
  TripInterruptionReportStatus,
  TripCompletionReviewStatus,
} from "@prisma/client";
import {
  type AuthContext,
  NotFoundError,
  ForbiddenError,
} from "./types";
import { requireDriverRole, requireTransportManagerRole } from "./auth-context";
import { decimalToNumber } from "./serializer";

export async function getDriverDashboardData(authContext: AuthContext) {
  const driver = requireDriverRole(authContext);

  const trips = await prisma.trip.findMany({
    where: {
      organizationId: authContext.organizationId,
      driverId: driver.id,
      deletedAt: null,
    },
    orderBy: { scheduledStart: "asc" },
    include: {
      vehicle: {
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
          vehicleType: true,
          seatingCapacity: true,
          currentOdometer: true,
        },
      },
      transportationRequest: {
        select: {
          id: true,
          purpose: true,
          origin: true,
          destination: true,
          passengerCount: true,
          specialRequirements: true,
          department: { select: { name: true } },
          requestedBy: {
            select: { firstName: true, lastName: true, phone: true },
          },
        },
      },
      completionReport: {
        select: {
          id: true,
          reviewStatus: true,
          outcome: true,
          reviewNotes: true,
        },
      },
      interruptionReports: {
        where: { status: { not: "RESOLVED" } },
        select: {
          id: true,
          category: true,
          status: true,
          description: true,
          reportedAt: true,
        },
      },
    },
  });

  const serializedTrips = trips.map((t) => ({
    ...t,
    startOdometer: decimalToNumber(t.startOdometer),
    endOdometer: decimalToNumber(t.endOdometer),
    distanceKm: decimalToNumber(t.distanceKm),
    vehicle: {
      ...t.vehicle,
      currentOdometer: decimalToNumber(t.vehicle.currentOdometer),
    },
  }));

  const activeTrip = serializedTrips.find((t) => t.status === "IN_PROGRESS") || null;
  const nextScheduledTrip = serializedTrips.find((t) => t.status === "SCHEDULED") || null;

  const scheduledTrips = serializedTrips.filter((t) => t.status === "SCHEDULED");
  const inProgressTrips = serializedTrips.filter((t) => t.status === "IN_PROGRESS");
  const completedTrips = serializedTrips.filter((t) => t.status === "COMPLETED").reverse();

  return {
    driver,
    activeTrip,
    nextScheduledTrip,
    counts: {
      scheduled: scheduledTrips.length,
      inProgress: inProgressTrips.length,
      completed: completedTrips.length,
      total: serializedTrips.length,
    },
    scheduledTrips,
    completedTrips: completedTrips.slice(0, 20),
  };
}

export async function getDriverTrips(
  authContext: AuthContext,
  options?: {
    status?: TripStatus;
    limit?: number;
    offset?: number;
  },
) {
  const driver = requireDriverRole(authContext);
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  const whereClause = {
    organizationId: authContext.organizationId,
    driverId: driver.id,
    deletedAt: null,
    ...(options?.status ? { status: options.status } : {}),
  };

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where: whereClause,
      orderBy: { scheduledStart: "desc" },
      take: limit,
      skip: offset,
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
            currentOdometer: true,
          },
        },
        transportationRequest: {
          select: {
            purpose: true,
            origin: true,
            destination: true,
            department: { select: { name: true } },
          },
        },
        completionReport: {
          select: {
            reviewStatus: true,
            outcome: true,
          },
        },
      },
    }),
    prisma.trip.count({ where: whereClause }),
  ]);

  const serializedTrips = trips.map((t) => ({
    ...t,
    startOdometer: decimalToNumber(t.startOdometer),
    endOdometer: decimalToNumber(t.endOdometer),
    distanceKm: decimalToNumber(t.distanceKm),
    vehicle: {
      ...t.vehicle,
      currentOdometer: decimalToNumber(t.vehicle.currentOdometer),
    },
  }));

  return { trips: serializedTrips, total, limit, offset };
}

export async function getDriverTripDetail(tripId: string, authContext: AuthContext) {
  const driver = requireDriverRole(authContext);

  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      organizationId: authContext.organizationId,
      deletedAt: null,
    },
    include: {
      vehicle: true,
      transportationRequest: {
        include: {
          department: { select: { name: true } },
          requestedBy: {
            select: { firstName: true, lastName: true, phone: true, email: true },
          },
        },
      },
      completionReport: {
        include: {
          revisions: {
            orderBy: { revisionNumber: "asc" },
          },
        },
      },
      interruptionReports: {
        orderBy: { reportedAt: "desc" },
      },
      evidence: {
        orderBy: { uploadedAt: "desc" },
        include: {
          uploadedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          changedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  if (!trip) {
    throw new NotFoundError("Trip assignment not found.");
  }

  if (trip.driverId !== driver.id) {
    throw new ForbiddenError("You are not assigned to this trip.");
  }

  return {
    ...trip,
    startOdometer: decimalToNumber(trip.startOdometer),
    endOdometer: decimalToNumber(trip.endOdometer),
    distanceKm: decimalToNumber(trip.distanceKm),
    vehicle: {
      ...trip.vehicle,
      currentOdometer: decimalToNumber(trip.vehicle.currentOdometer),
    },
    completionReport: trip.completionReport
      ? {
          ...trip.completionReport,
          submittedEndOdometer: decimalToNumber(trip.completionReport.submittedEndOdometer),
          revisions: trip.completionReport.revisions.map((rev) => ({
            ...rev,
            submittedEndOdometer: decimalToNumber(rev.submittedEndOdometer),
          })),
        }
      : null,
    evidence: trip.evidence.map((ev) => ({
      ...ev,
      odometerReading: decimalToNumber(ev.odometerReading),
    })),
  };
}

export async function getManagerInterruptionReports(
  authContext: AuthContext,
  options?: {
    status?: TripInterruptionReportStatus;
    limit?: number;
    offset?: number;
  },
) {
  requireTransportManagerRole(authContext);
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  const whereClause = {
    organizationId: authContext.organizationId,
    ...(options?.status ? { status: options.status } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.tripInterruptionReport.findMany({
      where: whereClause,
      orderBy: { reportedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        trip: {
          include: {
            vehicle: true,
            transportationRequest: { select: { purpose: true, origin: true, destination: true, department: { select: { name: true } } } },
          },
        },
        reportedByDriver: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        reviewedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.tripInterruptionReport.count({ where: whereClause }),
  ]);

  return { reports, total, limit, offset };
}

export async function getManagerCompletionReports(
  authContext: AuthContext,
  options?: {
    reviewStatus?: TripCompletionReviewStatus;
    limit?: number;
    offset?: number;
  },
) {
  requireTransportManagerRole(authContext);
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  const whereClause = {
    organizationId: authContext.organizationId,
    ...(options?.reviewStatus ? { reviewStatus: options.reviewStatus } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.tripCompletionReport.findMany({
      where: whereClause,
      orderBy: { submittedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        trip: {
          include: {
            vehicle: true,
            transportationRequest: { select: { purpose: true, origin: true, destination: true, department: { select: { name: true } } } },
            evidence: true,
          },
        },
        submittedByDriver: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        reviewedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        revisions: {
          orderBy: { revisionNumber: "asc" },
        },
      },
    }),
    prisma.tripCompletionReport.count({ where: whereClause }),
  ]);

  return { reports, total, limit, offset };
}
