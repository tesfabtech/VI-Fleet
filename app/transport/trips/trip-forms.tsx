"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  scheduleOrReassignTrip,
  updateTripLifecycleStatus,
  type TripActionState,
} from "./actions";
import type {
  EvaluatedDriverCandidate as BaseDriverCandidate,
  EvaluatedVehicleCandidate,
} from "@/lib/trip-scheduling";

type EvaluatedDriverCandidate = BaseDriverCandidate & {
  preferredVehicleId?: string | null;
  preferredVehicleLabel?: string | null;
};

function resolveRecommendedVehicleForDriver(
  driver: EvaluatedDriverCandidate | undefined,
  vehicles: EvaluatedVehicleCandidate[],
): {
  suggestedVehicleId: string;
  status: "PREFERRED_AVAILABLE" | "PREFERRED_UNAVAILABLE" | "NO_PREFERENCE";
  message: string | null;
} {
  const bestAvailableId = vehicles.find((v) => v.eligible)?.id ?? "";

  if (!driver || !driver.preferredVehicleId) {
    return {
      suggestedVehicleId: bestAvailableId,
      status: "NO_PREFERENCE",
      message: null,
    };
  }

  const preferred = vehicles.find((v) => v.id === driver.preferredVehicleId);
  if (!preferred) {
    return {
      suggestedVehicleId: bestAvailableId,
      status: "PREFERRED_UNAVAILABLE",
      message: `Driver's preferred vehicle (${driver.preferredVehicleLabel || "assigned vehicle"}) is no longer active in the fleet. Suggested best available vehicle instead.`,
    };
  }

  if (preferred.eligible) {
    return {
      suggestedVehicleId: preferred.id,
      status: "PREFERRED_AVAILABLE",
      message: `Auto-suggested ${driver.label.split(" (")[0]}'s preferred vehicle: ${preferred.label}. You can keep this suggestion or choose another available vehicle.`,
    };
  }

  return {
    suggestedVehicleId: bestAvailableId,
    status: "PREFERRED_UNAVAILABLE",
    message: `Driver's preferred vehicle (${preferred.label}) cannot be assigned for this trip (${preferred.reasons.join("; ")}). Suggested best available vehicle instead.`,
  };
}

