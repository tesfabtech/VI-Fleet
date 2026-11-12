import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeCsvCell,
  buildReportCsv,
  calculateFuelEconomy,
  calculateCostPerKm,
} from "@/lib/reports/business-logic";
import {
  validateReportFilters,
  parseQuickDateRange,
  isValidReportType,
} from "@/lib/reports/validation";

test("isValidReportType checks valid report types", () => {
  assert.equal(isValidReportType("vehicle-usage"), true);
  assert.equal(isValidReportType("trip-history"), true);
  assert.equal(isValidReportType("driver-activity"), true);
  assert.equal(isValidReportType("maintenance"), true);
  assert.equal(isValidReportType("fuel-consumption"), true);
  assert.equal(isValidReportType("gps-geofence"), true);
  assert.equal(isValidReportType("unknown-type"), false);
  assert.equal(isValidReportType(null), false);
});

test("validateReportFilters applies defaults and clamps query limits", () => {
  const result = validateReportFilters({
    type: "unknown",
    limit: 9999,
  });

  assert.equal(result.type, "vehicle-usage");
  assert.equal(result.limit, 500); // Clamped to 500 for normal view

  const exportResult = validateReportFilters(
    { limit: 9999 },
    { isExport: true },
  );
  assert.equal(exportResult.limit, 1000); // Clamped to 1000 for export
});

test("validateReportFilters swaps reversed dates correctly", () => {
  const result = validateReportFilters({
    startDate: "2026-12-31",
    endDate: "2026-01-01",
  });

  assert.ok(result.startDate);
  assert.ok(result.endDate);
  assert.ok(result.startDate.getTime() <= result.endDate.getTime());
});

test("parseQuickDateRange correctly handles date bounds", () => {
  const fixedNow = new Date("2026-11-12T12:00:00.000Z");
  const sevenDays = parseQuickDateRange("7d", fixedNow);

  assert.ok(sevenDays.startDate);
  assert.ok(sevenDays.endDate);
  assert.equal(sevenDays.startDate.getHours(), 0);
  assert.equal(sevenDays.endDate.getHours(), 23);
  assert.equal(sevenDays.endDate.getMinutes(), 59);

  const diffDays = Math.floor(
    (sevenDays.endDate.getTime() - sevenDays.startDate.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  assert.equal(diffDays, 7);
});

test("escapeCsvCell protects against CSV formula injection", () => {
  assert.equal(escapeCsvCell("=SUM(A1:A10)"), "'=SUM(A1:A10)");
  assert.equal(escapeCsvCell("+12345"), "'+12345");
  assert.equal(escapeCsvCell("-CMD|' /C calc'!A0"), "'-CMD|' /C calc'!A0");
  assert.equal(escapeCsvCell("@admin"), "'@admin");
});

test("escapeCsvCell properly quotes cells containing commas, quotes, and newlines", () => {
  assert.equal(escapeCsvCell('Hello, "World"'), '"Hello, ""World"""');
  assert.equal(escapeCsvCell("Line1\nLine2"), '"Line1\nLine2"');
  assert.equal(escapeCsvCell("Simple Text"), "Simple Text");
  assert.equal(escapeCsvCell(null), "");
  assert.equal(escapeCsvCell(undefined), "");
});

test("buildReportCsv produces valid CSV with headers and rows", () => {
  const records = [
    {
      registrationNumber: "ET-4821",
      makeModel: "Toyota Hilux",
      year: 2024,
      status: "ACTIVE",
      availability: "AVAILABLE",
      fuelType: "Diesel",
      currentOdometer: 14250,
      seatingCapacity: 5,
      tripCount: 12,
      maintenanceCount: 2,
      fuelRecordCount: 8,
      createdAt: "2026-01-15",
    },
  ];

  const csv = buildReportCsv("vehicle-usage", records);
  const lines = csv.split("\r\n");

  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes("Plate Number"));
  assert.ok(lines[0].includes("Make & Model"));
  assert.ok(lines[1].includes("ET-4821"));
  assert.ok(lines[1].includes("Toyota Hilux"));
  assert.ok(lines[1].includes("14250"));
});

test("calculateFuelEconomy and calculateCostPerKm validate edge cases", () => {
  assert.equal(calculateFuelEconomy(500, 50), 10);
  assert.equal(calculateFuelEconomy(0, 50), null);
  assert.equal(calculateFuelEconomy(500, 0), null);

  assert.equal(calculateCostPerKm(150, 1000), 0.15);
  assert.equal(calculateCostPerKm(0, 1000), null);
  assert.equal(calculateCostPerKm(150, 0), null);
});
