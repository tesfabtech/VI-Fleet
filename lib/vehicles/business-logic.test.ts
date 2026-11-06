import assert from "node:assert/strict";
import test from "node:test";
import { validateVehicleTripState } from "@/lib/vehicles/business-logic";

test("vehicles with active trips must remain active and assigned", () => {
  assert.deepEqual(
    validateVehicleTripState("ACTIVE", "ASSIGNED", 1),
    {},
  );
  assert.deepEqual(
    validateVehicleTripState("MAINTENANCE", "UNAVAILABLE", 1),
    {
      status: "Finish or cancel active trips before changing vehicle status.",
      availability: "This vehicle has an active trip and must remain assigned.",
    },
  );
  assert.ok(
    validateVehicleTripState("ACTIVE", "AVAILABLE", 1).availability,
  );
});

test("assigned availability requires an active trip", () => {
  assert.deepEqual(
    validateVehicleTripState("ACTIVE", "ASSIGNED", 0),
    {
      availability:
        "A vehicle becomes assigned through an active trip assignment.",
    },
  );
  assert.deepEqual(
    validateVehicleTripState("ACTIVE", "AVAILABLE", 0),
    {},
  );
});
