export type PreferredVehicleErrorCode =
  | "UNAUTHORIZED"
  | "DRIVER_NOT_FOUND"
  | "VEHICLE_NOT_FOUND"
  | "VEHICLE_NOT_ACTIVE"
  | "ORGANIZATION_MISMATCH"
  | "INVALID_VEHICLE_ID";

export type PreferredVehicleValidationResult =
  | { ok: true }
  | { ok: false; error: PreferredVehicleErrorCode; message: string };

export interface VehicleCandidate {
  id: string;
  organizationId: string;
  status: string;
  deletedAt?: Date | null;
}

/**
 * Validates whether a vehicle can be assigned as a driver's preferred vehicle.
 *
 * Business Rules:
 * - The acting user must have Transport Manager or Vice Transport Manager role.
 * - Preferred vehicle is optional; clearing or removing is always valid for authorized managers.
 * - The vehicle must belong to the exact same organization as the driver.
 * - Inactive, maintenance, or soft-deleted vehicles cannot be assigned.
 * - A driver can have zero or one preferred vehicle.
 * - Multiple drivers can share the same preferred vehicle.
 */
export function validatePreferredVehicleEligibility(params: {
  isManagerAuthorized: boolean;
  driverOrganizationId: string;
  vehicle?: VehicleCandidate | null;
  targetVehicleId?: string | null;
}): PreferredVehicleValidationResult {
  if (!params.isManagerAuthorized) {
    return {
      ok: false,
      error: "UNAUTHORIZED",
      message: "Only Transport Managers can assign or change preferred vehicles.",
    };
  }

  // Removing / clearing preferred vehicle is valid
  if (!params.targetVehicleId || params.targetVehicleId.trim() === "" || params.targetVehicleId === "none") {
    return { ok: true };
  }

  if (!params.vehicle || params.vehicle.deletedAt) {
    return {
      ok: false,
      error: "VEHICLE_NOT_FOUND",
      message: "The specified vehicle was not found in your organization.",
    };
  }

  if (params.vehicle.organizationId !== params.driverOrganizationId) {
    return {
      ok: false,
      error: "ORGANIZATION_MISMATCH",
      message: "A vehicle from another organization cannot be selected.",
    };
  }

  if (params.vehicle.status !== "ACTIVE") {
    return {
      ok: false,
      error: "VEHICLE_NOT_ACTIVE",
      message: "Only active vehicles can be assigned as preferred vehicles.",
    };
  }

  return { ok: true };
}

/**
 * Helper to display vehicle identification consistently.
 */
export function formatVehicleLabel(vehicle?: {
  registrationNumber: string;
  make?: string | null;
  model?: string | null;
  vehicleType?: string | null;
} | null): string {
  if (!vehicle) return "None (unassigned)";
  const details = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const typeStr = vehicle.vehicleType ? ` (${vehicle.vehicleType})` : "";
  return details
    ? `${vehicle.registrationNumber} — ${details}${typeStr}`
    : `${vehicle.registrationNumber}${typeStr}`;
}

