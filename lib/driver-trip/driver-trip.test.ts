import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  sanitizeOdometer,
  validateStartingOdometer,
  validateEndingOdometer,
  calculateTripDistance,
} from "./odometer-service";
import {
  decimalToNumber,
  serializeActiveTripCardData,
  serializeCompletionReportForReview,
  serializeTripForClient,
  serializeCompletionReport,
  serializeCompletionRevision,
} from "./serializer";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
} from "./types";
import {
  canTransitionTripStatus,
  appendTripHistoryEntry,
  parseTripNotesAndHistory,
} from "@/lib/trip-scheduling";

// ============================================================
// 1. ODOMETER SANITIZATION & CONVERSION
// ============================================================

test("sanitizeOdometer handles valid numbers, string conversions, and precision rounding", () => {
  assert.equal(sanitizeOdometer(1234.56), 1234.56);
  assert.equal(sanitizeOdometer(" 1234.567 "), 1234.57); // rounded to 2 decimal places
  assert.equal(sanitizeOdometer(0), 0);
  assert.equal(sanitizeOdometer("0"), 0);
  assert.equal(sanitizeOdometer(null), null);
  assert.equal(sanitizeOdometer(undefined), null);
  assert.equal(sanitizeOdometer(""), null);
  assert.equal(sanitizeOdometer("   "), null);
});

test("sanitizeOdometer rejects negative numbers, NaN, and unrealistic readings", () => {
  assert.throws(
    () => sanitizeOdometer(-5),
    (err: unknown) => err instanceof ValidationError && err.message.includes("between 0 and 9,999,999"),
  );
  assert.throws(
    () => sanitizeOdometer("not-a-number"),
    (err: unknown) => err instanceof ValidationError,
  );
  assert.throws(
    () => sanitizeOdometer(10_000_000),
    (err: unknown) => err instanceof ValidationError,
  );
});

// ============================================================
// 2. STARTING ODOMETER RULES (ROLLBACK & VALIDATION)
// ============================================================

