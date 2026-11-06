"use client";

import { useActionState } from "react";
import {
  selectMaintenanceOrganization,
  type MaintenanceActionState,
} from "@/app/transport/maintenance/actions";
import MaintenanceSubmitButton from "@/components/maintenance/maintenance-submit-button";

type OrganizationOption = { id: string; name: string };

const initialState: MaintenanceActionState = { errors: {} };

export default function MaintenanceOrganizationPicker({
  organizations,
  selectedId,
}: {
  organizations: OrganizationOption[];
  selectedId?: string;
}) {
  const [state, action] = useActionState(
    selectMaintenanceOrganization,
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
            defaultValue={selectedId ?? ""}
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
          <MaintenanceSubmitButton label="Open organization" />
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
