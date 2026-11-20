import type { Prisma, TripStatus } from "@prisma/client";
import type { ActiveTripCardData } from "@/components/driver/active-trip-card";
import type { TripListItem } from "@/components/driver/trip-card";

/**
 * Converts a Prisma Decimal, number, numeric string, null, or undefined
 * to an ordinary JavaScript number or null.
 *
 * Requirements:
 * - Strictly converts Prisma Decimal objects via .toNumber()
 * - Preserves null and undefined as null
 * - Never returns NaN
 * - Does not use JSON.parse(JSON.stringify(...))
 */
export function decimalToNumber(
  val: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  // Check for Prisma Decimal (instance with .toNumber())
  if (
    typeof val === "object" &&
    val !== null &&
    "toNumber" in val &&
    typeof (val as { toNumber: () => number }).toNumber === "function"
  ) {
    return (val as { toNumber: () => number }).toNumber();
  }
  const str = String(val).trim();
  if (str === "") {
    return null;
  }
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts any raw Prisma Trip object (or nested trip) into a plain
 * JavaScript object ready for passing to the ActiveTripCard Client Component.
 *
 * Ensures all Decimal fields (startOdometer, distanceKm, vehicle.currentOdometer)
 * are serialized to plain JavaScript numbers (or null) on the server BEFORE
 * crossing the Server Component / Client Component boundary.
 */
export function serializeActiveTripCardData(trip: {
  id: string;
  status: TripStatus | string;
  scheduledStart: Date | string;
  scheduledEnd: Date | string;
  actualStart?: Date | string | null;
  startOdometer?: Prisma.Decimal | number | string | null;
  distanceKm?: Prisma.Decimal | number | string | null;
  transportationRequest: {
    purpose: string;
    origin: string;
    destination: string;
    passengerCount: number;
    department: { name: string };
    requestedBy?: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
    } | null;
  };
  vehicle: {
    id?: string;
    registrationNumber: string;
    make?: string | null;
    model?: string | null;
    seatingCapacity?: number | null;
    currentOdometer?: Prisma.Decimal | number | string | null;
  };
  interruptionReports?: Array<{
    id: string;
    category: string;
    status: string;
    description: string;
  }>;
}): ActiveTripCardData {
  return {
    id: trip.id,
    status: trip.status as ActiveTripCardData["status"],
    scheduledStart: trip.scheduledStart,
    scheduledEnd: trip.scheduledEnd,
    actualStart: trip.actualStart ?? null,
    startOdometer: decimalToNumber(trip.startOdometer),
    distanceKm: decimalToNumber(trip.distanceKm),
    transportationRequest: {
      purpose: trip.transportationRequest.purpose,
      origin: trip.transportationRequest.origin,
      destination: trip.transportationRequest.destination,
      passengerCount: trip.transportationRequest.passengerCount,
      department: {
        name: trip.transportationRequest.department.name,
      },
      requestedBy: trip.transportationRequest.requestedBy
        ? {
            firstName: trip.transportationRequest.requestedBy.firstName ?? null,
            lastName: trip.transportationRequest.requestedBy.lastName ?? null,
            phone: trip.transportationRequest.requestedBy.phone ?? null,
          }
        : null,
    },
    vehicle: {
      id: trip.vehicle.id,
      registrationNumber: trip.vehicle.registrationNumber,
      make: trip.vehicle.make ?? null,
      model: trip.vehicle.model ?? null,
      seatingCapacity: trip.vehicle.seatingCapacity ?? null,
      currentOdometer: decimalToNumber(trip.vehicle.currentOdometer),
    },
    interruptionReports: trip.interruptionReports?.map((r) => ({
      id: r.id,
      category: r.category,
      status: r.status,
      description: r.description,
    })),
  };
}

/**
 * Serializes a Trip list item for TripCard.
 */
export function serializeTripListItem(trip: {
  id: string;
  status: TripStatus;
  scheduledStart: Date | string;
  scheduledEnd: Date | string;
  actualStart?: Date | string | null;
  actualEnd?: Date | string | null;
  distanceKm?: Prisma.Decimal | number | string | null;
  transportationRequest: {
    purpose: string;
    origin: string;
    destination: string;
    department: { name: string };
  };
  vehicle: {
    registrationNumber: string;
    make?: string | null;
    model?: string | null;
  };
  completionReport?: {
    reviewStatus: string;
    outcome: string;
  } | null;
}): TripListItem {
  return {
    id: trip.id,
    status: trip.status,
    scheduledStart: trip.scheduledStart,
    scheduledEnd: trip.scheduledEnd,
    actualStart: trip.actualStart ?? null,
    actualEnd: trip.actualEnd ?? null,
    distanceKm: decimalToNumber(trip.distanceKm),
    transportationRequest: {
      purpose: trip.transportationRequest.purpose,
      origin: trip.transportationRequest.origin,
      destination: trip.transportationRequest.destination,
      department: {
        name: trip.transportationRequest.department.name,
      },
    },
    vehicle: {
      registrationNumber: trip.vehicle.registrationNumber,
      make: trip.vehicle.make ?? null,
      model: trip.vehicle.model ?? null,
    },
    completionReport: trip.completionReport
      ? {
          reviewStatus: trip.completionReport.reviewStatus,
          outcome: trip.completionReport.outcome,
        }
      : null,
  };
}

