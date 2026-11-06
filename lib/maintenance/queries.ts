import "server-only";

import type {
  MaintenanceStatus,
  MaintenanceType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getMaintenanceScheduleAlert,
  MAINTENANCE_ALERT_THRESHOLDS,
} from "@/lib/maintenance/business-logic";

export const MAINTENANCE_PAGE_SIZE = 10;

export type RecordFilters = {
  search?: string;
  type?: MaintenanceType;
  vehicleId?: string;
  status?: MaintenanceStatus;
  from?: Date;
  to?: Date;
};

export type ScheduleFilters = {
  search?: string;
  type?: MaintenanceType;
  vehicleId?: string;
  status?: MaintenanceStatus;
};

export async function getMaintenanceDashboard(organizationId: string) {
  const [totalRecords, scheduledRecords, recentRecords, schedules, recentSchedules] =
    await Promise.all([
      prisma.maintenanceRecord.count({
        where: { organizationId, deletedAt: null },
      }),
      prisma.maintenanceRecord.count({
        where: {
          organizationId,
          deletedAt: null,
          status: "SCHEDULED",
        },
      }),
      prisma.maintenanceRecord.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: [{ maintenanceDate: "desc" }, { createdAt: "desc" }],
        take: 5,
        include: {
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              make: true,
              model: true,
            },
          },
        },
      }),
      prisma.maintenanceSchedule.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: "SCHEDULED",
        },
        select: {
          status: true,
          deletedAt: true,
          nextServiceDate: true,
          nextServiceOdometer: true,
          vehicle: { select: { currentOdometer: true } },
        },
      }),
      prisma.maintenanceSchedule.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: [{ nextServiceDate: "asc" }, { createdAt: "desc" }],
        take: 5,
        include: {
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              currentOdometer: true,
            },
          },
        },
      }),
    ]);

  let upcoming = 0;
  let overdue = 0;
  for (const schedule of schedules) {
    const alert = getMaintenanceScheduleAlert(
      {
        ...schedule,
        currentOdometer: schedule.vehicle.currentOdometer,
      },
      new Date(),
      MAINTENANCE_ALERT_THRESHOLDS,
    );
    if (alert === "UPCOMING") upcoming += 1;
    if (alert === "OVERDUE") overdue += 1;
  }

  return {
    totalRecords,
    scheduled: scheduledRecords,
    upcoming,
    overdue,
    recentRecords,
    recentSchedules,
  };
}

export async function getMaintenanceRecordsPage(
  organizationId: string,
  page: number,
  filters: RecordFilters,
) {
  const where: Prisma.MaintenanceRecordWhereInput = {
    organizationId,
    deletedAt: null,
    ...(filters.type ? { maintenanceType: filters.type } : {}),
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to
      ? {
          maintenanceDate: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            {
              serviceProvider: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
            {
              vehicle: {
                is: {
                  registrationNumber: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                  organizationId,
                },
              },
            },
          ],
        }
      : {}),
  };
  const skip = (page - 1) * MAINTENANCE_PAGE_SIZE;

  const [total, records, vehicles] = await Promise.all([
    prisma.maintenanceRecord.count({ where }),
    prisma.maintenanceRecord.findMany({
      where,
      orderBy: [{ maintenanceDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: MAINTENANCE_PAGE_SIZE,
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
      },
    }),
    prisma.vehicle.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { registrationNumber: "asc" },
      select: { id: true, registrationNumber: true },
    }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / MAINTENANCE_PAGE_SIZE)),
    records,
    vehicles,
  };
}

export async function getMaintenanceSchedulesPage(
  organizationId: string,
  page: number,
  filters: ScheduleFilters,
) {
  const where: Prisma.MaintenanceScheduleWhereInput = {
    organizationId,
    deletedAt: null,
    ...(filters.type ? { maintenanceType: filters.type } : {}),
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            {
              vehicle: {
                is: {
                  registrationNumber: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                  organizationId,
                },
              },
            },
          ],
        }
      : {}),
  };
  const skip = (page - 1) * MAINTENANCE_PAGE_SIZE;

  const [total, schedules, vehicles] = await Promise.all([
    prisma.maintenanceSchedule.count({ where }),
    prisma.maintenanceSchedule.findMany({
      where,
      orderBy: [{ nextServiceDate: "asc" }, { createdAt: "desc" }],
      skip,
      take: MAINTENANCE_PAGE_SIZE,
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
            currentOdometer: true,
          },
        },
      },
    }),
    prisma.vehicle.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { registrationNumber: "asc" },
      select: { id: true, registrationNumber: true },
    }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / MAINTENANCE_PAGE_SIZE)),
    schedules,
    vehicles,
  };
}