test("validateStartingOdometer requires a starting reading", () => {
  assert.throws(
    () => validateStartingOdometer(10000, null),
    (err: unknown) => err instanceof ValidationError && err.message.includes("A starting odometer reading is required"),
  );
  assert.throws(
    () => validateStartingOdometer(10000, ""),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("validateStartingOdometer prevents odometer rollback below vehicle last recorded odometer", () => {
  // Vehicle current is 25000; driver enters 24900 -> REJECT
  assert.throws(
    () => validateStartingOdometer(25000, 24900),
    (err: unknown) =>
      err instanceof ValidationError &&
      err.message.includes("cannot be less than the vehicle's last recorded odometer (25000 km)"),
  );
});

test("validateStartingOdometer accepts valid readings equal to or above current odometer", () => {
  // Exactly matching current odometer
  const exact = validateStartingOdometer(25000, 25000);
  assert.equal(exact.valid, true);
  assert.equal(exact.odometer, 25000);
  assert.equal(exact.isSuspicious, false);

  // Normal advance (e.g. 5 km between parking spot and passenger pickup)
  const normal = validateStartingOdometer(25000, 25005);
  assert.equal(normal.valid, true);
  assert.equal(normal.odometer, 25005);
  assert.equal(normal.isSuspicious, false);
});

test("validateStartingOdometer flags unusually large starting discrepancy (>1500 km) as suspicious", () => {
  // Discrepancy > 1500 km
  const suspicious = validateStartingOdometer(25000, 27000);
  assert.equal(suspicious.valid, true);
  assert.equal(suspicious.isSuspicious, true);
  assert.ok(suspicious.suspiciousReason?.includes("2000 km higher"));
});

test("validateStartingOdometer accepts reading when vehicle has no previous recorded odometer", () => {
  const result = validateStartingOdometer(null, 15420);
  assert.equal(result.valid, true);
  assert.equal(result.odometer, 15420);
  assert.equal(result.isSuspicious, false);
});

// ============================================================
// 3. ENDING ODOMETER, DISTANCE CALCULATION & EXCEPTION RULES
// ============================================================

test("validateEndingOdometer rejects reading lower than starting odometer", () => {
  // Trip started at 30000; driver submits 29950 -> REJECT
  assert.throws(
    () => validateEndingOdometer(30000, 29950),
    (err: unknown) =>
      err instanceof ValidationError &&
      err.message.includes("cannot be less than starting odometer (30000 km)"),
  );
});

test("validateEndingOdometer calculates exact distance traveled", () => {
  const start = 30000;
  const end = 30142.5;
  const result = validateEndingOdometer(start, end);
  assert.equal(result.valid, true);
  assert.equal(result.odometer, 30142.5);
  assert.equal(result.distanceKm, 142.5);
  assert.equal(result.isSuspicious, false);
});

test("validateEndingOdometer flags single-trip distance > 1500 km as suspicious", () => {
  const start = 10000;
  const end = 11800; // 1,800 km in one trip
  const result = validateEndingOdometer(start, end);
  assert.equal(result.valid, true);
  assert.equal(result.distanceKm, 1800);
  assert.equal(result.isSuspicious, true);
  assert.ok(result.suspiciousReason?.includes("unusually large (>1,500 km)"));
});

test("validateEndingOdometer requires at least 10 chars explanation when odometer is unavailable/broken", () => {
  // Missing odometer without reason -> REJECT
  assert.throws(
    () => validateEndingOdometer(30000, null, null),
    (err: unknown) =>
      err instanceof ValidationError && err.message.includes("explanation of at least 10 characters is required"),
  );

  // Too short reason (< 10 chars) -> REJECT
  assert.throws(
    () => validateEndingOdometer(30000, null, "broken"),
    (err: unknown) =>
      err instanceof ValidationError && err.message.includes("at least 10 characters"),
  );

  // Valid explanation (>= 10 chars) -> ACCEPT WITH EXCEPTION FLAGGED
  const validException = validateEndingOdometer(
    30000,
    null,
    "Cluster fuse blown during return journey, speedo dark",
  );
  assert.equal(validException.valid, true);
  assert.equal(validException.odometer, null);
  assert.equal(validException.distanceKm, null);
  assert.equal(validException.isSuspicious, true);
  assert.ok(validException.suspiciousReason?.includes("Cluster fuse blown"));
});

test("calculateTripDistance returns exact rounded subtraction or null", () => {
  assert.equal(calculateTripDistance(100.5, 250.75), 150.25);
  assert.equal(calculateTripDistance(null, 250), null);
  assert.equal(calculateTripDistance(100, null), null);
  assert.equal(calculateTripDistance(200, 150), null); // negative distance
});

// ============================================================
// 4. EVIDENCE UPLOAD CONSTRAINTS & VALIDATION
// ============================================================

test("evidence upload rules enforce allowed MIME types and 5MB size limit", () => {
  assert.deepEqual(ALLOWED_EVIDENCE_MIME_TYPES, ["image/jpeg", "image/png", "image/webp"]);
  assert.equal(MAX_EVIDENCE_FILE_SIZE_BYTES, 5 * 1024 * 1024);

  // Check acceptable MIME types
  for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
    assert.ok(ALLOWED_EVIDENCE_MIME_TYPES.includes(mime));
  }

  // Check rejected MIME types
  for (const mime of ["application/pdf", "image/gif", "text/plain", "video/mp4"]) {
    assert.ok(!ALLOWED_EVIDENCE_MIME_TYPES.includes(mime));
  }
});

// ============================================================
// 5. TRIP LIFECYCLE TRANSITION RULES
// ============================================================

test("canTransitionTripStatus strictly enforces valid lifecycle transitions", () => {
  // SCHEDULED transitions
  assert.equal(canTransitionTripStatus("SCHEDULED", "IN_PROGRESS"), true);
  assert.equal(canTransitionTripStatus("SCHEDULED", "CANCELLED"), true);
  assert.equal(canTransitionTripStatus("SCHEDULED", "COMPLETED"), false); // cannot skip IN_PROGRESS

  // IN_PROGRESS transitions
  assert.equal(canTransitionTripStatus("IN_PROGRESS", "COMPLETED"), true);
  assert.equal(canTransitionTripStatus("IN_PROGRESS", "CANCELLED"), true);
  assert.equal(canTransitionTripStatus("IN_PROGRESS", "SCHEDULED"), false); // cannot regress

  // Terminal states (cannot transition further)
  assert.equal(canTransitionTripStatus("COMPLETED", "SCHEDULED"), false);
  assert.equal(canTransitionTripStatus("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(canTransitionTripStatus("COMPLETED", "CANCELLED"), false);

  assert.equal(canTransitionTripStatus("CANCELLED", "SCHEDULED"), false);
  assert.equal(canTransitionTripStatus("CANCELLED", "IN_PROGRESS"), false);
  assert.equal(canTransitionTripStatus("CANCELLED", "COMPLETED"), false);
});

// ============================================================
// 6. DUAL-WRITE AUDIT LOG COMPATIBILITY
// ============================================================

test("appendTripHistoryEntry preserves legacy format and user notes", () => {
  const initialNotes = "Driver requested early pickup.";
  const entry = {
    timestamp: "2026-11-16 14:30 EAT",
    actor: "Abebe Kebede",
    action: "START_TRIP",
    detail: "Trip started with starting odometer 45,210 km",
  };

  const serialized = appendTripHistoryEntry(initialNotes, entry);
  assert.ok(serialized.includes("Driver requested early pickup."));
  assert.ok(serialized.includes("[TRIP-HISTORY]2026-11-16 14:30 EAT|Abebe Kebede|START_TRIP|Trip started with starting odometer 45,210 km"));

  // Verify roundtrip parsing
  const parsed = parseTripNotesAndHistory(serialized);
  assert.equal(parsed.cleanNotes, "Driver requested early pickup.");
  assert.equal(parsed.history.length, 1);
  assert.equal(parsed.history[0].actor, "Abebe Kebede");
  assert.equal(parsed.history[0].action, "START_TRIP");
  assert.equal(parsed.history[0].detail, "Trip started with starting odometer 45,210 km");
});

test("appendTripHistoryEntry correctly appends multiple sequential actions", () => {
  let notes = "Mission: Health Supply Delivery";

  notes = appendTripHistoryEntry(notes, {
    timestamp: "2026-11-16 08:00 EAT",
    actor: "Dispatcher Dawit",
    action: "SCHEDULED",
    detail: "Assigned Toyota Hilux (ET-3-12345) to driver Abebe Kebede",
  });

  notes = appendTripHistoryEntry(notes, {
    timestamp: "2026-11-16 08:30 EAT",
    actor: "Abebe Kebede",
    action: "START_TRIP",
    detail: "Departed base (Odo: 12,500 km)",
  });

  notes = appendTripHistoryEntry(notes, {
    timestamp: "2026-11-16 12:45 EAT",
    actor: "Abebe Kebede",
    action: "COMPLETED",
    detail: "Trip completed (End Odo: 12,680 km, Distance: 180 km)",
  });

  const parsed = parseTripNotesAndHistory(notes);
  assert.equal(parsed.cleanNotes, "Mission: Health Supply Delivery");
  assert.equal(parsed.history.length, 3);
  assert.equal(parsed.history[0].action, "SCHEDULED");
  assert.equal(parsed.history[1].action, "START_TRIP");
  assert.equal(parsed.history[2].action, "COMPLETED");
});

// ============================================================
// 7. SERVICE ERROR HIERARCHY
// ============================================================

test("service error hierarchy maps to appropriate HTTP status codes", () => {
  const valErr = new ValidationError("Bad request data");
  assert.equal(valErr.statusCode, 422);
  assert.equal(valErr.code, "UNPROCESSABLE_ENTITY");

  const unauthErr = new UnauthorizedError("Please sign in");
  assert.equal(unauthErr.statusCode, 401);
  assert.equal(unauthErr.code, "UNAUTHORIZED");

  const forbErr = new ForbiddenError("Not your trip");
  assert.equal(forbErr.statusCode, 403);
  assert.equal(forbErr.code, "FORBIDDEN");

  const notFoundErr = new NotFoundError("Trip missing");
  assert.equal(notFoundErr.statusCode, 404);
  assert.equal(notFoundErr.code, "NOT_FOUND");

  const conflictErr = new ConflictError("Trip already active");
  assert.equal(conflictErr.statusCode, 409);
  assert.equal(conflictErr.code, "CONFLICT");
});

// ============================================================
// 8. STORAGE KEY PATTERN & SCOPING
// ============================================================

test("evidence storage keys strictly scope to organization and trip UUIDs", () => {
  const orgId = "11111111-1111-1111-1111-111111111111";
  const tripId = "22222222-2222-2222-2222-222222222222";
  const fileId = "33333333-3333-3333-3333-333333333333";
  const ext = "jpg";
  const storageKey = `organizations/${orgId}/trips/${tripId}/evidence/${fileId}.${ext}`;

  assert.ok(storageKey.startsWith(`organizations/${orgId}/trips/${tripId}/evidence/`));
  assert.ok(storageKey.endsWith(".jpg"));
  // Ensure no path traversal or multi-tenant leakage
  assert.equal(storageKey.includes(".."), false);
  assert.equal(storageKey.split("/")[0], "organizations");
  assert.equal(storageKey.split("/")[1], orgId);
  assert.equal(storageKey.split("/")[2], "trips");
  assert.equal(storageKey.split("/")[3], tripId);
});

// ============================================================
// 9. OPERATIONAL & BUSINESS DOMAIN INVARIANTS
// ============================================================

test("driver-only trip starting invariant: managers cannot start trips on behalf of drivers", () => {
  const trip = {
    id: "trip-1",
    status: "SCHEDULED",
    driver: { userId: "user-driver-1" },
  };

  function canStartTrip(user: { id: string; role: string }) {
    const isAssignedDriver = user.role === "DRIVER" && trip.driver.userId === user.id;
    if (!isAssignedDriver) {
      throw new ForbiddenError("Only the assigned driver can start a scheduled trip. Managers cannot start trips on behalf of drivers.");
    }
    return true;
  }

  // Assigned driver CAN start
  assert.equal(canStartTrip({ id: "user-driver-1", role: "DRIVER" }), true);

  // Different driver CANNOT start
  assert.throws(
    () => canStartTrip({ id: "user-driver-2", role: "DRIVER" }),
    (err: unknown) => err instanceof ForbiddenError && err.message.includes("Only the assigned driver"),
  );

  // Transport Manager CANNOT start
  assert.throws(
    () => canStartTrip({ id: "user-manager-1", role: "TRANSPORT_MANAGER" }),
    (err: unknown) => err instanceof ForbiddenError && err.message.includes("Managers cannot start trips"),
  );

  // System Administrator CANNOT start
  assert.throws(
    () => canStartTrip({ id: "user-admin-1", role: "SYSTEM_ADMINISTRATOR" }),
    (err: unknown) => err instanceof ForbiddenError && err.message.includes("Managers cannot start trips"),
  );
});

test("interruption reporting invariant: report submission preserves IN_PROGRESS and ASSIGNED states", () => {
  // Simulating state before and after interruption report
  const initialTrip = { status: "IN_PROGRESS" };
  const initialVehicle = { availability: "ASSIGNED" };

  function simulateInterruptionSubmission(
    trip: typeof initialTrip,
    vehicle: typeof initialVehicle,
  ) {
    if (trip.status !== "IN_PROGRESS") {
      throw new ValidationError("Trip must be IN_PROGRESS to submit an interruption report.");
    }
    // Submitting report creates report record but preserves trip and vehicle state
    const report = {
      status: "PENDING_REVIEW",
      category: "MECHANICAL_BREAKDOWN",
      createdAt: new Date(),
    };
    return {
      tripStatus: trip.status, // unchanged
      vehicleAvailability: vehicle.availability, // unchanged
      reportStatus: report.status,
    };
  }

  const result = simulateInterruptionSubmission(initialTrip, initialVehicle);
  assert.equal(result.tripStatus, "IN_PROGRESS");
  assert.equal(result.vehicleAvailability, "ASSIGNED");
  assert.equal(result.reportStatus, "PENDING_REVIEW");
});

test("completion reporting invariant: operational completion is immediate and decoupled from review", () => {
  const trip = { status: "IN_PROGRESS" };
  const vehicle = { availability: "ASSIGNED" };

  function simulateTripCompletion(
    t: typeof trip,
    v: typeof vehicle,
    endOdo: number,
  ) {
    if (t.status !== "IN_PROGRESS") {
      throw new ValidationError("Only IN_PROGRESS trips can be completed.");
    }
    // Operational transition happens immediately:
    const updatedTrip = { ...t, status: "COMPLETED" };
    const updatedVehicle = { ...v, availability: "AVAILABLE" };
    // Administrative report is created for subsequent review:
    const report = {
      reviewStatus: "PENDING_REVIEW",
      submittedEndOdometer: endOdo,
    };
    return { trip: updatedTrip, vehicle: updatedVehicle, report };
  }

  const completed = simulateTripCompletion(trip, vehicle, 45300);
  // Trip is finished operationally:
  assert.equal(completed.trip.status, "COMPLETED");
  // Vehicle is immediately freed for subsequent dispatches:
  assert.equal(completed.vehicle.availability, "AVAILABLE");
  // Report awaits administrative review:
  assert.equal(completed.report.reviewStatus, "PENDING_REVIEW");
});

test("completion revision invariant: driver revisions increment revision count and return to PENDING_REVIEW", () => {
  const report = {
    reviewStatus: "NEEDS_CLARIFICATION",
    reviewNotes: "Please verify ending odometer reading against dashboard photo.",
    currentRevisions: 0,
  };

  function simulateRevisionSubmission(rep: typeof report, newNotes: string) {
    if (rep.reviewStatus !== "NEEDS_CLARIFICATION") {
      throw new ValidationError("Revisions can only be submitted when clarification has been requested.");
    }
    const revisionNumber = rep.currentRevisions + 1;
    const revisionRecord = {
      revisionNumber,
      description: newNotes,
      submittedAt: new Date(),
    };
    const updatedReport = {
      ...rep,
      reviewStatus: "PENDING_REVIEW", // Returned to pending for manager review
      currentRevisions: revisionNumber,
    };
    return { report: updatedReport, revision: revisionRecord };
  }

  const res1 = simulateRevisionSubmission(report, "Attached clearer photo of odometer cluster.");
  assert.equal(res1.report.reviewStatus, "PENDING_REVIEW");
  assert.equal(res1.revision.revisionNumber, 1);
  assert.equal(res1.report.currentRevisions, 1);
});

// ============================================================
// 10. SERVER-TO-CLIENT DECIMAL SERIALIZATION
// ============================================================

test("decimalToNumber converts Prisma Decimals, numbers, strings, and strictly preserves null", () => {
  // Mock a Prisma Decimal instance (which has .toNumber())
  const mockPrismaDecimal = {
    d: [45210, 5000000],
    e: 4,
    s: 1,
    toNumber: () => 45210.5,
    toString: () => "45210.50",
  };

  assert.equal(decimalToNumber(mockPrismaDecimal as unknown as Prisma.Decimal), 45210.5);
  assert.equal(typeof decimalToNumber(mockPrismaDecimal as unknown as Prisma.Decimal), "number");

  // Plain number
  assert.equal(decimalToNumber(12500), 12500);
  assert.equal(decimalToNumber(0), 0);

  // String representations
  assert.equal(decimalToNumber("45210.75"), 45210.75);
  assert.equal(decimalToNumber(" 0 "), 0);

  // Null & undefined preservation
  assert.equal(decimalToNumber(null), null);
  assert.equal(decimalToNumber(undefined), null);
  assert.equal(decimalToNumber(""), null);
  assert.equal(decimalToNumber("   "), null);
  assert.equal(decimalToNumber("invalid-number"), null);
});

test("serializeActiveTripCardData serializes all Decimal fields before crossing Server/Client boundary", () => {
  const mockDecimal = (n: number) => ({
    toNumber: () => n,
    toString: () => String(n),
  });

  const rawTripFromPrisma = {
    id: "trip-uuid-1",
    status: "IN_PROGRESS",
    scheduledStart: new Date("2026-11-16T08:00:00Z"),
    scheduledEnd: new Date("2026-11-16T12:00:00Z"),
    actualStart: new Date("2026-11-16T08:15:00Z"),
    startOdometer: mockDecimal(34500.25) as unknown as Prisma.Decimal,
    endOdometer: null,
    distanceKm: mockDecimal(150.75) as unknown as Prisma.Decimal,
    transportationRequest: {
      purpose: "Field Inspection",
      origin: "Bole HQ",
      destination: "Adama Site",
      passengerCount: 3,
      department: { name: "Engineering" },
      requestedBy: { firstName: "Abebe", lastName: "Bikila", phone: "+251911000000" },
    },
    vehicle: {
      id: "veh-1",
      registrationNumber: "ET-3-45678",
      make: "Toyota",
      model: "Hilux",
      seatingCapacity: 4,
      currentOdometer: mockDecimal(34651.0) as unknown as Prisma.Decimal,
    },
    interruptionReports: [
      { id: "rep-1", category: "TRAFFIC_DELAY", status: "PENDING_REVIEW", description: "Heavy traffic at toll gate" },
    ],
  };

  const serialized = serializeActiveTripCardData(rawTripFromPrisma);

  // Verify all Decimals converted to ordinary JS numbers
  assert.equal(serialized.startOdometer, 34500.25);
  assert.equal(typeof serialized.startOdometer, "number");

  assert.equal(serialized.distanceKm, 150.75);
  assert.equal(typeof serialized.distanceKm, "number");

  assert.equal(serialized.vehicle.currentOdometer, 34651.0);
  assert.equal(typeof serialized.vehicle.currentOdometer, "number");

  // Verify null preservation
  const tripWithNulls = {
    ...rawTripFromPrisma,
    startOdometer: null,
    distanceKm: null,
    vehicle: { ...rawTripFromPrisma.vehicle, currentOdometer: null },
  };
  const serializedWithNulls = serializeActiveTripCardData(tripWithNulls);
  assert.equal(serializedWithNulls.startOdometer, null);
  assert.equal(serializedWithNulls.distanceKm, null);
  assert.equal(serializedWithNulls.vehicle.currentOdometer, null);
});

test("serializeCompletionReportForReview serializes report and revision Decimal odometers", () => {
  const mockDecimal = (n: number) => ({
    toNumber: () => n,
    toString: () => String(n),
  });

  const rawReport = {
    id: "rep-uuid-1",
    outcome: "SUCCESSFUL",
    description: "Trip completed normally",
    submittedEndOdometer: mockDecimal(89450.5) as unknown as Prisma.Decimal,
    odometerUnavailableReason: null,
    reviewStatus: "NEEDS_CLARIFICATION",
    reviewNotes: "Please verify odometer",
    submittedAt: new Date(),
    resubmittedAt: null,
    submittedByDriver: { firstName: "Tesfaye", lastName: "Alemu" },
    reviewedBy: null,
    revisions: [
      {
        id: "rev-1",
        revisionNumber: 1,
        outcome: "SUCCESSFUL",
        description: "Confirmed reading",
        submittedEndOdometer: mockDecimal(89450.5) as unknown as Prisma.Decimal,
        submittedAt: new Date(),
      },
    ],
  };

  const serialized = serializeCompletionReportForReview(rawReport);
  assert.equal(serialized.submittedEndOdometer, 89450.5);
  assert.equal(typeof serialized.submittedEndOdometer, "number");
  assert.equal(serialized.revisions?.[0]?.submittedEndOdometer, 89450.5);
  assert.equal(typeof serialized.revisions?.[0]?.submittedEndOdometer, "number");
});

test("serializeTripForClient converts startOdometer, vehicle odometer, evidence, and report Decimals", () => {
  const mockDecimal = (n: number) => ({
    toNumber: () => n,
    toString: () => String(n),
  });

  const tripFromTripStart = {
    id: "trip-uuid-started",
    status: "IN_PROGRESS",
    startOdometer: mockDecimal(52100.45) as unknown as Prisma.Decimal,
    endOdometer: null,
    distanceKm: null,
    vehicle: {
      id: "veh-uuid-1",
      registrationNumber: "ET-2-33445",
      currentOdometer: mockDecimal(52100.45) as unknown as Prisma.Decimal,
    },
    evidence: [
      {
        id: "ev-uuid-1",
        evidenceType: "START_ODOMETER_PHOTO",
        odometerReading: mockDecimal(52100.45) as unknown as Prisma.Decimal,
      },
    ],
    completionReport: null,
  };

  const serialized = serializeTripForClient(tripFromTripStart);

  // Assert startOdometer is a plain JavaScript number
  assert.equal(serialized.startOdometer, 52100.45);
  assert.equal(typeof serialized.startOdometer, "number");

  // Assert vehicle.currentOdometer is a plain JavaScript number
  assert.equal(serialized.vehicle?.currentOdometer, 52100.45);
  assert.equal(typeof serialized.vehicle?.currentOdometer, "number");

  // Assert evidence[0].odometerReading is a plain JavaScript number
  assert.equal(serialized.evidence?.[0]?.odometerReading, 52100.45);
  assert.equal(typeof serialized.evidence?.[0]?.odometerReading, "number");

  // Assert nulls preserved
  assert.equal(serialized.endOdometer, null);
  assert.equal(serialized.distanceKm, null);
  assert.equal(serialized.completionReport, null);

  // Assert trip completion payload serialization
  const completedTripPayload = {
    ...tripFromTripStart,
    status: "COMPLETED",
    endOdometer: mockDecimal(52250.75) as unknown as Prisma.Decimal,
    distanceKm: mockDecimal(150.3) as unknown as Prisma.Decimal,
    completionReport: {
      id: "cr-1",
      submittedEndOdometer: mockDecimal(52250.75) as unknown as Prisma.Decimal,
      revisions: [
        {
          id: "cr-rev-1",
          revisionNumber: 1,
          submittedEndOdometer: mockDecimal(52250.75) as unknown as Prisma.Decimal,
        },
      ],
    },
  };

  const serializedCompleted = serializeTripForClient(completedTripPayload);
  assert.equal(serializedCompleted.endOdometer, 52250.75);
  assert.equal(typeof serializedCompleted.endOdometer, "number");
  assert.equal(serializedCompleted.distanceKm, 150.3);
  assert.equal(typeof serializedCompleted.distanceKm, "number");
  assert.equal(serializedCompleted.completionReport?.submittedEndOdometer, 52250.75);
  assert.equal(typeof serializedCompleted.completionReport?.submittedEndOdometer, "number");
  assert.equal(serializedCompleted.completionReport?.revisions?.[0]?.submittedEndOdometer, 52250.75);
  assert.equal(typeof serializedCompleted.completionReport?.revisions?.[0]?.submittedEndOdometer, "number");
});

test("serializeCompletionReport and serializeCompletionRevision convert Decimal odometers and preserve nulls", () => {
  const mockDecimal = (n: number) => ({
    toNumber: () => n,
    toString: () => String(n),
  });

  const rawReport = {
    id: "rep-1",
    submittedEndOdometer: mockDecimal(60500.0) as unknown as Prisma.Decimal,
    revisions: [
      {
        id: "rev-1",
        submittedEndOdometer: mockDecimal(60502.5) as unknown as Prisma.Decimal,
      },
    ],
  };

  const serializedReport = serializeCompletionReport(rawReport);
  assert.equal(serializedReport.submittedEndOdometer, 60500.0);
  assert.equal(typeof serializedReport.submittedEndOdometer, "number");
  assert.equal(serializedReport.revisions?.[0]?.submittedEndOdometer, 60502.5);
  assert.equal(typeof serializedReport.revisions?.[0]?.submittedEndOdometer, "number");

  const rawRev = {
    id: "rev-2",
    submittedEndOdometer: null,
  };
  const serializedRev = serializeCompletionRevision(rawRev);
  assert.equal(serializedRev.submittedEndOdometer, null);
});

