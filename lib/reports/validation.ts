export const REPORT_TYPES = [
  "vehicle-usage",
  "trip-history",
  "driver-activity",
  "maintenance",
  "fuel-consumption",
  "gps-geofence",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_METADATA: Record<
  ReportType,
  {
    title: string;
    description: string;
    badge: string;
  }
> = {
  "vehicle-usage": {
    title: "Vehicle Utilization & Usage",
    description:
      "Review vehicle assignments, operational statuses, mileage, and trip totals across the fleet.",
    badge: "Vehicles",
  },
  "trip-history": {
    title: "Trip History & Requisitions",
    description:
      "Audit transportation requisitions, passenger allocations, routes, and departure/arrival timestamps.",
    badge: "Trips",
  },
  "driver-activity": {
    title: "Driver Activity & Compliance",
    description:
      "Track driver assignments, license validity, contact details, and trip execution counts.",
    badge: "Drivers",
  },
  maintenance: {
    title: "Maintenance & Service Logs",
    description:
      "Examine maintenance interventions, scheduled repairs, odometer benchmarks, service providers, and costs.",
    badge: "Maintenance",
  },
  "fuel-consumption": {
    title: "Fuel Consumption & Expense Audit",
    description:
      "Analyze fuel purchases, volume in liters, unit prices, expense totals, and odometer readings.",
    badge: "Fuel",
  },
  "gps-geofence": {
    title: "GPS Telematics & Geofence Logs",
    description:
      "Inspect connected tracking hardware, last recorded pings, and perimeter breach events.",
    badge: "GPS & Telematics",
  },
};

export const QUICK_DATE_RANGES = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
  { id: "this-month", label: "This Month" },
] as const;

export type QuickDateRange = (typeof QUICK_DATE_RANGES)[number]["id"];

export type ReportFilterInput = {
  type?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  search?: string | null;
  status?: string | null;
  range?: string | null;
  limit?: string | number | null;
};

export type ValidatedReportFilter = {
  type: ReportType;
  startDate: Date | null;
  endDate: Date | null;
  search: string;
  status: string;
  range: QuickDateRange;
  limit: number;
};

export function isValidReportType(value: unknown): value is ReportType {
  return typeof value === "string" && REPORT_TYPES.includes(value as ReportType);
}

export function parseQuickDateRange(range: QuickDateRange, now = new Date()): {
  startDate: Date | null;
  endDate: Date | null;
} {
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: endOfDay };
    }
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: endOfDay };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: endOfDay };
    }
    case "90d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: endOfDay };
    }
    case "this-month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { startDate: start, endDate: endOfDay };
    }
    case "all":
    default:
      return { startDate: null, endDate: null };
  }
}

export function validateReportFilters(
  input: ReportFilterInput,
  options?: { isExport?: boolean },
): ValidatedReportFilter {
  const type: ReportType = isValidReportType(input.type)
    ? input.type
    : "vehicle-usage";

  const search = typeof input.search === "string" ? input.search.trim() : "";
  const status = typeof input.status === "string" ? input.status.trim() : "";

  let range: QuickDateRange = "all";
  if (
    input.range &&
    QUICK_DATE_RANGES.some((r) => r.id === input.range)
  ) {
    range = input.range as QuickDateRange;
  }

  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (input.startDate) {
    const parsed = new Date(input.startDate);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      startDate = parsed;
    }
  }

  if (input.endDate) {
    const parsed = new Date(input.endDate);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999);
      endDate = parsed;
    }
  }

  // If custom dates were not provided, use quick range if specified
  if (!startDate && !endDate && range !== "all") {
    const quick = parseQuickDateRange(range);
    startDate = quick.startDate;
    endDate = quick.endDate;
  }

  // Ensure startDate <= endDate if both are provided
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    const temp = startDate;
    startDate = endDate;
    endDate = temp;
  }

  const rawLimit = Number(input.limit);
  const defaultLimit = options?.isExport ? 1000 : 100;
  const maxLimit = options?.isExport ? 1000 : 500;

  let limit = defaultLimit;
  if (!isNaN(rawLimit) && rawLimit > 0) {
    limit = Math.min(rawLimit, maxLimit);
  }

  return {
    type,
    startDate,
    endDate,
    search,
    status,
    range,
    limit,
  };
}
