"use client";

import { useActionState } from "react";
import {
  selectVehicleOrganization,
  type VehicleActionState,
} from "@/app/transport/vehicles/actions";

type OrganizationOption = { id: string; name: string };

const initialState: VehicleActionState = { errors: {} };

export default function VehicleOrganizationPicker({
  organizations,
}: {
  organizations: OrganizationOption[];
}) {
  const [state, action] = useActionState(
    selectVehicleOrganization,
    initialState,
  );

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
      <h2 className="text-base font-semibold text-slate-900">
        Choose an organization
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        System Administrator access is scoped to the organization selected
        here.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label
            htmlFor="organizationId"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Organization
          </label>
          <select
            id="organizationId"
            name="organizationId"
            required
            aria-invalid={Boolean(state.errors.organizationId)}
            aria-describedby={
              state.errors.organizationId ? "organization-error" : undefined
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="" disabled>
              Select an organization
            </option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          {state.errors.organizationId && (
            <p id="organization-error" className="mt-1 text-sm text-red-700">
              {state.errors.organizationId}
            </p>
          )}
        </div>
        <div className="self-end">
          <button
            type="submit"
            disabled={!organizations.length}
            className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open organization
          </button>
        </div>
      </form>
      {state.message && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
      {!organizations.length && (
        <p className="mt-3 text-sm text-slate-600">
          There are no active organizations available.
        </p>
      )}
    </section>
  );
}
