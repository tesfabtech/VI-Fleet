import type { MaintenanceStatus, MaintenanceType } from "@prisma/client";

export type MaintenanceFieldErrors = Record<string, string>;

export type MaintenanceRecordInput = {
  vehicleId: string;
  maintenanceType: MaintenanceType;
  title: string;
  description: string | null;
  maintenanceDate: Date;
  odometer: string | null;
  cost: string | null;
  serviceProvider: string | null;
  status: MaintenanceStatus;
  notes: string | null;
};

export type MaintenanceScheduleInput = {
  vehicleId: string;
  maintenanceType: MaintenanceType;
  title: string;
  description: string | null;
  intervalDays: number | null;
  intervalKm: string | null;
  lastServiceDate: Date | null;
  lastServiceOdometer: string | null;
  nextServiceDate: Date | null;
  nextServiceOdometer: string | null;
  status: MaintenanceStatus;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: MaintenanceFieldErrors };

const maintenanceTypes = [
  "PREVENTIVE",
  "CORRECTIVE",
  "INSPECTION",
  "OTHER",
] as const satisfies readonly MaintenanceType[];

const maintenanceStatuses = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly MaintenanceStatus[];

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(
  input: string,
  name: string,
  maximumLength: number,
  errors: MaintenanceFieldErrors,
): string | null {
  if (input.length > maximumLength) {
    errors[name] = `Must be ${maximumLength} characters or fewer.`;
  }
  return input || null;
}

