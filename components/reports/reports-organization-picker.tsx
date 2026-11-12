"use client";

import { useActionState } from "react";
import {
  selectReportsOrganization,
  type ReportsActionState,
} from "@/lib/reports/actions";

type OrganizationOption = { id: string; name: string };

const initialState: ReportsActionState = { errors: {} };

export default function ReportsOrganizationPicker({
  organizations,
  currentOrganizationId,
}: {
  organizations: OrganizationOption[];
  currentOrganizationId?: string;
}) {
  const [state, action, isPending] = useActionState(
    selectReportsOrganization,
    initialState,
  );

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            System Administrator Tenant Scope
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Switch organization scope to view and export isolated tenant reports.
          </p>
        </div>

        <form action={action} className="flex items-center gap-2">
          <select
            id="organizationId"
            name="organizationId"
            defaultValue={currentOrganizationId || ""}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="" disabled>
              Select organization
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Switching..." : "Switch"}
          </button>
        </form>
      </div>

      {state.errors.organizationId && (
        <p className="mt-2 text-xs font-medium text-red-600">
          {state.errors.organizationId[0]}
        </p>
      )}
      {state.errors.general && (
        <p className="mt-2 text-xs font-medium text-red-600">
          {state.errors.general[0]}
        </p>
      )}
    </div>
  );
}
