import { ValidationError } from "./types";

export interface OdometerValidationResult {
  valid: boolean;
  odometer: number | null;
  distanceKm: number | null;
  isSuspicious: boolean;
  suspiciousReason: string | null;
}

export function sanitizeOdometer(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (Number.isNaN(num) || num < 0 || num > 9_999_999) {
    throw new ValidationError("Odometer reading must be a valid number between 0 and 9,999,999 km.");
  }
  return Number(num.toFixed(2));
}

export function validateStartingOdometer(
  vehicleCurrentOdometer: number | null | undefined,
  submittedOdometer: unknown,
): OdometerValidationResult {
  const odo = sanitizeOdometer(submittedOdometer);
  if (odo === null) {
    throw new ValidationError("A starting odometer reading is required to start the trip.");
  }

  let isSuspicious = false;
  let suspiciousReason: string | null = null;

  if (vehicleCurrentOdometer !== null && vehicleCurrentOdometer !== undefined) {
    const current = Number(vehicleCurrentOdometer);
    if (odo < current) {
      throw new ValidationError(
        `Starting odometer (${odo} km) cannot be less than the vehicle's last recorded odometer (${current} km).`,
      );
    }
    // Flag if discrepancy is unusually large (e.g. vehicle recorded 10,000 and driver enters 12,000 before even starting)
    if (odo - current > 1500) {
      isSuspicious = true;
      suspiciousReason = `Starting odometer (${odo} km) is ${Number((odo - current).toFixed(2))} km higher than vehicle's current recorded odometer (${current} km).`;
    }
  }

  return {
    valid: true,
    odometer: odo,
    distanceKm: null,
    isSuspicious,
    suspiciousReason,
  };
}

export function validateEndingOdometer(
  startOdometer: number | null | undefined,
  submittedOdometer: unknown,
  exceptionReason?: string | null,
): OdometerValidationResult {
  const odo = sanitizeOdometer(submittedOdometer);
  const cleanReason = (exceptionReason ?? "").trim();

  // If odometer is unavailable / broken
  if (odo === null) {
    if (!cleanReason || cleanReason.length < 10) {
      throw new ValidationError(
        "Ending odometer reading is missing. If the odometer is unavailable or broken, an explanation of at least 10 characters is required.",
      );
    }
    return {
      valid: true,
      odometer: null,
      distanceKm: null,
      isSuspicious: true,
      suspiciousReason: `Odometer unavailable: ${cleanReason}`,
    };
  }

  let distanceKm: number | null = null;
  let isSuspicious = false;
  let suspiciousReason: string | null = null;

  if (startOdometer !== null && startOdometer !== undefined) {
    const start = Number(startOdometer);
    if (odo < start) {
      throw new ValidationError(
        `Ending odometer (${odo} km) cannot be less than starting odometer (${start} km).`,
      );
    }
    distanceKm = Number((odo - start).toFixed(2));

    // Flag suspicious single-trip distance (> 1,500 km in one trip)
    if (distanceKm > 1500) {
      isSuspicious = true;
      suspiciousReason = `Recorded distance (${distanceKm} km) is unusually large (>1,500 km).`;
    }
  }

  return {
    valid: true,
    odometer: odo,
    distanceKm,
    isSuspicious,
    suspiciousReason,
  };
}

export function calculateTripDistance(
  startOdometer: number | null | undefined,
  endOdometer: number | null | undefined,
): number | null {
  if (
    startOdometer === null ||
    startOdometer === undefined ||
    endOdometer === null ||
    endOdometer === undefined
  ) {
    return null;
  }
  const start = Number(startOdometer);
  const end = Number(endOdometer);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null;
  }
  return Number((end - start).toFixed(2));
}