function parseDate(
  input: string,
  name: string,
  required: boolean,
  errors: MaintenanceFieldErrors,
): Date | null {
  if (!input) {
    if (required) errors[name] = "This field is required.";
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    errors[name] = "Enter a valid date.";
    return null;
  }

  const date = new Date(`${input}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input
  ) {
    errors[name] = "Enter a valid date.";
    return null;
  }

  return date;
}

function parseDecimal(
  input: string,
  name: string,
  errors: MaintenanceFieldErrors,
  options: { required?: boolean; positive?: boolean } = {},
): string | null {
  if (!input) {
    if (options.required) errors[name] = "This field is required.";
    return null;
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) {
    errors[name] = "Enter a non-negative number with up to 2 decimal places.";
    return null;
  }

  const value = Number(input);
  if (!Number.isFinite(value) || value > 9_999_999_999.99) {
    errors[name] = "Enter a smaller number.";
    return null;
  }
  if (options.positive && value <= 0) {
    errors[name] = "Enter a value greater than zero.";
    return null;
  }

  return input;
}

function parseEnum<T extends string>(
  input: string,
  name: string,
  values: readonly T[],
  errors: MaintenanceFieldErrors,
): T | null {
  if (!values.includes(input as T)) {
    errors[name] = "Choose a valid option.";
    return null;
  }
  return input as T;
}

function parseTitle(
  input: string,
  errors: MaintenanceFieldErrors,
): string | null {
  if (!input) {
    errors.title = "This field is required.";
    return null;
  }
  if (input.length > 200) {
    errors.title = "Must be 200 characters or fewer.";
    return null;
  }
  return input;
}

export function validateMaintenanceRecord(
  formData: FormData,
): ValidationResult<MaintenanceRecordInput> {
  const errors: MaintenanceFieldErrors = {};
  const vehicleId = readText(formData, "vehicleId");
  if (!vehicleId) errors.vehicleId = "Choose a vehicle.";

  const maintenanceType = parseEnum(
    readText(formData, "maintenanceType"),
    "maintenanceType",
    maintenanceTypes,
    errors,
  );
  const title = parseTitle(readText(formData, "title"), errors);
  const maintenanceDate = parseDate(
    readText(formData, "maintenanceDate"),
    "maintenanceDate",
    true,
    errors,
  );
  const odometer = parseDecimal(readText(formData, "odometer"), "odometer", errors);
  const cost = parseDecimal(readText(formData, "cost"), "cost", errors);
  const status = parseEnum(
    readText(formData, "status"),
    "status",
    maintenanceStatuses,
    errors,
  );

  const description = nullableText(
    readText(formData, "description"),
    "description",
    4000,
    errors,
  );
  const serviceProvider = nullableText(
    readText(formData, "serviceProvider"),
    "serviceProvider",
    200,
    errors,
  );
  const notes = nullableText(readText(formData, "notes"), "notes", 4000, errors);

  if (
    Object.keys(errors).length ||
    !maintenanceType ||
    !title ||
    !maintenanceDate ||
    !status
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      vehicleId,
      maintenanceType,
      title,
      description,
      maintenanceDate,
      odometer,
      cost,
      serviceProvider,
      status,
      notes,
    },
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function validateMaintenanceSchedule(
  formData: FormData,
): ValidationResult<MaintenanceScheduleInput> {
  const errors: MaintenanceFieldErrors = {};
  const vehicleId = readText(formData, "vehicleId");
  if (!vehicleId) errors.vehicleId = "Choose a vehicle.";

  const maintenanceType = parseEnum(
    readText(formData, "maintenanceType"),
    "maintenanceType",
    maintenanceTypes,
    errors,
  );
  const title = parseTitle(readText(formData, "title"), errors);
  const status = parseEnum(
    readText(formData, "status"),
    "status",
    maintenanceStatuses,
    errors,
  );
  const intervalDaysInput = readText(formData, "intervalDays");
  let intervalDays: number | null = null;
  if (intervalDaysInput) {
    if (!/^\d+$/.test(intervalDaysInput) || Number(intervalDaysInput) < 1) {
      errors.intervalDays = "Enter a whole number greater than zero.";
    } else {
      intervalDays = Number(intervalDaysInput);
    }
  }
  const intervalKm = parseDecimal(
    readText(formData, "intervalKm"),
    "intervalKm",
    errors,
    { positive: true },
  );
  if (!intervalDays && !intervalKm) {
    errors.intervalDays = "Configure an interval in days or kilometers.";
  }

  const lastServiceDate = parseDate(
    readText(formData, "lastServiceDate"),
    "lastServiceDate",
    false,
    errors,
  );
  let nextServiceDate = parseDate(
    readText(formData, "nextServiceDate"),
    "nextServiceDate",
    false,
    errors,
  );
  const lastServiceOdometer = parseDecimal(
    readText(formData, "lastServiceOdometer"),
    "lastServiceOdometer",
    errors,
  );
  let nextServiceOdometer = parseDecimal(
    readText(formData, "nextServiceOdometer"),
    "nextServiceOdometer",
    errors,
  );

  if (!nextServiceDate && intervalDays && lastServiceDate) {
    nextServiceDate = addDays(lastServiceDate, intervalDays);
  }
  if (!nextServiceOdometer && intervalKm && lastServiceOdometer) {
    const nextOdometer = Number(lastServiceOdometer) + Number(intervalKm);
    if (nextOdometer <= 9_999_999_999.99) {
      nextServiceOdometer = nextOdometer.toFixed(2);
    } else {
      errors.nextServiceOdometer = "The calculated odometer is too large.";
    }
  }

  if (intervalDays && !nextServiceDate) {
    errors.nextServiceDate =
      "Enter a next service date or provide the last service date to calculate it.";
  }
  if (intervalKm && !nextServiceOdometer) {
    errors.nextServiceOdometer =
      "Enter a next service odometer or provide the last service odometer to calculate it.";
  }
  if (
    lastServiceDate &&
    nextServiceDate &&
    nextServiceDate < lastServiceDate
  ) {
    errors.nextServiceDate = "Must be on or after the last service date.";
  }
  if (
    lastServiceOdometer &&
    nextServiceOdometer &&
    Number(nextServiceOdometer) <= Number(lastServiceOdometer)
  ) {
    errors.nextServiceOdometer =
      "Must be greater than the last service odometer.";
  }

  const description = nullableText(
    readText(formData, "description"),
    "description",
    4000,
    errors,
  );

  if (
    Object.keys(errors).length ||
    !maintenanceType ||
    !title ||
    !status
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      vehicleId,
      maintenanceType,
      title,
      description,
      intervalDays,
      intervalKm,
      lastServiceDate,
      lastServiceOdometer,
      nextServiceDate,
      nextServiceOdometer,
      status,
    },
  };
}
