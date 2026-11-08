"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import type { VehicleAvailability, VehicleStatus } from "@prisma/client";
import type { VehicleActionState } from "@/app/transport/vehicles/actions";
import VehicleSubmitButton from "@/components/vehicles/vehicle-submit-button";

export type VehicleFormValues = {
  id?: string;
  registrationNumber?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  vehicleType?: string | null;
  status?: VehicleStatus;
  availability?: VehicleAvailability;
  fuelType?: string | null;
  seatingCapacity?: number | null;
  currentOdometer?: string | null;
  notes?: string | null;
};

type FormFields = {
  registrationNumber: string;
  vin: string;
  make: string;
  model: string;
  year: string;
  color: string;
  vehicleType: string;
  status: VehicleStatus;
  availability: VehicleAvailability;
  fuelType: string;
  seatingCapacity: string;
  currentOdometer: string;
  notes: string;
};

type VehicleAction = (
  state: VehicleActionState,
  formData: FormData,
) => Promise<VehicleActionState>;

const initialState: VehicleActionState = { errors: {} };
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function VehicleForm({
  action,
  values = {},
  cancelHref,
  submitLabel,
}: {
  action: VehicleAction;
  values?: VehicleFormValues;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const [fields, setFields] = useState<FormFields>(() => ({
    registrationNumber: values.registrationNumber ?? "",
    vin: values.vin ?? "",
    make: values.make ?? "",
    model: values.model ?? "",
    year: values.year?.toString() ?? "",
    color: values.color ?? "",
    vehicleType: values.vehicleType ?? "",
    status: values.status ?? "ACTIVE",
    availability: values.availability ?? "AVAILABLE",
    fuelType: values.fuelType ?? "",
    seatingCapacity: values.seatingCapacity?.toString() ?? "",
    currentOdometer: values.currentOdometer ?? "",
    notes: values.notes ?? "",
  }));
  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.currentTarget;
    setFields((current) => {
      if (name === "status" && value !== "ACTIVE") {
        return {
          ...current,
          status: value as VehicleStatus,
          availability: "UNAVAILABLE",
        };
      }
      return { ...current, [name]: value };
    });
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
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.message}
        </p>
      )}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Vehicle details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="registrationNumber"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Registration number *
            </label>
            <input
              id="registrationNumber"
              name="registrationNumber"
              required
              maxLength={50}
              autoComplete="off"
              value={fields.registrationNumber}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.registrationNumber)}
              aria-describedby={describedBy("registrationNumber")}
              className={inputClass}
            />
            {fieldError("registrationNumber")}
          </div>
          <div>
            <label
              htmlFor="vin"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              VIN
            </label>
            <input
              id="vin"
              name="vin"
              maxLength={17}
              value={fields.vin}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.vin)}
              aria-describedby={describedBy("vin")}
              className={inputClass}
            />
            {fieldError("vin")}
          </div>
          <div>
            <label
              htmlFor="make"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Make
            </label>
            <input
              id="make"
              name="make"
              maxLength={100}
              value={fields.make}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.make)}
              aria-describedby={describedBy("make")}
              className={inputClass}
            />
            {fieldError("make")}
          </div>
          <div>
            <label
              htmlFor="model"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Model
            </label>
            <input
              id="model"
              name="model"
              maxLength={100}
              value={fields.model}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.model)}
              aria-describedby={describedBy("model")}
              className={inputClass}
            />
            {fieldError("model")}
          </div>
          <div>
            <label
              htmlFor="year"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Model year
            </label>
            <input
              id="year"
              name="year"
              type="number"
              min="1886"
              max={new Date().getFullYear() + 1}
              step="1"
              value={fields.year}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.year)}
              aria-describedby={describedBy("year")}
              className={inputClass}
            />
            {fieldError("year")}
          </div>
          <div>
            <label
              htmlFor="color"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Color
            </label>
            <input
              id="color"
              name="color"
              maxLength={50}
              value={fields.color}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.color)}
              aria-describedby={describedBy("color")}
              className={inputClass}
            />
            {fieldError("color")}
          </div>
          <div>
            <label
              htmlFor="vehicleType"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Vehicle type
            </label>
            <input
              id="vehicleType"
              name="vehicleType"
              maxLength={100}
              placeholder="e.g. Sedan, Bus, Pickup"
              value={fields.vehicleType}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.vehicleType)}
              aria-describedby={describedBy("vehicleType")}
              className={inputClass}
            />
            {fieldError("vehicleType")}
          </div>
          <div>
            <label
              htmlFor="fuelType"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Fuel type
            </label>
            <input
              id="fuelType"
              name="fuelType"
              maxLength={50}
              value={fields.fuelType}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.fuelType)}
              aria-describedby={describedBy("fuelType")}
              className={inputClass}
            />
            {fieldError("fuelType")}
          </div>
          <div>
            <label
              htmlFor="seatingCapacity"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Seating capacity
            </label>
            <input
              id="seatingCapacity"
              name="seatingCapacity"
              type="number"
              min="1"
              max="1000"
              step="1"
              value={fields.seatingCapacity}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.seatingCapacity)}
              aria-describedby={describedBy("seatingCapacity")}
              className={inputClass}
            />
            {fieldError("seatingCapacity")}
          </div>
          <div>
            <label
              htmlFor="currentOdometer"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Current odometer (km)
            </label>
            <input
              id="currentOdometer"
              name="currentOdometer"
              type="number"
              min="0"
              step="0.01"
              value={fields.currentOdometer}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.currentOdometer)}
              aria-describedby={describedBy("currentOdometer")}
              className={inputClass}
            />
            {fieldError("currentOdometer")}
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-5">
        <h2 className="text-base font-semibold text-slate-900">
          Status and availability
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Vehicle status
            </label>
            <select
              id="status"
              name="status"
              value={fields.status}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.status)}
              aria-describedby={describedBy("status")}
              className={inputClass}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
            {fieldError("status")}
          </div>
          <div>
            <label
              htmlFor="availability"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Availability
            </label>
            <select
              id="availability"
              name="availability"
              value={fields.availability}
              onChange={handleChange}
              aria-invalid={Boolean(state.errors.availability)}
              aria-describedby={describedBy("availability")}
              className={inputClass}
            >
              <option value="AVAILABLE" disabled={fields.status !== "ACTIVE"}>
                Available
              </option>
              <option value="ASSIGNED">Assigned to an active trip</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
            {fieldError("availability")}
          </div>
        </div>
        <p className="text-sm text-slate-500">
          A vehicle with a scheduled or in-progress trip must remain active and
          assigned. Inactive and maintenance vehicles are unavailable.
        </p>
      </section>

      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={4000}
          value={fields.notes}
          onChange={handleChange}
          aria-invalid={Boolean(state.errors.notes)}
          aria-describedby={describedBy("notes")}
          className={inputClass}
        />
        {fieldError("notes")}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <VehicleSubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
