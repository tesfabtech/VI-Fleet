import type {
  VehicleAvailability,
  VehicleStatus,
} from "@prisma/client";

export type VehicleFieldErrors = Record<string, string>;

export type VehicleInput = {
  registrationNumber: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vehicleType: string | null;
  status: VehicleStatus;
  availability: VehicleAvailability;
  fuelType: string | null;
  seatingCapacity: number | null;
  currentOdometer: string | null;
  notes: string | null;
};

export type VehicleValidationResult =
  | { ok: true; value: VehicleInput }
  | { ok: false; errors: VehicleFieldErrors };

const vehicleStatuses = [
  "ACTIVE",
  "INACTIVE",
  "MAINTENANCE",
] as const satisfies readonly VehicleStatus[];

const vehicleAvailabilities = [
  "AVAILABLE",
  "ASSIGNED",
  "UNAVAILABLE",
] as const satisfies readonly VehicleAvailability[];

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(
  input: string,
  name: string,
  maximumLength: number,
  errors: VehicleFieldErrors,
): string | null {
  if (input.length > maximumLength) {
    errors[name] = `Must be ${maximumLength} characters or fewer.`;
  }
  return input || null;
}

function parseEnum<T extends string>(
  input: string,
  values: readonly T[],
  field: string,
  errors: VehicleFieldErrors,
): T | null {
  if (!values.includes(input as T)) {
    errors[field] = "Choose a valid option.";
    return null;
  }
  return input as T;
}

function parsePositiveInteger(
  input: string,
  field: string,
  errors: VehicleFieldErrors,
): number | null {
  if (!input) return null;
  if (!/^\d+$/.test(input) || Number(input) < 1 || Number(input) > 1000) {
    errors[field] = "Enter a whole number between 1 and 1000.";
    return null;
  }
  return Number(input);
}

function parseYear(
  input: string,
  errors: VehicleFieldErrors,
): number | null {
  if (!input) return null;
  const year = Number(input);
  if (
    !/^\d{4}$/.test(input) ||
    year < 1886 ||
    year > new Date().getFullYear() + 1
  ) {
    errors.year = "Enter a valid model year.";
    return null;
  }
  return year;
}

function parseOdometer(
  input: string,
  errors: VehicleFieldErrors,
): string | null {
  if (!input) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) {
    errors.currentOdometer =
      "Enter a non-negative number with up to 2 decimal places.";
    return null;
  }
  const odometer = Number(input);
  if (!Number.isFinite(odometer) || odometer > 9_999_999_999.99) {
    errors.currentOdometer = "Enter a smaller odometer value.";
    return null;
  }
  return input;
}

export function validateVehicleForm(
  formData: FormData,
): VehicleValidationResult {
  const errors: VehicleFieldErrors = {};
  const registrationNumber = readText(formData, "registrationNumber")
    .toUpperCase();
  if (!registrationNumber) {
    errors.registrationNumber = "Registration number is required.";
  } else if (registrationNumber.length > 50) {
    errors.registrationNumber = "Must be 50 characters or fewer.";
  }

  const vin = optionalText(readText(formData, "vin").toUpperCase(), "vin", 17, errors);
  const make = optionalText(readText(formData, "make"), "make", 100, errors);
  const model = optionalText(readText(formData, "model"), "model", 100, errors);
  const year = parseYear(readText(formData, "year"), errors);
  const color = optionalText(readText(formData, "color"), "color", 50, errors);
  const vehicleType = optionalText(
    readText(formData, "vehicleType"),
    "vehicleType",
    100,
    errors,
  );
  const status = parseEnum(
    readText(formData, "status"),
    vehicleStatuses,
    "status",
    errors,
  );
  const availability = parseEnum(
    readText(formData, "availability"),
    vehicleAvailabilities,
    "availability",
    errors,
  );
  const fuelType = optionalText(
    readText(formData, "fuelType"),
    "fuelType",
    50,
    errors,
  );
  const seatingCapacity = parsePositiveInteger(
    readText(formData, "seatingCapacity"),
    "seatingCapacity",
    errors,
  );
  const currentOdometer = parseOdometer(
    readText(formData, "currentOdometer"),
    errors,
  );
  const notes = optionalText(readText(formData, "notes"), "notes", 4000, errors);

  if (status && status !== "ACTIVE" && availability === "AVAILABLE") {
    errors.availability =
      "Inactive or maintenance vehicles must be marked unavailable.";
  }

  if (
    Object.keys(errors).length ||
    !registrationNumber ||
    !status ||
    !availability
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      registrationNumber,
      vin,
      make,
      model,
      year,
      color,
      vehicleType,
      status,
      availability,
      fuelType,
      seatingCapacity,
      currentOdometer,
      notes,
    },
  };
}
