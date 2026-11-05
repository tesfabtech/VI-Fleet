"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelTransportationRequest,
  createTransportationRequest,
  updateTransportationRequest,
  type RequestActionState,
} from "./actions";
import type {
  PriorityOption,
  TripTypeOption,
  VehiclePreferenceOption,
} from "@/lib/department-auth";

export type RequestFormInitialValues = {
  requestId?: string;
  purpose: string;
  description: string;
  origin: string;
  destination: string;
  passengerCount: number;
  requestedStart: string;
  requestedEnd: string;
  tripType: TripTypeOption;
  priority: PriorityOption;
  vehiclePreference: VehiclePreferenceOption;
  contactName: string;
  contactPhone: string;
  cargoDetails: string;
  extraRequirements: string;
  notes: string;
};

type RequestFormProps = {
  mode: "create" | "edit";
  initialValues: RequestFormInitialValues;
  maxVehicleCapacity: number;
  departmentName: string;
  organizationName: string;
};

const inputCls =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none";

export default function RequestForm({
  mode,
  initialValues: init,
  maxVehicleCapacity,
  departmentName,
  organizationName,
}: RequestFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<RequestActionState, FormData>(
    mode === "create" ? createTransportationRequest : updateTransportationRequest,
    {},
  );
  const [passengers, setPassengers] = useState(init.passengerCount || 1);
  const [priority, setPriority] = useState<PriorityOption>(init.priority || "STANDARD");

  useEffect(() => {
    if (state.ok && mode === "create" && state.requestId) {
      router.push(`/department/requests/${state.requestId}?submitted=1`);
    }
  }, [state.ok, state.requestId, mode, router]);

  const err = (field: string) =>
    state.fieldErrors?.[field] ? (
      <p className="mt-1 text-xs font-medium text-rose-600">{state.fieldErrors[field]}</p>
    ) : null;

  return (
    <form action={formAction} className="space-y-5">
      {init.requestId && <input type="hidden" name="requestId" value={init.requestId} />}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span>
          <strong className="text-slate-800">{organizationName}</strong> • {departmentName}
        </span>
        <span>Timezone: Africa/Addis_Ababa (UTC+3)</span>
      </div>

      {state.error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">{state.error}</p>
          {state.overlapWarning && (
            <label className="mt-2.5 flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-900">
              <input type="checkbox" name="confirmOverlap" value="true" className="h-4 w-4" />
              Confirm overlapping schedule — submit this request anyway
            </label>
          )}
        </div>
      )}

      {state.ok && state.message && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {state.message}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">1. Trip Purpose & Priority</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">Trip Purpose *</label>
            <input name="purpose" required maxLength={200} defaultValue={init.purpose} placeholder="e.g., Software Engineering Academic Field Visit" className={inputCls} />
            {err("purpose")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Trip Type *</label>
            <select name="tripType" defaultValue={init.tripType} className={inputCls}>
              <option value="ROUND_TRIP">Round-Trip (Outbound & Return)</option>
              <option value="ONE_WAY">One-Way Drop-Off</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Priority *</label>
            <select
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityOption)}
              className={inputCls}
            >
              <option value="STANDARD">Standard (2+ hrs lead time)</option>
              <option value="URGENT">Urgent (15+ mins lead time)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">Detailed Trip Description *</label>
            <textarea name="description" required rows={3} maxLength={2000} defaultValue={init.description} placeholder="Describe the trip objective, key stops, and travelers..." className={inputCls} />
            {err("description")}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">2. Route, Schedule & Capacity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Origin / Pickup Point *</label>
            <input name="origin" required maxLength={255} defaultValue={init.origin} placeholder="e.g., Main Campus Administration Gate" className={inputCls} />
            {err("origin")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Destination *</label>
            <input name="destination" required maxLength={255} defaultValue={init.destination} placeholder="e.g., Hossana Industrial Park" className={inputCls} />
            {err("destination")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Departure Date & Time (EAT) *</label>
            <input type="datetime-local" name="requestedStart" required defaultValue={init.requestedStart} className={inputCls} />
            {err("requestedStart")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Return / End Time (EAT) *</label>
            <input type="datetime-local" name="requestedEnd" required defaultValue={init.requestedEnd} className={inputCls} />
            {err("requestedEnd")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Passenger Count *</label>
            <input
              type="number"
              name="passengerCount"
              required
              min={1}
              max={200}
              value={passengers}
              onChange={(e) => setPassengers(Number(e.target.value) || 1)}
              className={inputCls}
            />
            {maxVehicleCapacity > 0 && passengers > maxVehicleCapacity && (
              <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                Exceeds largest single vehicle ({maxVehicleCapacity} seats) — will be flagged as Multi-Vehicle.
              </p>
            )}
            {err("passengerCount")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Preferred Vehicle Type</label>
            <select name="vehiclePreference" defaultValue={init.vehiclePreference} className={inputCls}>
              <option value="ANY">Any Suitable Vehicle</option>
              <option value="SEDAN">Sedan / Automobile (1–4 pax)</option>
              <option value="SUV_4X4">4x4 / Field Cruiser</option>
              <option value="MINIBUS">Minibus / HiAce (5–15 pax)</option>
              <option value="BUS">Coaster / Bus (16+ pax)</option>
              <option value="PICKUP_CARGO">Pickup / Cargo Utility</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">3. On-Site Contact, Cargo & Special Requirements</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700">On-Site Pickup Contact Name</label>
            <input name="contactName" maxLength={120} defaultValue={init.contactName} placeholder="Person meeting driver" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">On-Site Contact Phone</label>
            <input type="tel" name="contactPhone" maxLength={30} defaultValue={init.contactPhone} placeholder="+251 911 234 567" className={inputCls} />
            {err("contactPhone")}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">Luggage / Equipment / Cargo</label>
            <input name="cargoDetails" maxLength={300} defaultValue={init.cargoDetails} placeholder="e.g., Lab equipment boxes (~40 kg) or hand luggage only" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Special Requirements {priority === "URGENT" && <span className="text-rose-600">* (Urgent justification)</span>}
            </label>
            <textarea name="extraRequirements" rows={2} maxLength={1000} defaultValue={init.extraRequirements} placeholder="Accessibility needs, terrain notes, or urgency reason..." className={inputCls} />
            {err("extraRequirements")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Additional Notes</label>
            <textarea name="notes" rows={2} maxLength={1000} defaultValue={init.notes} placeholder="Optional intermediate stops or coordination instructions..." className={inputCls} />
            {err("notes")}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending
            ? mode === "create"
              ? "Submitting..."
              : "Saving..."
            : mode === "create"
              ? "Submit Transportation Request"
              : "Save Request Changes"}
        </button>
      </div>
    </form>
  );
}

export function CancelRequestCard({
  requestId,
  currentStatus,
  hasScheduledTrip,
}: {
  requestId: string;
  currentStatus: "PENDING" | "APPROVED";
  hasScheduledTrip: boolean;
}) {
  const [state, formAction, isPending] = useActionState<RequestActionState, FormData>(
    cancelTransportationRequest,
    {},
  );

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
      <h2 className="text-base font-bold text-rose-900">Cancel Transportation Request</h2>
      <p className="mt-1 text-xs text-rose-800">
        {currentStatus === "APPROVED" && hasScheduledTrip
          ? "Cancelling this approved request will automatically cancel its scheduled trip, release the assigned vehicle back to the fleet, and alert the Transport Manager."
          : "State a clear cancellation reason below if this trip is no longer needed."}
      </p>

      {state.error && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-white p-3 text-xs font-semibold text-rose-700">
          {state.error}
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="requestId" value={requestId} />
        <textarea
          name="cancellationReason"
          required
          rows={2}
          minLength={5}
          maxLength={500}
          placeholder="Enter reason for cancelling this request (min 5 chars)..."
          className="w-full rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
        >
          {isPending ? "Cancelling..." : "Confirm Request Cancellation"}
        </button>
      </form>
    </section>
  );
}