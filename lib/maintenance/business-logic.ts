import type { MaintenanceStatus } from "@prisma/client";

export type MaintenanceAlert = "UPCOMING" | "OVERDUE" | null;

export type MaintenanceAlertSchedule = {
  status: MaintenanceStatus;
  deletedAt?: Date | null;
  nextServiceDate: Date | null;
  nextServiceOdometer: number | string | { toString(): string } | null;
  currentOdometer: number | string | { toString(): string } | null;
};

export type MaintenanceAlertThresholds = {
  upcomingDays: number;
  upcomingKilometers: number;
};

export const MAINTENANCE_ALERT_THRESHOLDS: MaintenanceAlertThresholds = {
  upcomingDays: 7,
  upcomingKilometers: 500,
};

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getAddisDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return getDateKey(date);
}

function toFiniteNumber(value: MaintenanceAlertSchedule["currentOdometer"]): number | null {
  if (value === null) return null;
  const number = Number(value.toString());
  return Number.isFinite(number) ? number : null;
}

export function getMaintenanceScheduleAlert(
  schedule: MaintenanceAlertSchedule,
  now: Date = new Date(),
  thresholds: MaintenanceAlertThresholds = MAINTENANCE_ALERT_THRESHOLDS,
): MaintenanceAlert {
  if (schedule.deletedAt || schedule.status !== "SCHEDULED") return null;

  const today = getAddisDateKey(now);
  const nextDate = schedule.nextServiceDate
    ? getDateKey(schedule.nextServiceDate)
    : null;
  const dateOverdue = nextDate !== null && nextDate < today;
  const dateUpcoming =
    nextDate !== null &&
    nextDate >= today &&
    nextDate <= addDays(today, thresholds.upcomingDays);

  const nextOdometer = toFiniteNumber(schedule.nextServiceOdometer);
  const currentOdometer = toFiniteNumber(schedule.currentOdometer);
  const mileageOverdue =
    nextOdometer !== null &&
    currentOdometer !== null &&
    currentOdometer >= nextOdometer;
  const mileageUpcoming =
    nextOdometer !== null &&
    currentOdometer !== null &&
    currentOdometer < nextOdometer &&
    nextOdometer - currentOdometer <= thresholds.upcomingKilometers;

  if (dateOverdue || mileageOverdue) return "OVERDUE";
  if (dateUpcoming || mileageUpcoming) return "UPCOMING";
  return null;
}