export function ScheduleOrReassignTripForm({
  mode,
  requestId,
  initialVehicleId = "",
  initialDriverId = "",
  initialScheduledStart,
  initialScheduledEnd,
  initialNotes = "",
  vehicles,
  drivers,
}: {
  mode: "schedule" | "reassign";
  requestId: string;
  initialVehicleId?: string;
  initialDriverId?: string;
  initialScheduledStart: string;
  initialScheduledEnd: string;
  initialNotes?: string;
  vehicles: EvaluatedVehicleCandidate[];
  drivers: EvaluatedDriverCandidate[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    TripActionState,
    FormData
  >(scheduleOrReassignTrip, {});

  const eligibleVehicles = vehicles.filter((v) => v.eligible);
  const ineligibleVehicles = vehicles.filter((v) => !v.eligible);
  const eligibleDrivers = drivers.filter((d) => d.eligible);
  const ineligibleDrivers = drivers.filter((d) => !d.eligible);

  const defaultDriverId = initialDriverId || eligibleDrivers[0]?.id || "";
  const defaultDriver = drivers.find((d) => d.id === defaultDriverId);
  const initialRecommendation = resolveRecommendedVehicleForDriver(
    defaultDriver,
    vehicles,
  );

  const [selectedDriverId, setSelectedDriverId] = useState(defaultDriverId);
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    initialVehicleId ||
      initialRecommendation.suggestedVehicleId ||
      eligibleVehicles[0]?.id ||
      "",
  );
  const [recommendationNotice, setRecommendationNotice] = useState<{
    status: "PREFERRED_AVAILABLE" | "PREFERRED_UNAVAILABLE" | "NO_PREFERENCE";
    message: string | null;
  }>({
    status: initialRecommendation.status,
    message: initialRecommendation.message,
  });

  const handleDriverChange = (nextDriverId: string) => {
    setSelectedDriverId(nextDriverId);
    const nextDriver = drivers.find((d) => d.id === nextDriverId);
    const rec = resolveRecommendedVehicleForDriver(nextDriver, vehicles);
    setRecommendationNotice({ status: rec.status, message: rec.message });
    if (rec.suggestedVehicleId) {
      setSelectedVehicleId(rec.suggestedVehicleId);
    }
  };

  useEffect(() => {
    if (!state.ok) return;
    if (mode === "schedule" && state.tripId) {
      router.push(`/transport/trips/${state.tripId}?scheduled=1`);
    } else {
      router.refresh();
    }
  }, [state.ok, state.tripId, mode, router]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);
  const isSelectedVehicleDriverPreferred =
    Boolean(selectedDriver?.preferredVehicleId) &&
    selectedDriver?.preferredVehicleId === selectedVehicleId;

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5"
    >
      <input type="hidden" name="requestId" value={requestId} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {mode === "schedule"
              ? "Assign Driver, Vehicle & Schedule Window"
              : "Reassign Driver, Vehicle or Adjust Schedule"}
          </h2>
          <p className="text-xs text-slate-500">
            Selecting a driver automatically suggests their preferred vehicle if it is active and available for this trip window. You can accept the suggestion or select any other available vehicle.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          Timezone: Africa/Addis_Ababa (UTC+3)
        </span>
      </div>

      {state.error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"
        >
          {state.error}
        </div>
      )}

      {state.ok && state.message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800"
        >
          {state.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Scheduled Departure (EAT) *
          </label>
          <input
            type="datetime-local"
            name="scheduledStart"
            required
            defaultValue={initialScheduledStart}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Scheduled Return / End (EAT) *
          </label>
          <input
            type="datetime-local"
            name="scheduledEnd"
            required
            defaultValue={initialScheduledEnd}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            1. Select Eligible Driver ({eligibleDrivers.length} free in window) *
          </label>
          <select
            name="driverId"
            required
            value={selectedDriverId}
            onChange={(e) => handleDriverChange(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="">-- Choose a driver --</option>
            {eligibleDrivers.length > 0 && (
              <optgroup label="✓ Eligible & Free in Window (Ranked by Fairness)">
                {eligibleDrivers.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    {i === 0 ? "★ Recommended: " : ""}
                    {d.label} ({d.workloadBadge})
                  </option>
                ))}
              </optgroup>
            )}
            {ineligibleDrivers.length > 0 && (
              <optgroup label="✕ Unavailable / Conflicting in Window">
                {ineligibleDrivers.map((d) => (
                  <option key={d.id} value={d.id} disabled>
                    {d.label} — {d.reasons.join("; ")}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {selectedDriver && (
            <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
              <p className="font-semibold text-emerald-800">
                {selectedDriver.workloadBadge}
                {selectedDriver.phone ? ` • Tel: ${selectedDriver.phone}` : ""}
              </p>
              {selectedDriver.warnings.map((w) => (
                <p key={w} className="mt-0.5 text-amber-700">
                  ⚠ {w} (notify driver via phone/SMS)
                </p>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              2. Select Eligible Vehicle ({eligibleVehicles.length} free in window) *
            </label>
            {isSelectedVehicleDriverPreferred && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                ★ Driver's Preferred Vehicle
              </span>
            )}
          </div>
          <select
            name="vehicleId"
            required
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="">-- Choose a vehicle --</option>
            {eligibleVehicles.length > 0 && (
              <optgroup label="✓ Eligible & Available in Window">
                {eligibleVehicles.map((v, i) => {
                  const isDriverPref =
                    Boolean(selectedDriver?.preferredVehicleId) &&
                    selectedDriver?.preferredVehicleId === v.id;
                  return (
                    <option key={v.id} value={v.id}>
                      {isDriverPref
                        ? "★ Driver's Preferred Vehicle: "
                        : i === 0
                          ? "★ Best Capacity Fit: "
                          : ""}
                      {v.label} ({v.fitBadge})
                    </option>
                  );
                })}
              </optgroup>
            )}
            {ineligibleVehicles.length > 0 && (
              <optgroup label="✕ Unavailable / Conflicting in Window">
                {ineligibleVehicles.map((v) => {
                  const isDriverPref =
                    Boolean(selectedDriver?.preferredVehicleId) &&
                    selectedDriver?.preferredVehicleId === v.id;
                  return (
                    <option key={v.id} value={v.id} disabled>
                      {isDriverPref ? "[Driver's Preferred] " : ""}
                      {v.label} — {v.reasons.join("; ")}
                    </option>
                  );
                })}
              </optgroup>
            )}
          </select>

          {recommendationNotice.message && (
            <div
              className={`mt-2 rounded-lg border px-2.5 py-2 text-xs font-medium ${
                recommendationNotice.status === "PREFERRED_AVAILABLE"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {recommendationNotice.message}
              {selectedDriver?.preferredVehicleId &&
                recommendationNotice.status === "PREFERRED_AVAILABLE" &&
                selectedVehicleId !== selectedDriver.preferredVehicleId && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedVehicleId(
                        selectedDriver.preferredVehicleId ?? "",
                      )
                    }
                    className="ml-2 font-bold text-emerald-800 underline"
                  >
                    Use preferred vehicle
                  </button>
                )}
            </div>
          )}

          {selectedVehicle && (
            <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
              <p className="font-semibold text-slate-800">
                {selectedVehicle.fitBadge}
              </p>
              {selectedVehicle.warnings.map((w) => (
                <p key={w} className="mt-0.5 text-amber-700">
                  Note: {w}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700">
          Dispatch Instructions / Trip Notes (Visible to Driver & Department)
        </label>
        <textarea
          name="notes"
          rows={2}
          maxLength={800}
          defaultValue={initialNotes}
          placeholder="e.g., Meet passengers at Main Campus Gate 15 minutes before departure..."
          className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isPending ||
            eligibleVehicles.length === 0 ||
            eligibleDrivers.length === 0
          }
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? mode === "schedule"
              ? "Scheduling Trip..."
              : "Saving Reassignment..."
            : mode === "schedule"
              ? "Confirm Trip Schedule & Assign"
              : "Save Vehicle / Driver Reassignment"}
        </button>
      </div>
    </form>
  );
}

export function TripLifecycleControls({
  tripId,
  currentStatus,
  defaultOdometer,
}: {
  tripId: string;
  currentStatus: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  defaultOdometer?: number | null;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    TripActionState,
    FormData
  >(updateTripLifecycleStatus, {});

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (currentStatus === "COMPLETED" || currentStatus === "CANCELLED") {
    return null;
  }

  return (
    <div className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
        >
          {state.error}
        </p>
      )}

      {state.ok && state.message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"
        >
          {state.message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <form
          action={formAction}
          className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3"
        >
          <input type="hidden" name="tripId" value={tripId} />
          <input
            type="hidden"
            name="targetStatus"
            value={currentStatus === "SCHEDULED" ? "IN_PROGRESS" : "COMPLETED"}
          />

          <h3 className="text-sm font-bold text-emerald-950">
            {currentStatus === "SCHEDULED"
              ? "Start Trip Execution (SCHEDULED → IN_PROGRESS)"
              : "Complete Trip (IN_PROGRESS → COMPLETED)"}
          </h3>
          <p className="text-xs text-emerald-800">
            {currentStatus === "SCHEDULED"
              ? "Marks the trip IN_PROGRESS, records actual departure time and starting odometer, and marks the vehicle ASSIGNED."
              : "Marks the trip COMPLETED, calculates distance traveled from ending odometer, and releases the vehicle to AVAILABLE."}
          </p>

          <div>
            <label className="block text-xs font-semibold text-emerald-950">
              {currentStatus === "SCHEDULED"
                ? "Starting Odometer (km)"
                : "Ending Odometer (km)"}
            </label>
            <input
              type="number"
              name="odometer"
              step="0.01"
              min={defaultOdometer ?? 0}
              defaultValue={defaultOdometer ?? ""}
              placeholder="e.g., 45210"
              className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-950">
              Execution Note (Optional)
            </label>
            <input
              type="text"
              name="statusNote"
              maxLength={300}
              placeholder={
                currentStatus === "SCHEDULED"
                  ? "All passengers boarded at Main Gate"
                  : "Returned safely, vehicle refueled"
              }
              className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending
              ? "Updating..."
              : currentStatus === "SCHEDULED"
                ? "Start Trip Now"
                : "Mark Trip Completed"}
          </button>
        </form>

        <form
          action={formAction}
          className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 space-y-3"
        >
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="targetStatus" value="CANCELLED" />

          <h3 className="text-sm font-bold text-rose-950">
            {currentStatus === "IN_PROGRESS"
              ? "Report Breakdown / Abort Active Trip"
              : "Cancel Scheduled Trip"}
          </h3>
          <p className="text-xs text-rose-800">
            {currentStatus === "IN_PROGRESS"
              ? "Aborts this in-progress trip, releases the assignment, and sends a CRITICAL breakdown alert to the Transport Office."
              : "Cancels this scheduled trip, releases the vehicle, and returns the approved request to Awaiting Dispatch so another vehicle/driver can be assigned."}
          </p>

          <div>
            <label className="block text-xs font-semibold text-rose-950">
              {currentStatus === "IN_PROGRESS"
                ? "Breakdown / Incident Reason *"
                : "Cancellation Reason *"}
            </label>
            <textarea
              name="statusNote"
              required
              rows={2}
              minLength={5}
              maxLength={500}
              placeholder="State why this trip is being cancelled or aborted..."
              className="mt-1 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {isPending
              ? "Processing..."
              : currentStatus === "IN_PROGRESS"
                ? "Confirm Breakdown & Abort Trip"
                : "Cancel Scheduled Trip"}
          </button>
        </form>
      </div>
    </div>
  );
}