"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
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
  intervalDays?: number | null;
  intervalKm?: string | null;
  lastServiceDate?: string | null;
  lastServiceOdometer?: string | null;
  nextServiceDate?: string | null;
  nextServiceOdometer?: string | null;
  status?: MaintenanceStatus;
};
type FormValues = {
  vehicleId: string;
  maintenanceType: string;
  title: string;
  intervalDays: string;
  intervalKm: string;
  lastServiceDate: string;
  nextServiceDate: string;
  lastServiceOdometer: string;
  nextServiceOdometer: string;
  status: string;
  description: string;
};
type Action = (
  state: MaintenanceActionState,
  formData: FormData,
) => Promise<MaintenanceActionState>;

const initialState: MaintenanceActionState = { errors: {} };
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function MaintenanceScheduleForm({
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
  const [formValues, setFormValues] = useState<FormValues>(() => ({
    vehicleId: values.vehicleId ?? "",
    maintenanceType: values.maintenanceType ?? "",
    title: values.title ?? "",
    intervalDays: values.intervalDays?.toString() ?? "",
    intervalKm: values.intervalKm ?? "",
    lastServiceDate: values.lastServiceDate ?? "",
    nextServiceDate: values.nextServiceDate ?? "",
    lastServiceOdometer: values.lastServiceOdometer ?? "",
    nextServiceOdometer: values.nextServiceOdometer ?? "",
    status: values.status ?? "SCHEDULED",
    description: values.description ?? "",
  }));
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.currentTarget;
    setFormValues((current) => ({ ...current, [name]: value }));
  };
  const fieldError = (name: string) =>
    state.errors[name] ? (
      <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
        {state.errors[name]}
      </p>
    ) : null;
  const describedBy = (name: string) =>
    state.errors[name] ? `${name}-error` : undefined;

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
            value={formValues.vehicleId}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.vehicleId)}
            aria-describedby={describedBy("vehicleId")}
            className={inputClass}
          >
            <option value="" disabled>Select a vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registrationNumber}
              </option>
            ))}
          </select>
          {fieldError("vehicleId")}
        </div>
        <div>
          <label htmlFor="maintenanceType" className="mb-1 block text-sm font-medium text-slate-700">
            Maintenance type *
          </label>
          <select
            id="maintenanceType"
            name="maintenanceType"
            required
            value={formValues.maintenanceType}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.maintenanceType)}
            aria-describedby={describedBy("maintenanceType")}
            className={inputClass}
          >
            <option value="" disabled>Select a type</option>
            <option value="PREVENTIVE">Preventive</option>
            <option value="CORRECTIVE">Corrective</option>
            <option value="INSPECTION">Inspection</option>
            <option value="OTHER">Other</option>
          </select>
          {fieldError("maintenanceType")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
            Schedule title *
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            value={formValues.title}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.title)}
            aria-describedby={describedBy("title")}
            className={inputClass}
          />
          {fieldError("title")}
        </div>
        <div>
          <label htmlFor="intervalDays" className="mb-1 block text-sm font-medium text-slate-700">
            Service interval (days)
          </label>
          <input
            id="intervalDays"
            name="intervalDays"
            type="number"
            min="1"
            step="1"
            value={formValues.intervalDays}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.intervalDays)}
            aria-describedby={describedBy("intervalDays")}
            className={inputClass}
          />
          {fieldError("intervalDays")}
        </div>
        <div>
          <label htmlFor="intervalKm" className="mb-1 block text-sm font-medium text-slate-700">
            Service interval (km)
          </label>
          <input
            id="intervalKm"
            name="intervalKm"
            type="number"
            min="0.01"
            step="0.01"
            value={formValues.intervalKm}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.intervalKm)}
            aria-describedby={describedBy("intervalKm")}
            className={inputClass}
          />
          {fieldError("intervalKm")}
        </div>
        <div>
          <label htmlFor="lastServiceDate" className="mb-1 block text-sm font-medium text-slate-700">
            Last service date
          </label>
          <input
            id="lastServiceDate"
            name="lastServiceDate"
            type="date"
            value={formValues.lastServiceDate}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.lastServiceDate)}
            aria-describedby={describedBy("lastServiceDate")}
            className={inputClass}
          />
          {fieldError("lastServiceDate")}
        </div>
        <div>
          <label htmlFor="nextServiceDate" className="mb-1 block text-sm font-medium text-slate-700">
            Next service date
          </label>
          <input
            id="nextServiceDate"
            name="nextServiceDate"
            type="date"
            value={formValues.nextServiceDate}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.nextServiceDate)}
            aria-describedby={describedBy("nextServiceDate")}
            className={inputClass}
          />
          {fieldError("nextServiceDate")}
        </div>
        <div>
          <label htmlFor="lastServiceOdometer" className="mb-1 block text-sm font-medium text-slate-700">
            Last service odometer (km)
          </label>
          <input
            id="lastServiceOdometer"
            name="lastServiceOdometer"
            type="number"
            min="0"
            step="0.01"
            value={formValues.lastServiceOdometer}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.lastServiceOdometer)}
            aria-describedby={describedBy("lastServiceOdometer")}
            className={inputClass}
          />
          {fieldError("lastServiceOdometer")}
        </div>
        <div>
          <label htmlFor="nextServiceOdometer" className="mb-1 block text-sm font-medium text-slate-700">
            Next service odometer (km)
          </label>
          <input
            id="nextServiceOdometer"
            name="nextServiceOdometer"
            type="number"
            min="0"
            step="0.01"
            value={formValues.nextServiceOdometer}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.nextServiceOdometer)}
            aria-describedby={describedBy("nextServiceOdometer")}
            className={inputClass}
          />
          {fieldError("nextServiceOdometer")}
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status *
          </label>
          <select
            id="status"
            name="status"
            required
            value={formValues.status}
            onChange={handleChange}
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
        <div className="sm:col-span-2">
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={4000}
            value={formValues.description}
            onChange={handleChange}
            aria-invalid={Boolean(state.errors.description)}
            aria-describedby={describedBy("description")}
            className={inputClass}
          />
          {fieldError("description")}
        </div>
      </div>
      <p className="text-sm text-slate-500">
        Enter at least one interval. If a next-service target is left blank, it
        is calculated from the matching last-service value and interval.
      </p>
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