import type { ReportType } from "@/lib/reports/validation";

/**
 * Escapes a cell value for RFC 4180 compliant CSV.
 * Protects against CSV injection attacks (cells starting with =, +, -, @, \t, \r).
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // CSV Injection defense:
  // If the cell begins with dangerous spreadsheet formula characters, prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If the cell contains quotes, commas, or newlines, quote the entire cell and escape quotes
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export type ReportColumnMapping = {
  header: string;
  key: string;
  format?: (val: unknown, record: Record<string, unknown>) => string;
};

export const CSV_COLUMN_CONFIG: Record<ReportType, ReportColumnMapping[]> = {
  "vehicle-usage": [
    { header: "Plate Number", key: "registrationNumber" },
    { header: "Make & Model", key: "makeModel" },
    { header: "Model Year", key: "year" },
    { header: "Operational Status", key: "status" },
    { header: "Availability", key: "availability" },
    { header: "Fuel Type", key: "fuelType" },
    {
      header: "Current Odometer (km)",
      key: "currentOdometer",
      format: (v) => (v !== null && v !== undefined ? String(v) : "0"),
    },
    { header: "Seating Capacity", key: "seatingCapacity" },
    { header: "Completed Trips", key: "tripCount" },
    { header: "Maintenance Records", key: "maintenanceCount" },
    { header: "Fuel Receipts", key: "fuelRecordCount" },
    { header: "Added Date", key: "createdAt" },
  ],
  "trip-history": [
    { header: "Trip ID", key: "id" },
    { header: "Purpose", key: "purpose" },
    { header: "Department", key: "department" },
    { header: "Origin", key: "origin" },
    { header: "Destination", key: "destination" },
    { header: "Passengers", key: "passengerCount" },
    { header: "Scheduled Start", key: "scheduledStart" },
    { header: "Scheduled End", key: "scheduledEnd" },
    { header: "Actual Departure", key: "actualStart" },
    { header: "Actual Arrival", key: "actualEnd" },
    { header: "Assigned Vehicle", key: "vehiclePlate" },
    { header: "Assigned Driver", key: "driverName" },
    { header: "Dispatch Status", key: "status" },
    {
      header: "Distance (km)",
      key: "distanceKm",
      format: (v) => (v !== null && v !== undefined ? String(v) : "0"),
    },
  ],
  "driver-activity": [
    { header: "Driver Name", key: "fullName" },
    { header: "License Number", key: "licenseNumber" },
    { header: "License Expiry", key: "licenseExpiryDate" },
    { header: "Phone", key: "phone" },
    { header: "Status", key: "status" },
    { header: "Completed Trips", key: "completedTrips" },
    { header: "Total Assigned Trips", key: "totalTrips" },
  ],
  maintenance: [
    { header: "Record ID", key: "id" },
    { header: "Service Title", key: "title" },
    { header: "Vehicle Plate", key: "vehiclePlate" },
    { header: "Maintenance Type", key: "maintenanceType" },
    { header: "Service Date", key: "maintenanceDate" },
    { header: "Odometer (km)", key: "odometer" },
    {
      header: "Cost ($)",
      key: "cost",
      format: (v) =>
        v !== null && v !== undefined ? Number(v).toFixed(2) : "0.00",
    },
    { header: "Service Provider", key: "serviceProvider" },
    { header: "Status", key: "status" },
  ],
  "fuel-consumption": [
    { header: "Record ID", key: "id" },
    { header: "Fuel Date", key: "fuelDate" },
    { header: "Vehicle Plate", key: "vehiclePlate" },
    {
      header: "Volume (Liters)",
      key: "quantityLiters",
      format: (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "0.00"),
    },
    {
      header: "Price / Liter ($)",
      key: "pricePerLiter",
      format: (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "N/A"),
    },
    {
      header: "Total Cost ($)",
      key: "totalCost",
      format: (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "0.00"),
    },
    { header: "Odometer (km)", key: "odometer" },
    { header: "Station Name", key: "stationName" },
    { header: "Receipt Number", key: "receiptNumber" },
  ],
  "gps-geofence": [
    { header: "Event ID", key: "id" },
    { header: "Event Type", key: "eventType" },
    { header: "Geofence Zone", key: "geofenceName" },
    { header: "Vehicle Plate", key: "vehiclePlate" },
    { header: "Timestamp", key: "occurredAt" },
  ],
};

/**
 * Builds a valid CSV string from report records according to the report type configuration.
 */
export function buildReportCsv(
  type: ReportType,
  records: Array<Record<string, unknown>>,
): string {
  const configs = CSV_COLUMN_CONFIG[type] ?? CSV_COLUMN_CONFIG["vehicle-usage"];

  // Header row
  const headerLine = configs.map((c) => escapeCsvCell(c.header)).join(",");

  // Data rows
  const rows = records.map((record) => {
    return configs
      .map((col) => {
        const rawVal = record[col.key];
        const formatted = col.format ? col.format(rawVal, record) : rawVal;
        return escapeCsvCell(formatted);
      })
      .join(",");
  });

  return [headerLine, ...rows].join("\r\n");
}

/**
 * Calculates fuel economy (km/L) if both distance and fuel consumption are given.
 */
export function calculateFuelEconomy(
  distanceKm: number,
  fuelLiters: number,
): number | null {
  if (fuelLiters <= 0 || distanceKm <= 0) return null;
  return Number((distanceKm / fuelLiters).toFixed(2));
}

/**
 * Calculates average maintenance cost per kilometer.
 */
export function calculateCostPerKm(
  totalCost: number,
  totalDistanceKm: number,
): number | null {
  if (totalDistanceKm <= 0 || totalCost <= 0) return null;
  return Number((totalCost / totalDistanceKm).toFixed(3));
}
