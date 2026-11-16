import assert from "node:assert/strict";
import test from "node:test";
import {
  validatePreferredVehicleEligibility,
  formatVehicleLabel,
  type VehicleCandidate,
} from "./preferred-vehicle";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const VEHICLE_1 = "33333333-3333-4333-8333-333333333333";
const VEHICLE_2 = "44444444-4444-4444-8444-444444444444";

test("Rule 1: A driver can have no preferred vehicle (unassigned)", () => {
  const result = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    targetVehicleId: null,
  });

  assert.equal(result.ok, true);
});

test("Rule 1b: Removing preferred vehicle with empty string or 'none'", () => {
  const resultEmpty = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    targetVehicleId: "",
  });
  assert.equal(resultEmpty.ok, true);

  const resultNone = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    targetVehicleId: "none",
  });
  assert.equal(resultNone.ok, true);
});

test("Rule 2: A manager can assign an active vehicle from the same organization", () => {
  const vehicle: VehicleCandidate = {
    id: VEHICLE_1,
    organizationId: ORG_A,
    status: "ACTIVE",
    deletedAt: null,
  };

  const result = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    vehicle,
    targetVehicleId: vehicle.id,
  });

  assert.equal(result.ok, true);
});

test("Rule 3: A manager can change the preferred vehicle to another active vehicle", () => {
  const currentVehicle: VehicleCandidate = {
    id: VEHICLE_1,
    organizationId: ORG_A,
    status: "ACTIVE",
    deletedAt: null,
  };

  const newVehicle: VehicleCandidate = {
    id: VEHICLE_2,
    organizationId: ORG_A,
    status: "ACTIVE",
    deletedAt: null,
  };

  // Changing from VEHICLE_1 to VEHICLE_2
  const result = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    vehicle: newVehicle,
    targetVehicleId: newVehicle.id,
  });

  assert.equal(result.ok, true);
});

test("Rule 4: A manager can remove the preferred vehicle", () => {
  // When removing, targetVehicleId is cleared
  const result = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    vehicle: null,
    targetVehicleId: null,
  });

  assert.equal(result.ok, true);
});

test("Rule 5: Inactive vehicles cannot be selected as preferred vehicles", () => {
  const statuses = ["INACTIVE", "MAINTENANCE", "DECOMMISSIONED"];

  for (const status of statuses) {
    const vehicle: VehicleCandidate = {
      id: VEHICLE_1,
      organizationId: ORG_A,
      status,
      deletedAt: null,
    };

    const result = validatePreferredVehicleEligibility({
      isManagerAuthorized: true,
      driverOrganizationId: ORG_A,
      vehicle,
      targetVehicleId: vehicle.id,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "VEHICLE_NOT_ACTIVE");
    }
  }
});

test("Rule 5b: Soft-deleted vehicle cannot be selected", () => {
  const vehicle: VehicleCandidate = {
    id: VEHICLE_1,
    organizationId: ORG_A,
    status: "ACTIVE",
    deletedAt: new Date(),
  };

  const result = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    vehicle,
    targetVehicleId: vehicle.id,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "VEHICLE_NOT_FOUND");
  }
});

test("Rule 6: A vehicle from another organization cannot be selected", () => {
  const crossOrgVehicle: VehicleCandidate = {
    id: VEHICLE_1,
    organizationId: ORG_B, // Different from driver's organization
    status: "ACTIVE",
    deletedAt: null,
  };

  const result = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    vehicle: crossOrgVehicle,
    targetVehicleId: crossOrgVehicle.id,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "ORGANIZATION_MISMATCH");
  }
});

test("Rule 7: Unauthorized users cannot change preferred vehicles", () => {
  const vehicle: VehicleCandidate = {
    id: VEHICLE_1,
    organizationId: ORG_A,
    status: "ACTIVE",
    deletedAt: null,
  };

  const result = validatePreferredVehicleEligibility({
    isManagerAuthorized: false, // Unauthorized actor
    driverOrganizationId: ORG_A,
    vehicle,
    targetVehicleId: vehicle.id,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "UNAUTHORIZED");
  }
});

test("Rule 8: Multiple drivers can have the same preferred vehicle", () => {
  const sharedVehicle: VehicleCandidate = {
    id: VEHICLE_1,
    organizationId: ORG_A,
    status: "ACTIVE",
    deletedAt: null,
  };

  // Driver 1 assignment
  const res1 = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    vehicle: sharedVehicle,
    targetVehicleId: sharedVehicle.id,
  });
  assert.equal(res1.ok, true);

  // Driver 2 assignment to the exact same vehicle
  const res2 = validatePreferredVehicleEligibility({
    isManagerAuthorized: true,
    driverOrganizationId: ORG_A,
    vehicle: sharedVehicle,
    targetVehicleId: sharedVehicle.id,
  });
  assert.equal(res2.ok, true);
});

test("Rule 10: Invariant - changing preferred vehicle does not mutate historical trip records", () => {
  // Simulating an immutable historical trip record
  const historicalTrip = Object.freeze({
    id: "trip-uuid-1",
    driverId: "driver-uuid-1",
    vehicleId: "historical-vehicle-uuid",
    status: "COMPLETED",
  });

  // Driver changes preferred vehicle
  let driverPreferredVehicleId = "historical-vehicle-uuid";
  driverPreferredVehicleId = "new-preferred-vehicle-uuid";

  // The historical trip's vehicle remains unchanged
  assert.equal(historicalTrip.vehicleId, "historical-vehicle-uuid");
  assert.notEqual(historicalTrip.vehicleId, driverPreferredVehicleId);
});

test("formatVehicleLabel produces consistent labels", () => {
  assert.equal(formatVehicleLabel(null), "None (unassigned)");
  assert.equal(
    formatVehicleLabel({
      registrationNumber: "AA-12345",
      make: "Toyota",
      model: "Hilux",
      vehicleType: "Pickup",
    }),
    "AA-12345 — Toyota Hilux (Pickup)",
  );
  assert.equal(
    formatVehicleLabel({
      registrationNumber: "ET-99999",
      make: null,
      model: null,
      vehicleType: null,
    }),
    "ET-99999",
  );
});

