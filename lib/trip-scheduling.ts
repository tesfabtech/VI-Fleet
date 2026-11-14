import type { TripStatus, VehicleAvailability, VehicleStatus } from "@prisma/client";
import type { VehiclePreferenceOption } from "@/lib/department-auth";

export const TURNAROUND_BUFFER_MINUTES = 30;

export function getBufferedWindow(
  start: Date,
  end: Date,
  bufferMinutes = TURNAROUND_BUFFER_MINUTES,
): { bufferedStart: Date; bufferedEnd: Date } {
  const ms = bufferMinutes * 60_000;
  return {
    bufferedStart: new Date(start.getTime() - ms),
    bufferedEnd: new Date(end.getTime() + ms),
  };
}

export function windowsOverlapWithBuffer(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
  bufferMinutes = TURNAROUND_BUFFER_MINUTES,
): boolean {
  const { bufferedStart, bufferedEnd } = getBufferedWindow(
    bStart,
    bEnd,
    bufferMinutes,
  );
  return aStart.getTime() < bufferedEnd.getTime() && aEnd.getTime() > bufferedStart.getTime();
}

export function canTransitionTripStatus(
  from: TripStatus,
  to: TripStatus,
): boolean {
  if (from === "SCHEDULED") {
    return to === "IN_PROGRESS" || to === "CANCELLED";
  }
  if (from === "IN_PROGRESS") {
    return to === "COMPLETED" || to === "CANCELLED";
  }
  return false;
}

export type VehicleEvaluationInput = {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  vehicleType: string | null;
  status: VehicleStatus;
  availability: VehicleAvailability;
  seatingCapacity: number | null;
  currentOdometer: number | null;
  overlappingTrips: Array<{
    id: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    destination: string;
  }>;
  scheduledMaintenances: Array<{
    title: string;
    date: Date | null;
    nextOdometer: number | null;
  }>;
  weeklyTripCount: number;
};

export type EvaluatedVehicleCandidate = {
  id: string;
  label: string;
  seatingCapacity: number | null;
  vehicleType: string | null;
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  fitBadge: string;
  score: number;
};

function matchesVehiclePreference(
  vehicleType: string | null,
  pref: VehiclePreferenceOption,
): boolean {
  if (pref === "ANY") return true;
  const vt = (vehicleType ?? "").toUpperCase();
  if (pref === "SEDAN") return vt.includes("SEDAN") || vt.includes("CAR") || vt.includes("AUTO");
  if (pref === "SUV_4X4") return vt.includes("4X4") || vt.includes("SUV") || vt.includes("CRUISER") || vt.includes("PICKUP");
  if (pref === "MINIBUS") return vt.includes("MINI") || vt.includes("HIACE") || vt.includes("VAN");
  if (pref === "BUS") return vt.includes("BUS") || vt.includes("COASTER");
  if (pref === "PICKUP_CARGO") return vt.includes("PICKUP") || vt.includes("TRUCK") || vt.includes("CARGO");
  return false;
}

export function evaluateVehicleCandidate(
  vehicle: VehicleEvaluationInput,
  passengerCount: number,
  vehiclePreference: VehiclePreferenceOption,
): EvaluatedVehicleCandidate {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (vehicle.status !== "ACTIVE") {
    reasons.push(`Status is ${vehicle.status}`);
  }
  if (vehicle.availability === "UNAVAILABLE") {
    reasons.push("Marked UNAVAILABLE");
  }

  const isCargoOverride = vehiclePreference === "PICKUP_CARGO";
  if (
    vehicle.seatingCapacity !== null &&
    vehicle.seatingCapacity < passengerCount &&
    !isCargoOverride
  ) {
    reasons.push(
      `Seats ${vehicle.seatingCapacity} (needs ${passengerCount} pax)`,
    );
  }

  if (vehicle.overlappingTrips.length > 0) {
    const first = vehicle.overlappingTrips[0];
    reasons.push(
      `Booked (${first.destination}) within 30m turnaround window`,
    );
  }

  for (const maint of vehicle.scheduledMaintenances) {
    if (
      maint.nextOdometer !== null &&
      vehicle.currentOdometer !== null &&
      vehicle.currentOdometer >= maint.nextOdometer
    ) {
      reasons.push(`Service due at ${maint.nextOdometer} km (${maint.title})`);
    } else if (maint.date) {
      reasons.push(`Scheduled maintenance: ${maint.title}`);
    }
  }

  const prefMatch = matchesVehiclePreference(
    vehicle.vehicleType,
    vehiclePreference,
  );
  if (!prefMatch && vehiclePreference !== "ANY") {
    warnings.push(`Type is ${vehicle.vehicleType || "Standard"} (requested ${vehiclePreference})`);
  }

  const eligible = reasons.length === 0;
  const capacitySlack =
    vehicle.seatingCapacity !== null
      ? Math.max(0, vehicle.seatingCapacity - passengerCount)
      : 50;

  // Lower score is better: best capacity fit first -> preference match -> fewest weekly trips
  const score =
    (eligible ? 0 : 10_000) +
    capacitySlack * 10 +
    (prefMatch ? 0 : 50) +
    vehicle.weeklyTripCount * 15;

  const fitParts = [
    vehicle.seatingCapacity !== null
      ? `${vehicle.seatingCapacity} seats`
      : "Capacity N/A",
    `${vehicle.weeklyTripCount} trip(s) this week`,
  ];
  if (prefMatch && vehiclePreference !== "ANY") {
    fitParts.unshift(`Matches ${vehiclePreference}`);
  }

  return {
    id: vehicle.id,
    label: `${vehicle.registrationNumber} — ${
      [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
      vehicle.vehicleType ||
      "Fleet Vehicle"
    }`,
    seatingCapacity: vehicle.seatingCapacity,
    vehicleType: vehicle.vehicleType,
    eligible,
    reasons,
    warnings,
    fitBadge: fitParts.join(" • "),
    score,
  };
}

