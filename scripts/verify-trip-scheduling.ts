import assert from "node:assert/strict";
import {
  appendTripHistoryEntry,
  canTransitionTripStatus,
  evaluateDriverCandidate,
  evaluateVehicleCandidate,
  parseTripNotesAndHistory,
  resolveRecommendedVehicleForDriver,
  windowsOverlapWithBuffer,
} from "../lib/trip-scheduling";

async function runTripSchedulingVerification() {
  console.log(
    "=== VI-Fleet Trip Scheduling & Vehicle/Driver Assignment Verification ===",
  );

  // 1. Verify 30-Minute Turnaround Buffer Overlap Detection
  const tripAStart = new Date("2026-11-12T08:00:00Z");
  const tripAEnd = new Date("2026-11-12T12:00:00Z");

  assert.equal(
    windowsOverlapWithBuffer(
      new Date("2026-11-12T12:15:00Z"),
      new Date("2026-11-12T15:00:00Z"),
      tripAStart,
      tripAEnd,
      30,
    ),
    true,
  );

  assert.equal(
    windowsOverlapWithBuffer(
      new Date("2026-11-12T12:35:00Z"),
      new Date("2026-11-12T15:00:00Z"),
      tripAStart,
      tripAEnd,
      30,
    ),
    false,
  );
  console.log("✔ 30-minute turnaround buffer overlap detection verified.");

  // 2. Verify Vehicle Eligibility & Best-Fit Ranking
  const minibus15 = evaluateVehicleCandidate(
    {
      id: "v-minibus",
      registrationNumber: "ET-3-10101",
      make: "Toyota",
      model: "HiAce",
      vehicleType: "MINIBUS",
      status: "ACTIVE",
      availability: "AVAILABLE",
      seatingCapacity: 15,
      currentOdometer: 42000,
      overlappingTrips: [],
      scheduledMaintenances: [],
      weeklyTripCount: 1,
    },
    12,
    "MINIBUS",
  );

  const hilux20 = evaluateVehicleCandidate(
    {
      id: "v-hilux",
      registrationNumber: "ET-3-55555",
      make: "Toyota",
      model: "Hilux",
      vehicleType: "PICKUP",
      status: "ACTIVE",
      availability: "AVAILABLE",
      seatingCapacity: 16,
      currentOdometer: 22000,
      overlappingTrips: [],
      scheduledMaintenances: [],
      weeklyTripCount: 0,
    },
    12,
    "MINIBUS",
  );

  const smallSedan = evaluateVehicleCandidate(
    {
      id: "v-sedan",
      registrationNumber: "ET-3-30303",
      make: "Toyota",
      model: "Corolla",
      vehicleType: "SEDAN",
      status: "ACTIVE",
      availability: "AVAILABLE",
      seatingCapacity: 4,
      currentOdometer: 15000,
      overlappingTrips: [],
      scheduledMaintenances: [],
      weeklyTripCount: 0,
    },
    12,
    "MINIBUS",
  );

  assert.equal(minibus15.eligible, true);
  assert.equal(hilux20.eligible, true);
  assert.equal(smallSedan.eligible, false);
  console.log("✔ Vehicle capacity check and best-fit ranking verified.");

  // 3. Verify Driver Preferred Vehicle Auto-Recommendation (PR #34)
  const tripEnd = new Date("2026-11-20T18:00:00Z");
  const driverWithAvailablePreferred = evaluateDriverCandidate(
    {
      id: "d-1",
      firstName: "Dawit",
      lastName: "Alemu",
      phone: "+251911000111",
      licenseNumber: "LIC-9001",
      licenseExpiryDate: new Date("2027-05-01"),
      status: "ACTIVE",
      userId: "u-1",
      preferredVehicleId: "v-hilux",
      preferredVehicleLabel: "ET-3-55555 - Toyota Hilux (PICKUP)",
      overlappingTrips: [],
      weeklyTripCount: 1,
    },
    tripEnd,
  );

  const recAvailable = resolveRecommendedVehicleForDriver(
    driverWithAvailablePreferred,
    [minibus15, hilux20, smallSedan],
  );
  assert.equal(recAvailable.status, "PREFERRED_AVAILABLE");
  assert.equal(recAvailable.suggestedVehicleId, "v-hilux");

  const driverWithIneligiblePreferred = evaluateDriverCandidate(
    {
      id: "d-2",
      firstName: "Abebe",
      lastName: "Bikila",
      phone: "+251911000333",
      licenseNumber: "LIC-9003",
      licenseExpiryDate: new Date("2027-05-01"),
      status: "ACTIVE",
      userId: "u-2",
      preferredVehicleId: "v-sedan",
      preferredVehicleLabel: "ET-3-30303 - Toyota Corolla (SEDAN)",
      overlappingTrips: [],
      weeklyTripCount: 0,
    },
    tripEnd,
  );

  const recFallback = resolveRecommendedVehicleForDriver(
    driverWithIneligiblePreferred,
    [minibus15, hilux20, smallSedan],
  );
  assert.equal(recFallback.status, "PREFERRED_UNAVAILABLE");
  assert.equal(recFallback.suggestedVehicleId, "v-minibus");
  console.log(
    "✔ Driver preferred vehicle auto-suggestion and fallback verified (PR #34).",
  );

  // 4. Verify Trip State Machine Transitions
  assert.equal(canTransitionTripStatus("SCHEDULED", "IN_PROGRESS"), true);
  assert.equal(canTransitionTripStatus("SCHEDULED", "CANCELLED"), true);
  assert.equal(canTransitionTripStatus("SCHEDULED", "COMPLETED"), false);
  assert.equal(canTransitionTripStatus("IN_PROGRESS", "COMPLETED"), true);
  assert.equal(canTransitionTripStatus("IN_PROGRESS", "CANCELLED"), true);
  assert.equal(canTransitionTripStatus("COMPLETED", "CANCELLED"), false);
  console.log("✔ Trip lifecycle state machine verified.");

  // 5. Verify Trip Audit History Preservation
  const notes1 = appendTripHistoryEntry(
    null,
    {
      timestamp: "Nov 13, 2026, 9:00 AM",
      actor: "Transport Manager",
      action: "SCHEDULED",
      detail: "Vehicle ET-3-55555, Driver Dawit Alemu",
    },
    "Meet at Main Gate",
  );
  const parsed = parseTripNotesAndHistory(notes1);
  assert.equal(parsed.cleanNotes, "Meet at Main Gate");
  assert.equal(parsed.history.length, 1);
  console.log("✔ Trip audit history serialization and parsing verified.");

  console.log(
    "\nAll Trip Scheduling & Preferred Vehicle Recommendation checks passed!",
  );
}

runTripSchedulingVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});