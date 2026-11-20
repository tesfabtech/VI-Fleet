"use client";

import { useActionState, useEffect, useState } from "react";
import {
  startTripAction,
  completeTripAction,
  submitInterruptionAction,
  submitRevisionAction,
  type DriverActionResult,
} from "@/app/driver/actions";
import { PhotoUploadInput } from "./photo-upload-input";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
}

export function StartTripModal({
  isOpen,
  onClose,
  tripId,
  currentVehicleOdometer,
}: ModalProps & { currentVehicleOdometer?: number | null }) {
  const [state, formAction, isPending] = useActionState<DriverActionResult | null, FormData>(
    startTripAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state?.ok, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Start Trip Execution</h3>
            <p className="text-xs text-slate-500">Record departure odometer to begin.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {state?.error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {state.error}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="tripId" value={tripId} />

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Starting Odometer (km) *
            </label>
            <input
              type="number"
              name="startOdometer"
              required
              step="0.01"
              min={currentVehicleOdometer ?? 0}
              defaultValue={currentVehicleOdometer ?? ""}
              placeholder="e.g. 45200"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-[#245B85] focus:outline-none"
            />
            {currentVehicleOdometer !== null && currentVehicleOdometer !== undefined && (
              <p className="mt-1 text-[11px] text-slate-500">
                Last recorded vehicle odometer: {currentVehicleOdometer} km
              </p>
            )}
          </div>

          <PhotoUploadInput
            id="startOdometerPhoto"
            name="evidencePhoto"
            label="Starting Odometer Photo (Optional)"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Departure Notes (Optional)
            </label>
            <input
              type="text"
              name="notes"
              maxLength={200}
              placeholder="e.g., Passengers boarded, departing on time"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#245B85] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-[#E6A23C] py-3 text-xs font-bold text-[#142B45] shadow-xs hover:bg-[#d9942d] active:scale-98 disabled:opacity-50"
            >
              {isPending ? "Starting Trip..." : "Confirm & Start Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CompleteTripModal({
  isOpen,
  onClose,
  tripId,
  startOdometer,
}: ModalProps & { startOdometer?: number | null }) {
  const [outcome, setOutcome] = useState<string>("SUCCESSFUL");
  const [odometerUnavailable, setOdometerUnavailable] = useState(false);
  const [state, formAction, isPending] = useActionState<DriverActionResult | null, FormData>(
    completeTripAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state?.ok, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Trip Completion Report</h3>
            <p className="text-xs text-slate-500">Record ending details to conclude your trip.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {state?.error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {state.error}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="outcome" value={outcome} />

          {/* Outcome Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Trip Outcome *
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { val: "SUCCESSFUL", label: "Successful", desc: "Completed" },
                { val: "COMPLETED_WITH_ISSUES", label: "With Issues", desc: "Delays/issues" },
                { val: "NOT_COMPLETED", label: "Not Completed", desc: "Aborted early" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setOutcome(opt.val)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                    outcome === opt.val
                      ? "border-[#245B85] bg-blue-50/70 font-bold text-[#142B45] ring-2 ring-[#245B85]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-bold">{opt.label}</span>
                  <span className="text-[10px] text-slate-400">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ending Odometer */}
          {!odometerUnavailable ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Ending Odometer (km) *
              </label>
              <input
                type="number"
                name="endOdometer"
                required={!odometerUnavailable}
                step="0.01"
                min={startOdometer ?? 0}
                placeholder="e.g. 45310"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-[#245B85] focus:outline-none"
              />
              {startOdometer !== null && startOdometer !== undefined && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Starting odometer: {startOdometer} km
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-rose-700">
                Odometer Unavailable Reason *
              </label>
              <textarea
                name="odometerUnavailableReason"
                required={odometerUnavailable}
                rows={2}
                minLength={10}
                placeholder="State why the odometer reading is unavailable (e.g. Broken gauge, cable disconnected)..."
                className="mt-1 w-full rounded-xl border border-rose-300 bg-rose-50/30 px-3.5 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="odoUnavailableCheck"
              name="odometerUnavailable"
              checked={odometerUnavailable}
              onChange={(e) => setOdometerUnavailable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#245B85] focus:ring-[#245B85]"
            />
            <label htmlFor="odoUnavailableCheck" className="text-xs text-slate-600">
              Odometer is faulty, broken, or unavailable
            </label>
          </div>

          <PhotoUploadInput
            id="completionOdometerPhoto"
            name="evidencePhoto"
            label="Completion Odometer Photo (Optional)"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              {outcome === "SUCCESSFUL"
                ? "Completion Summary Notes (Optional)"
                : "Explanation of Issues / Incompletion *"}
            </label>
            <textarea
              name="description"
              required={outcome !== "SUCCESSFUL"}
              rows={2}
              maxLength={400}
              placeholder={
                outcome === "SUCCESSFUL"
                  ? "Passengers delivered safely, vehicle parked at fleet yard."
                  : "Detail the issues faced during the trip..."
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-[#245B85] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-98 disabled:opacity-50"
            >
              {isPending ? "Submitting..." : "Submit Completion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InterruptionModal({
  isOpen,
  onClose,
  tripId,
}: ModalProps) {
  const [state, formAction, isPending] = useActionState<DriverActionResult | null, FormData>(
    submitInterruptionAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state?.ok, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-rose-900">Report Trip Interruption</h3>
            <p className="text-xs text-slate-500">Alert the Transport Office of an active issue.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {state?.error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {state.error}
          </div>
        )}

        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          <strong>Note:</strong> Submitting this report does not cancel your trip. The trip remains <strong>IN_PROGRESS</strong> until an authorized Transport Manager reviews and decides whether to resume, reassign, or cancel.
        </div>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="tripId" value={tripId} />

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Interruption Category *
            </label>
            <select
              name="category"
              required
              defaultValue=""
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
            >
              <option value="" disabled>-- Select a category --</option>
              <option value="VEHICLE_BREAKDOWN">Vehicle Breakdown (Engine, Tire, Electrical)</option>
              <option value="ACCIDENT_OR_INCIDENT">Traffic Accident or Collision</option>
              <option value="ROAD_BLOCKED">Road Blocked / Impassable Detour</option>
              <option value="WEATHER_CONDITIONS">Severe Weather Conditions</option>
              <option value="DRIVER_UNAVAILABLE">Driver Health / Emergency</option>
              <option value="PASSENGER_OR_CARGO_ISSUE">Passenger or Cargo Incident</option>
              <option value="OTHER">Other Operational Issue</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Situation Description *
            </label>
            <textarea
              name="description"
              required
              rows={3}
              minLength={5}
              maxLength={500}
              placeholder="State your exact location, what happened, and current safety status..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-98 disabled:opacity-50"
            >
              {isPending ? "Sending Alert..." : "Submit Interruption Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RevisionModal({
  isOpen,
  onClose,
  reportId,
  tripId,
  reviewNotes,
  previousOutcome,
}: ModalProps & { reportId: string; reviewNotes?: string | null; previousOutcome?: string }) {
  const [outcome, setOutcome] = useState<string>(previousOutcome || "SUCCESSFUL");
  const [odometerUnavailable, setOdometerUnavailable] = useState(false);
  const [state, formAction, isPending] = useActionState<DriverActionResult | null, FormData>(
    submitRevisionAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state?.ok, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-amber-900">Submit Revised Report</h3>
            <p className="text-xs text-slate-500">Provide requested clarification for your manager.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {reviewNotes && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-bold">Manager&apos;s Clarification Request:</p>
            <p className="mt-0.5">{reviewNotes}</p>
          </div>
        )}

        {state?.error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {state.error}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="outcome" value={outcome} />

          {/* Outcome Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Trip Outcome *
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { val: "SUCCESSFUL", label: "Successful", desc: "Completed" },
                { val: "COMPLETED_WITH_ISSUES", label: "With Issues", desc: "Delays/issues" },
                { val: "NOT_COMPLETED", label: "Not Completed", desc: "Aborted early" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setOutcome(opt.val)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                    outcome === opt.val
                      ? "border-[#245B85] bg-blue-50/70 font-bold text-[#142B45] ring-2 ring-[#245B85]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-bold">{opt.label}</span>
                  <span className="text-[10px] text-slate-400">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {!odometerUnavailable ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Ending Odometer (km)
              </label>
              <input
                type="number"
                name="endOdometer"
                step="0.01"
                placeholder="Adjusted odometer if applicable"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#245B85] focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-rose-700">
                Odometer Unavailable Reason *
              </label>
              <textarea
                name="odometerUnavailableReason"
                rows={2}
                placeholder="Reason odometer is unavailable..."
                className="mt-1 w-full rounded-xl border border-rose-300 bg-rose-50/30 px-3.5 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="odoUnavailableRevisionCheck"
              name="odometerUnavailable"
              checked={odometerUnavailable}
              onChange={(e) => setOdometerUnavailable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#245B85] focus:ring-[#245B85]"
            />
            <label htmlFor="odoUnavailableRevisionCheck" className="text-xs text-slate-600">
              Odometer is faulty, broken, or unavailable
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Clarification / Revision Explanation *
            </label>
            <textarea
              name="description"
              required
              rows={3}
              minLength={5}
              maxLength={500}
              placeholder="Explain the details or answer the manager's questions..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-[#245B85] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-[#E6A23C] py-3 text-xs font-bold text-[#142B45] shadow-xs hover:bg-[#d9942d] active:scale-98 disabled:opacity-50"
            >
              {isPending ? "Submitting..." : "Submit Revision"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
