import type { VehicleAvailability, VehicleStatus } from "@prisma/client";
import type { VehicleFieldErrors } from "@/lib/vehicles/validation";

export function validateVehicleTripState(
  status: VehicleStatus,
  availability: VehicleAvailability,
  activeTripCount: number,
): VehicleFieldErrors {
  const errors: VehicleFieldErrors = {};
  if (activeTripCount > 0 && status !== "ACTIVE") {
    errors.status =
      "Finish or cancel active trips before changing vehicle status.";
  }
  if (activeTripCount > 0 && availability !== "ASSIGNED") {
    errors.availability =
      "This vehicle has an active trip and must remain assigned.";
  } else if (activeTripCount === 0 && availability === "ASSIGNED") {
    errors.availability =
      "A vehicle becomes assigned through an active trip assignment.";
  }
  return errors;
}
