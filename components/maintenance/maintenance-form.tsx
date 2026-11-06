"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { MaintenanceStatus, MaintenanceType } from "@prisma/client";
import type { MaintenanceActionState } from "@/app/transport/maintenance/actions";
import MaintenanceSubmitButton from "@/components/maintenance/maintenance-submit-button";

type VehicleOption = { id: string; registrationNumber: string };
type Values = {
  id?: string;
  vehicleId?: string;
  maintenanceType?: MaintenanceType;
  title?: string;
  description?: string | null;
  maintenanceDate?: string;
  odometer?: string | null;
  cost?: string | null;
  serviceProvider?: string | null;
  status?: MaintenanceStatus;
  notes?: string | null;
};
type Action = (
  state: MaintenanceActionState,
  formData: FormData,
) => Promise<MaintenanceActionState>;

const initialState: MaintenanceActionState = { errors: {} };
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function MaintenanceRecordForm({
  action,
  vehicles,
  values = {},
  cancelHref,
  submitLabel,
}: {
  action: Action;
  vehicles: VehicleOption[];
  values?: Values;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  function fieldError(name: string) {
    const error = state.errors[name];
    return error ? (
      <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
        {error}
      </p>
    ) : null;
  }

  function describedBy(name: string) {
    return state.errors[name] ? `${name}-error` : undefined;
  }

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {state.message && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vehicleId" className="mb-1 block text-sm font-medium text-slate-700">
            Vehicle *
          </label>
          <select
            id="vehicleId"
            name="vehicleId"
            required
            defaultValue={values.vehicleId ?? ""}
            aria-invalid={Boolean(state.errors.vehicleId)}
            aria-describedby={describedBy("vehicleId")}
            className={inputClass}
          >
            <option value="" disabled>
              Select a vehicle
            </option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registrationNumber}
              </option>
            ))}
          </select>
          {fieldError("vehicleId")}
        </div>
        <div>
          <label
            htmlFor="maintenanceType"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Maintenance type *
          </label>
          <select
            id="maintenanceType"
            name="maintenanceType"
            required
            defaultValue={values.maintenanceType ?? ""}
            aria-invalid={Boolean(state.errors.maintenanceType)}
            aria-describedby={describedBy("maintenanceType")}
            className={inputClass}
          >
            <option value="" disabled>
              Select a type
            </option>
            <option value="PREVENTIVE">Preventive</option>
            <option value="CORRECTIVE">Corrective</option>
            <option value="INSPECTION">Inspection</option>
            <option value="OTHER">Other</option>
          </select>
          {fieldError("maintenanceType")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
            Title *
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={values.title ?? ""}
            aria-invalid={Boolean(state.errors.title)}
            aria-describedby={describedBy("title")}
            className={inputClass}
          />
          {fieldError("title")}
        </div>
        <div>
          <label
            htmlFor="maintenanceDate"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Service date *
          </label>
          <input
            id="maintenanceDate"
            name="maintenanceDate"
            type="date"
            required
            defaultValue={values.maintenanceDate ?? ""}
            aria-invalid={Boolean(state.errors.maintenanceDate)}
            aria-describedby={describedBy("maintenanceDate")}
            className={inputClass}
          />
          {fieldError("maintenanceDate")}
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status *
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue={values.status ?? "COMPLETED"}
            aria-invalid={Boolean(state.errors.status)}
            aria-describedby={describedBy("status")}
            className={inputClass}
          >
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          {fieldError("status")}
        </div>
        <div>
          <label htmlFor="odometer" className="mb-1 block text-sm font-medium text-slate-700">
            Odometer (km)
          </label>
          <input
            id="odometer"
            name="odometer"
            type="number"
            min="0"
            step="0.01"
            defaultValue={values.odometer ?? ""}
            aria-invalid={Boolean(state.errors.odometer)}
            aria-describedby={describedBy("odometer")}
            className={inputClass}
          />
          {fieldError("odometer")}
        </div>
        <div>
          <label htmlFor="cost" className="mb-1 block text-sm font-medium text-slate-700">
            Cost
          </label>
          <input
            id="cost"
            name="cost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={values.cost ?? ""}
            aria-invalid={Boolean(state.errors.cost)}
            aria-describedby={describedBy("cost")}
            className={inputClass}
          />
          {fieldError("cost")}
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="serviceProvider"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Service provider
          </label>
          <input
            id="serviceProvider"
            name="serviceProvider"
            maxLength={200}
            defaultValue={values.serviceProvider ?? ""}
            aria-invalid={Boolean(state.errors.serviceProvider)}
            aria-describedby={describedBy("serviceProvider")}
            className={inputClass}
          />
          {fieldError("serviceProvider")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={4000}
            defaultValue={values.description ?? ""}
            aria-invalid={Boolean(state.errors.description)}
            aria-describedby={describedBy("description")}
            className={inputClass}
          />
          {fieldError("description")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={4000}
            defaultValue={values.notes ?? ""}
            aria-invalid={Boolean(state.errors.notes)}
            aria-describedby={describedBy("notes")}
            className={inputClass}
          />
          {fieldError("notes")}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <MaintenanceSubmitButton label={submitLabel} />
      </div>
    </form>
  );
}