/**
 * Serializes a TripCompletionReport for ManagerCompletionReviewControl.
 * Converts submittedEndOdometer and revision odometers to plain numbers or null.
 */
export function serializeCompletionReportForReview<
  T extends {
    id: string;
    outcome: string;
    description?: string | null;
    submittedEndOdometer?: Prisma.Decimal | number | string | null;
    odometerUnavailableReason?: string | null;
    reviewStatus: string;
    reviewNotes?: string | null;
    submittedAt: Date | string;
    resubmittedAt?: Date | string | null;
    submittedByDriver?: { firstName: string; lastName: string } | null;
    reviewedBy?: { firstName?: string | null; lastName?: string | null } | null;
    revisions?: Array<{
      id: string;
      revisionNumber: number;
      outcome: string;
      description?: string | null;
      submittedEndOdometer?: Prisma.Decimal | number | string | null;
      submittedAt: Date | string;
    }>;
  },
>(report: T) {
  return {
    ...report,
    submittedEndOdometer: decimalToNumber(report.submittedEndOdometer),
    revisions: report.revisions?.map((rev) => ({
      ...rev,
      submittedEndOdometer: decimalToNumber(rev.submittedEndOdometer),
    })),
  };
}

/**
 * Serializes a TripCompletionReport to ensure submittedEndOdometer
 * and revisions are plain JavaScript numbers or null.
 */
export function serializeCompletionReport<
  T extends {
    submittedEndOdometer?: Prisma.Decimal | number | string | null;
    revisions?: Array<{
      submittedEndOdometer?: Prisma.Decimal | number | string | null;
      [key: string]: unknown;
    }> | null;
    [key: string]: unknown;
  },
>(report: T): T {
  if (!report) return report;
  return {
    ...report,
    submittedEndOdometer: decimalToNumber(report.submittedEndOdometer),
    revisions: report.revisions?.map((rev) => ({
      ...rev,
      submittedEndOdometer: decimalToNumber(rev.submittedEndOdometer),
    })),
  } as T;
}

/**
 * Serializes a TripCompletionReportRevision to ensure submittedEndOdometer
 * is a plain JavaScript number or null.
 */
export function serializeCompletionRevision<
  T extends {
    submittedEndOdometer?: Prisma.Decimal | number | string | null;
    [key: string]: unknown;
  },
>(rev: T): T {
  if (!rev) return rev;
  return {
    ...rev,
    submittedEndOdometer: decimalToNumber(rev.submittedEndOdometer),
  } as T;
}

/**
 * Generic serializer for Trip records before passing across the
 * Server Component / Client Component boundary or returning from Server Actions.
 *
 * Converts all Prisma Decimal fields (startOdometer, endOdometer, distanceKm,
 * vehicle.currentOdometer, evidence[].odometerReading, completionReport.submittedEndOdometer)
 * into ordinary JavaScript numbers or null.
 */
export function serializeTripForClient<
  T extends {
    startOdometer?: Prisma.Decimal | number | string | null;
    endOdometer?: Prisma.Decimal | number | string | null;
    distanceKm?: Prisma.Decimal | number | string | null;
    vehicle?: {
      currentOdometer?: Prisma.Decimal | number | string | null;
      [key: string]: unknown;
    } | null;
    evidence?: Array<{
      odometerReading?: Prisma.Decimal | number | string | null;
      [key: string]: unknown;
    }> | null;
    completionReport?: {
      submittedEndOdometer?: Prisma.Decimal | number | string | null;
      revisions?: Array<{
        submittedEndOdometer?: Prisma.Decimal | number | string | null;
        [key: string]: unknown;
      }> | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  },
>(trip: T): T {
  if (!trip) return trip;
  return {
    ...trip,
    startOdometer: decimalToNumber(trip.startOdometer),
    endOdometer: decimalToNumber(trip.endOdometer),
    distanceKm: decimalToNumber(trip.distanceKm),
    vehicle: trip.vehicle
      ? {
          ...trip.vehicle,
          currentOdometer: decimalToNumber(trip.vehicle.currentOdometer),
        }
      : trip.vehicle,
    evidence: trip.evidence?.map((ev) => ({
      ...ev,
      odometerReading: decimalToNumber(ev.odometerReading),
    })),
    completionReport: trip.completionReport
      ? {
          ...trip.completionReport,
          submittedEndOdometer: decimalToNumber(trip.completionReport.submittedEndOdometer),
          revisions: trip.completionReport.revisions?.map((rev) => ({
            ...rev,
            submittedEndOdometer: decimalToNumber(rev.submittedEndOdometer),
          })),
        }
      : trip.completionReport,
  } as T;
}