export type DriverEvaluationInput = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  licenseNumber: string;
  licenseExpiryDate: Date | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  userId: string | null;
  overlappingTrips: Array<{
    id: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    destination: string;
  }>;
  weeklyTripCount: number;
};

export type EvaluatedDriverCandidate = {
  id: string;
  label: string;
  phone: string | null;
  licenseNumber: string;
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  workloadBadge: string;
  score: number;
};

export function evaluateDriverCandidate(
  driver: DriverEvaluationInput,
  scheduledEnd: Date,
): EvaluatedDriverCandidate {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (driver.status !== "ACTIVE") {
    reasons.push(`Status is ${driver.status}`);
  }

  if (driver.licenseExpiryDate) {
    const expiryEndOfDay = new Date(driver.licenseExpiryDate);
    expiryEndOfDay.setUTCHours(23, 59, 59, 999);
    if (expiryEndOfDay.getTime() < scheduledEnd.getTime()) {
      reasons.push(
        `License #${driver.licenseNumber} expires before trip ends`,
      );
    }
  }

  if (driver.overlappingTrips.length > 0) {
    const first = driver.overlappingTrips[0];
    reasons.push(
      `Assigned to trip (${first.destination}) within 30m turnaround window`,
    );
  }

  if (!driver.userId) {
    warnings.push("No driver login account linked yet");
  }

  const eligible = reasons.length === 0;
  const score = (eligible ? 0 : 10_000) + driver.weeklyTripCount * 20;

  return {
    id: driver.id,
    label: `${driver.firstName} ${driver.lastName} (Lic: ${driver.licenseNumber})`,
    phone: driver.phone,
    licenseNumber: driver.licenseNumber,
    eligible,
    reasons,
    warnings,
    workloadBadge: `${driver.weeklyTripCount} trip(s) this week${
      driver.userId ? "" : " • No web login linked"
    }`,
    score,
  };
}

export type TripHistoryEntry = {
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
};

const HISTORY_MARKER = "[TRIP-HISTORY]";

export function appendTripHistoryEntry(
  existingNotes: string | null | undefined,
  entry: TripHistoryEntry,
  userNote?: string | null,
): string {
  const parsed = parseTripNotesAndHistory(existingNotes);
  const nextNote =
    userNote !== undefined ? (userNote ?? "").trim() : parsed.cleanNotes;
  const cleanField = (s: string) => s.replace(/[|\n\r]/g, " ").trim();
  const serializedEntry = `${HISTORY_MARKER}${cleanField(entry.timestamp)}|${cleanField(entry.actor)}|${cleanField(entry.action)}|${cleanField(entry.detail)}`;
  const historyLines = [
    ...parsed.history.map(
      (h) =>
        `${HISTORY_MARKER}${cleanField(h.timestamp)}|${cleanField(h.actor)}|${cleanField(h.action)}|${cleanField(h.detail)}`,
    ),
    serializedEntry,
  ];
  return [nextNote, ...historyLines].filter(Boolean).join("\n");
}

export function parseTripNotesAndHistory(raw?: string | null): {
  cleanNotes: string;
  history: TripHistoryEntry[];
} {
  if (!raw) return { cleanNotes: "", history: [] };
  const lines = raw.split("\n");
  const noteLines: string[] = [];
  const history: TripHistoryEntry[] = [];

  for (const line of lines) {
    if (line.startsWith(HISTORY_MARKER)) {
      const [timestamp = "", actor = "", action = "", detail = ""] = line
        .slice(HISTORY_MARKER.length)
        .split("|");
      history.push({ timestamp, actor, action, detail });
    } else {
      noteLines.push(line);
    }
  }

  return {
    cleanNotes: noteLines.join("\n").trim(),
    history,
  };
}