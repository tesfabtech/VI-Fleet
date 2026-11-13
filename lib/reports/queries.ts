import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ValidatedReportFilter } from "@/lib/reports/validation";

export type ReportKPI = {
  label: string;
  value: string | number;
  subtext?: string;
};

export type ReportResult<T = Record<string, unknown>> = {
  type: string;
  title: string;
  description: string;
  records: T[];
  totalCount: number;
  kpis: ReportKPI[];
  generatedAt: string;
  hasHardwareData?: boolean;
};

// 1. Vehicle Usage Report
export type VehicleUsageItem = {
  id: string;
  registrationNumber: string;
  makeModel: string;
  year: number | null;
  status: string;
  availability: string;
  fuelType: string | null;
  currentOdometer: number | null;
  seatingCapacity: number | null;
  tripCount: number;
  maintenanceCount: number;
  fuelRecordCount: number;
  createdAt: string;
};

export async function fetchVehicleUsageReport(
  organizationId: string,
  filter: ValidatedReportFilter,
): Promise<ReportResult<VehicleUsageItem>> {
  const where: Prisma.VehicleWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (filter.status) {
    where.status = filter.status as never;
  }

  if (filter.search) {
    where.OR = [
      { registrationNumber: { contains: filter.search, mode: "insensitive" } },
      { make: { contains: filter.search, mode: "insensitive" } },
      { model: { contains: filter.search, mode: "insensitive" } },
      { vehicleType: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  if (filter.startDate || filter.endDate) {
    where.createdAt = {};
    if (filter.startDate) where.createdAt.gte = filter.startDate;
    if (filter.endDate) where.createdAt.lte = filter.endDate;
  }

  const [vehicles, totalCount] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { registrationNumber: "asc" },
      take: filter.limit,
      include: {
        _count: {
          select: {
            trips: true,
            maintenanceRecords: true,
            fuelRecords: true,
          },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  let activeCount = 0;
  let availableCount = 0;
  let totalMileage = 0;

  const records: VehicleUsageItem[] = vehicles.map((v) => {
    if (v.status === "ACTIVE") activeCount++;
    if (v.availability === "AVAILABLE") availableCount++;
    const odo = v.currentOdometer ? Number(v.currentOdometer) : null;
    if (odo) totalMileage += odo;

    return {
      id: v.id,
      registrationNumber: v.registrationNumber,
      makeModel: [v.make, v.model].filter(Boolean).join(" ") || "N/A",
      year: v.year,
      status: v.status,
      availability: v.availability,
      fuelType: v.fuelType,
      currentOdometer: odo,
      seatingCapacity: v.seatingCapacity,
      tripCount: v._count.trips,
      maintenanceCount: v._count.maintenanceRecords,
      fuelRecordCount: v._count.fuelRecords,
      createdAt: v.createdAt.toISOString().slice(0, 10),
    };
  });

  const avgMileage =
    vehicles.length > 0 ? Math.round(totalMileage / vehicles.length) : 0;

  return {
    type: "vehicle-usage",
    title: "Vehicle Utilization & Usage Report",
    description:
      "Operational status, odometer tracking, and assigned trip counts for organization fleet.",
    records,
    totalCount,
    kpis: [
      { label: "Total Fleet Vehicles", value: totalCount },
      { label: "Active Status", value: activeCount, subtext: `${Math.round((activeCount / (totalCount || 1)) * 100)}% of fleet` },
      { label: "Available Now", value: availableCount },
      { label: "Avg Fleet Mileage", value: `${avgMileage.toLocaleString()} km` },
    ],
    generatedAt: new Date().toISOString(),
  };
}

// 2. Trip History Report
export type TripHistoryItem = {
  id: string;
  purpose: string;
  department: string;
  origin: string;
  destination: string;
  passengerCount: number;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  vehiclePlate: string;
  driverName: string;
  status: string;
  distanceKm: number | null;
};

export async function fetchTripHistoryReport(
  organizationId: string,
  filter: ValidatedReportFilter,
): Promise<ReportResult<TripHistoryItem>> {
  const where: Prisma.TripWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (filter.status) {
    where.status = filter.status as never;
  }

  if (filter.startDate || filter.endDate) {
    where.scheduledStart = {};
    if (filter.startDate) where.scheduledStart.gte = filter.startDate;
    if (filter.endDate) where.scheduledStart.lte = filter.endDate;
  }

  if (filter.search) {
    where.OR = [
      {
        transportationRequest: {
          purpose: { contains: filter.search, mode: "insensitive" },
        },
      },
      {
        transportationRequest: {
          destination: { contains: filter.search, mode: "insensitive" },
        },
      },
      {
        transportationRequest: {
          origin: { contains: filter.search, mode: "insensitive" },
        },
      },
      {
        vehicle: {
          registrationNumber: { contains: filter.search, mode: "insensitive" },
        },
      },
      {
        driver: {
          lastName: { contains: filter.search, mode: "insensitive" },
        },
      },
    ];
  }

  const [trips, totalCount] = await Promise.all([
    prisma.trip.findMany({
      where,
      orderBy: { scheduledStart: "desc" },
      take: filter.limit,
      include: {
        transportationRequest: {
          include: {
            department: { select: { name: true } },
          },
        },
        vehicle: { select: { registrationNumber: true } },
        driver: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  let completedCount = 0;
  let inProgressCount = 0;
  let scheduledCount = 0;
  let totalKm = 0;

  const records: TripHistoryItem[] = trips.map((t) => {
    if (t.status === "COMPLETED") completedCount++;
    if (t.status === "IN_PROGRESS") inProgressCount++;
    if (t.status === "SCHEDULED") scheduledCount++;
    const dist = t.distanceKm ? Number(t.distanceKm) : null;
    if (dist) totalKm += dist;

    return {
      id: t.id,
      purpose: t.transportationRequest?.purpose || "N/A",
      department: t.transportationRequest?.department?.name || "General",
      origin: t.transportationRequest?.origin || "N/A",
      destination: t.transportationRequest?.destination || "N/A",
      passengerCount: t.transportationRequest?.passengerCount ?? 0,
      scheduledStart: t.scheduledStart.toISOString().replace("T", " ").slice(0, 16),
      scheduledEnd: t.scheduledEnd.toISOString().replace("T", " ").slice(0, 16),
      actualStart: t.actualStart ? t.actualStart.toISOString().replace("T", " ").slice(0, 16) : null,
      actualEnd: t.actualEnd ? t.actualEnd.toISOString().replace("T", " ").slice(0, 16) : null,
      vehiclePlate: t.vehicle?.registrationNumber || "Unassigned",
      driverName: t.driver ? `${t.driver.firstName} ${t.driver.lastName}`.trim() : "Unassigned",
      status: t.status,
      distanceKm: dist,
    };
  });

  return {
    type: "trip-history",
    title: "Trip History & Requisition Report",
    description:
      "All logged and completed dispatches, passenger details, routes, and mileage.",
    records,
    totalCount,
    kpis: [
      { label: "Total Dispatched Trips", value: totalCount },
      { label: "Completed", value: completedCount },
      { label: "In Transit / Scheduled", value: inProgressCount + scheduledCount },
      { label: "Total Distance Recorded", value: `${totalKm.toLocaleString()} km` },
    ],
    generatedAt: new Date().toISOString(),
  };
}

// 3. Driver Activity Report
export type DriverActivityItem = {
  id: string;
  fullName: string;
  licenseNumber: string;
  licenseExpiryDate: string | null;
  phone: string | null;
  status: string;
  completedTrips: number;
  totalTrips: number;
};

export async function fetchDriverActivityReport(
  organizationId: string,
  filter: ValidatedReportFilter,
): Promise<ReportResult<DriverActivityItem>> {
  const where: Prisma.DriverWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (filter.status) {
    where.status = filter.status as never;
  }

  if (filter.search) {
    where.OR = [
      { firstName: { contains: filter.search, mode: "insensitive" } },
      { lastName: { contains: filter.search, mode: "insensitive" } },
      { licenseNumber: { contains: filter.search, mode: "insensitive" } },
      { phone: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  const [drivers, totalCount] = await Promise.all([
    prisma.driver.findMany({
      where,
      orderBy: { lastName: "asc" },
      take: filter.limit,
      include: {
        trips: {
          select: { status: true },
        },
      },
    }),
    prisma.driver.count({ where }),
  ]);

  let activeDrivers = 0;
  let totalDriverTrips = 0;

  const records: DriverActivityItem[] = drivers.map((d) => {
    if (d.status === "ACTIVE") activeDrivers++;
    const completed = d.trips.filter((t) => t.status === "COMPLETED").length;
    totalDriverTrips += d.trips.length;

    return {
      id: d.id,
      fullName: `${d.firstName} ${d.lastName}`.trim(),
      licenseNumber: d.licenseNumber,
      licenseExpiryDate: d.licenseExpiryDate
        ? d.licenseExpiryDate.toISOString().slice(0, 10)
        : null,
      phone: d.phone,
      status: d.status,
      completedTrips: completed,
      totalTrips: d.trips.length,
    };
  });

  return {
    type: "driver-activity",
    title: "Driver Activity & Performance Report",
    description: "Driver license status, trip fulfillment, and assigned tasks.",
    records,
    totalCount,
    kpis: [
      { label: "Total Drivers", value: totalCount },
      { label: "Active Drivers", value: activeDrivers },
      { label: "Total Trips Handled", value: totalDriverTrips },
      {
        label: "Avg Trips / Driver",
        value: totalCount > 0 ? (totalDriverTrips / totalCount).toFixed(1) : "0",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

// 4. Maintenance & Repair Report
export type MaintenanceReportItem = {
  id: string;
  title: string;
  vehiclePlate: string;
  maintenanceType: string;
  maintenanceDate: string;
  odometer: number | null;
  cost: number | null;
  serviceProvider: string | null;
  status: string;
};

export async function fetchMaintenanceReport(
  organizationId: string,
  filter: ValidatedReportFilter,
): Promise<ReportResult<MaintenanceReportItem>> {
  const where: Prisma.MaintenanceRecordWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (filter.status) {
    where.status = filter.status as never;
  }

  if (filter.startDate || filter.endDate) {
    where.maintenanceDate = {};
    if (filter.startDate) where.maintenanceDate.gte = filter.startDate;
    if (filter.endDate) where.maintenanceDate.lte = filter.endDate;
  }

  if (filter.search) {
    where.OR = [
      { title: { contains: filter.search, mode: "insensitive" } },
      { serviceProvider: { contains: filter.search, mode: "insensitive" } },
      {
        vehicle: {
          registrationNumber: { contains: filter.search, mode: "insensitive" },
        },
      },
    ];
  }

  const [records, totalCount] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      where,
      orderBy: { maintenanceDate: "desc" },
      take: filter.limit,
      include: {
        vehicle: { select: { registrationNumber: true } },
      },
    }),
    prisma.maintenanceRecord.count({ where }),
  ]);

  let totalCost = 0;
  let completedCount = 0;

  const mapped: MaintenanceReportItem[] = records.map((m) => {
    const cost = m.cost ? Number(m.cost) : null;
    if (cost) totalCost += cost;
    if (m.status === "COMPLETED") completedCount++;

    return {
      id: m.id,
      title: m.title,
      vehiclePlate: m.vehicle?.registrationNumber || "N/A",
      maintenanceType: m.maintenanceType,
      maintenanceDate: m.maintenanceDate.toISOString().slice(0, 10),
      odometer: m.odometer ? Number(m.odometer) : null,
      cost,
      serviceProvider: m.serviceProvider,
      status: m.status,
    };
  });

  return {
    type: "maintenance",
    title: "Maintenance & Repair Report",
    description:
      "All service interventions, workshop inspections, odometer logs, and maintenance expenditures.",
    records: mapped,
    totalCount,
    kpis: [
      { label: "Total Service Records", value: totalCount },
      { label: "Completed Services", value: completedCount },
      {
        label: "Total Service Expenditure",
        value: `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        label: "Avg Cost / Record",
        value: totalCount > 0 ? `$${(totalCost / totalCount).toFixed(2)}` : "$0.00",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

// 5. Fuel Consumption Report
export type FuelReportItem = {
  id: string;
  fuelDate: string;
  vehiclePlate: string;
  quantityLiters: number;
  pricePerLiter: number | null;
  totalCost: number | null;
  odometer: number | null;
  stationName: string | null;
  receiptNumber: string | null;
};

export async function fetchFuelReport(
  organizationId: string,
  filter: ValidatedReportFilter,
): Promise<ReportResult<FuelReportItem>> {
  const where: Prisma.FuelRecordWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (filter.startDate || filter.endDate) {
    where.fuelDate = {};
    if (filter.startDate) where.fuelDate.gte = filter.startDate;
    if (filter.endDate) where.fuelDate.lte = filter.endDate;
  }

  if (filter.search) {
    where.OR = [
      { stationName: { contains: filter.search, mode: "insensitive" } },
      { receiptNumber: { contains: filter.search, mode: "insensitive" } },
      {
        vehicle: {
          registrationNumber: { contains: filter.search, mode: "insensitive" },
        },
      },
    ];
  }

  const [records, totalCount] = await Promise.all([
    prisma.fuelRecord.findMany({
      where,
      orderBy: { fuelDate: "desc" },
      take: filter.limit,
      include: {
        vehicle: { select: { registrationNumber: true } },
      },
    }),
    prisma.fuelRecord.count({ where }),
  ]);

  let totalLiters = 0;
  let totalCost = 0;

  const mapped: FuelReportItem[] = records.map((f) => {
    const liters = Number(f.quantityLiters);
    const cost = f.totalCost ? Number(f.totalCost) : null;
    const price = f.pricePerLiter ? Number(f.pricePerLiter) : null;

    totalLiters += liters;
    if (cost) totalCost += cost;

    return {
      id: f.id,
      fuelDate: f.fuelDate.toISOString().replace("T", " ").slice(0, 16),
      vehiclePlate: f.vehicle?.registrationNumber || "N/A",
      quantityLiters: Number(liters.toFixed(2)),
      pricePerLiter: price ? Number(price.toFixed(2)) : null,
      totalCost: cost ? Number(cost.toFixed(2)) : null,
      odometer: f.odometer ? Number(f.odometer) : null,
      stationName: f.stationName,
      receiptNumber: f.receiptNumber,
    };
  });

  return {
    type: "fuel-consumption",
    title: "Fuel Consumption & Expense Report",
    description:
      "Fuel disbursement receipts, volume pumped, total cost, and mileage at fill-up.",
    records: mapped,
    totalCount,
    kpis: [
      { label: "Fuel Entries", value: totalCount },
      { label: "Total Liters Pumped", value: `${totalLiters.toFixed(1)} L` },
      {
        label: "Total Fuel Spend",
        value: `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        label: "Avg Cost / Liter",
        value: totalLiters > 0 ? `$${(totalCost / totalLiters).toFixed(2)}` : "$0.00",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

// 6. GPS & Geofence Activity Report
export type GpsGeofenceItem = {
  id: string;
  eventType: string;
  geofenceName: string;
  vehiclePlate: string;
  occurredAt: string;
};

export async function fetchGpsGeofenceReport(
  organizationId: string,
  filter: ValidatedReportFilter,
): Promise<ReportResult<GpsGeofenceItem>> {
  const [deviceCount, activeDeviceCount, events, totalEvents] = await Promise.all([
    prisma.gPSDevice.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.gPSDevice.count({
      where: { organizationId, status: "ACTIVE", deletedAt: null },
    }),
    prisma.geofenceEvent.findMany({
      where: {
        organizationId,
        ...(filter.startDate || filter.endDate
          ? {
              occurredAt: {
                ...(filter.startDate ? { gte: filter.startDate } : {}),
                ...(filter.endDate ? { lte: filter.endDate } : {}),
              },
            }
          : {}),
        ...(filter.search
          ? {
              OR: [
                {
                  geofence: {
                    name: { contains: filter.search, mode: "insensitive" },
                  },
                },
                {
                  vehicle: {
                    registrationNumber: {
                      contains: filter.search,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: filter.limit,
      include: {
        geofence: { select: { name: true } },
        vehicle: { select: { registrationNumber: true } },
      },
    }),
    prisma.geofenceEvent.count({ where: { organizationId } }),
  ]);

  const mapped: GpsGeofenceItem[] = events.map((e) => ({
    id: String(e.id),
    eventType: e.eventType,
    geofenceName: e.geofence?.name || "Perimeter",
    vehiclePlate: e.vehicle?.registrationNumber || "N/A",
    occurredAt: e.occurredAt.toISOString().replace("T", " ").slice(0, 16),
  }));

  const hasHardwareData = deviceCount > 0;

  return {
    type: "gps-geofence",
    title: "GPS Telematics & Geofence Logs",
    description:
      "Tracking hardware pairings, telemetry telemetry health, and geofence perimeter events.",
    records: mapped,
    totalCount: totalEvents,
    hasHardwareData,
    kpis: [
      { label: "Registered GPS Hardware", value: deviceCount },
      { label: "Active Telematics Units", value: activeDeviceCount },
      { label: "Total Geofence Alerts", value: totalEvents },
      { label: "Hardware Telemetry Status", value: hasHardwareData ? "Operational" : "Not Paired" },
    ],
    generatedAt: new Date().toISOString(),
  };
}

// Unified dispatcher
export async function fetchReportData(
  organizationId: string,
  filter: ValidatedReportFilter,
): Promise<ReportResult> {
  switch (filter.type) {
    case "trip-history":
      return fetchTripHistoryReport(organizationId, filter);
    case "driver-activity":
      return fetchDriverActivityReport(organizationId, filter);
    case "maintenance":
      return fetchMaintenanceReport(organizationId, filter);
    case "fuel-consumption":
      return fetchFuelReport(organizationId, filter);
    case "gps-geofence":
      return fetchGpsGeofenceReport(organizationId, filter);
    case "vehicle-usage":
    default:
      return fetchVehicleUsageReport(organizationId, filter);
  }
}
