import assert from "node:assert/strict";
import test from "node:test";
import type { MaintenanceStatus } from "@prisma/client";
import { getMaintenanceScheduleAlert } from "@/lib/maintenance/business-logic";
import {
  validateMaintenanceRecord,
  validateMaintenanceSchedule,
} from "@/lib/maintenance/validation";

const activeSchedule = {
  status: "SCHEDULED" as MaintenanceStatus,
  deletedAt: null,
  nextServiceDate: null,
  nextServiceOdometer: null,
  currentOdometer: null,
};

test("date due rules include today and the 7-day upcoming boundary", () => {
  const now = new Date("2026-11-06T09:00:00.000Z");
  assert.equal(
    getMaintenanceScheduleAlert(
      { ...activeSchedule, nextServiceDate: new Date("2026-11-05T00:00:00.000Z") },
      now,
    ),
    "OVERDUE",
  );
  assert.equal(
    getMaintenanceScheduleAlert(
      { ...activeSchedule, nextServiceDate: new Date("2026-11-06T00:00:00.000Z") },
      now,
    ),
    "UPCOMING",
  );
  assert.equal(
    getMaintenanceScheduleAlert(
      { ...activeSchedule, nextServiceDate: new Date("2026-11-13T00:00:00.000Z") },
      now,
    ),
    "UPCOMING",
  );
  assert.equal(
    getMaintenanceScheduleAlert(
      { ...activeSchedule, nextServiceDate: new Date("2026-11-14T00:00:00.000Z") },
      now,
    ),
    null,
  );
});

test("mileage alerts use the 500 km window and require a current odometer", () => {
  const now = new Date("2026-11-06T09:00:00.000Z");
  assert.equal(
    getMaintenanceScheduleAlert(
      { ...activeSchedule, nextServiceOdometer: "10500", currentOdometer: "10000" },
      now,
    ),
    "UPCOMING",
  );
  assert.equal(
    getMaintenanceScheduleAlert(
      { ...activeSchedule, nextServiceOdometer: "10501", currentOdometer: "10000" },
      now,
    ),
    null,
  );
  assert.equal(
    getMaintenanceScheduleAlert(
      { ...activeSchedule, nextServiceOdometer: "10000", currentOdometer: "10000" },
      now,
    ),
    "OVERDUE",
  );
  assert.equal(
    getMaintenanceScheduleAlert(
      { ...activeSchedule, nextServiceOdometer: "10000" },
      now,
    ),
    null,
  );
});

test("either due condition wins, with overdue taking precedence over upcoming", () => {
  const now = new Date("2026-11-06T09:00:00.000Z");
  assert.equal(
    getMaintenanceScheduleAlert(
      {
        ...activeSchedule,
        nextServiceDate: new Date("2026-11-07T00:00:00.000Z"),
        nextServiceOdometer: "10000",
        currentOdometer: "10000",
      },
      now,
    ),
    "OVERDUE",
  );
});

test("completed, cancelled, and deleted schedules have no alert", () => {
  const now = new Date("2026-11-06T09:00:00.000Z");
  assert.equal(
    getMaintenanceScheduleAlert({
      ...activeSchedule,
      status: "COMPLETED",
      nextServiceDate: new Date("2026-11-05T00:00:00.000Z"),
    }, now),
    null,
  );
  assert.equal(
    getMaintenanceScheduleAlert({
      ...activeSchedule,
      status: "CANCELLED",
      nextServiceDate: new Date("2026-11-05T00:00:00.000Z"),
    }, now),
    null,
  );
  assert.equal(
    getMaintenanceScheduleAlert({
      ...activeSchedule,
      deletedAt: new Date(),
      nextServiceDate: new Date("2026-11-05T00:00:00.000Z"),
    }, now),
    null,
  );
});

function recordForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    vehicleId: "11111111-1111-4111-8111-111111111111",
    maintenanceType: "PREVENTIVE",
    title: "Oil service",
    maintenanceDate: "2026-11-06",
    status: "COMPLETED",
    ...overrides,
  })) {
    formData.set(key, value);
  }
  return formData;
}

test("record validation rejects missing required fields, invalid dates, and negative values", () => {
  assert.equal(
    validateMaintenanceRecord(recordForm({ title: "" })).ok,
    false,
  );
  assert.equal(
    validateMaintenanceRecord(recordForm({ maintenanceDate: "2026-02-30" })).ok,
    false,
  );
  const negative = validateMaintenanceRecord(
    recordForm({ odometer: "-1", cost: "-0.01" }),
  );
  assert.equal(negative.ok, false);
  if (!negative.ok) {
    assert.ok(negative.errors.odometer);
    assert.ok(negative.errors.cost);
  }
});

test("schedule validation requires an interval and derives next service targets", () => {
  const noInterval = new FormData();
  for (const [key, value] of Object.entries({
    vehicleId: "11111111-1111-4111-8111-111111111111",
    maintenanceType: "PREVENTIVE",
    title: "Oil service",
    status: "SCHEDULED",
  })) noInterval.set(key, value);
  assert.equal(validateMaintenanceSchedule(noInterval).ok, false);

  const withInterval = new FormData();
  for (const [key, value] of Object.entries({
    vehicleId: "11111111-1111-4111-8111-111111111111",
    maintenanceType: "PREVENTIVE",
    title: "Oil service",
    status: "SCHEDULED",
    intervalDays: "30",
    intervalKm: "5000",
    lastServiceDate: "2026-10-01",
    lastServiceOdometer: "10000",
  })) withInterval.set(key, value);

  const result = validateMaintenanceSchedule(withInterval);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.nextServiceDate?.toISOString().slice(0, 10), "2026-10-31");
    assert.equal(result.value.nextServiceOdometer, "15000.00");
  }
});
