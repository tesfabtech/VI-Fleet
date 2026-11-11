import assert from "node:assert/strict";
import test from "node:test";
import { validateVehicleForm } from "@/lib/vehicles/validation";

function vehicleForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    registrationNumber: " aa-12345 ",
    status: "ACTIVE",
    availability: "AVAILABLE",
    ...overrides,
  })) {
    formData.set(key, value);
  }
  return formData;
}

test("vehicle validation normalizes registration and accepts optional fields", () => {
  const result = validateVehicleForm(vehicleForm());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.registrationNumber, "AA-12345");
    assert.equal(result.value.status, "ACTIVE");
    assert.equal(result.value.availability, "AVAILABLE");
    assert.equal(result.value.currentOdometer, null);
  }
});

test("vehicle validation rejects missing registration and unsupported enums", () => {
  const result = validateVehicleForm(
    vehicleForm({
      registrationNumber: "",
      status: "BROKEN",
      availability: "FREE",
    }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.registrationNumber);
    assert.ok(result.errors.status);
    assert.ok(result.errors.availability);
  }
});

test("vehicle validation rejects malformed numeric vehicle details", () => {
  const result = validateVehicleForm(
    vehicleForm({
      year: "20xx",
      seatingCapacity: "0",
      currentOdometer: "-1",
    }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.year);
    assert.ok(result.errors.seatingCapacity);
    assert.ok(result.errors.currentOdometer);
  }
});

test("inactive and maintenance vehicles cannot be marked available", () => {
  const result = validateVehicleForm(
    vehicleForm({ status: "MAINTENANCE", availability: "AVAILABLE" }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.availability, /unavailable/);
  }
});
