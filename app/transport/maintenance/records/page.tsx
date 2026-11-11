import Link from "next/link";
import type { MaintenanceStatus, MaintenanceType } from "@prisma/client";
import MaintenanceContextPanel from "@/components/maintenance/maintenance-context-panel";
import MaintenanceFilters from "@/components/maintenance/maintenance-filters";
import MaintenancePagination from "@/components/maintenance/maintenance-pagination";
import MaintenanceRecordsTable from "@/components/maintenance/maintenance-table";
import { getMaintenancePageState } from "@/lib/maintenance/access";
import {
  getMaintenanceRecordsPage,
} from "@/lib/maintenance/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const typeValues = ["PREVENTIVE", "CORRECTIVE", "INSPECTION", "OTHER"] as const;
const statusValues = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

function value(input: string | string[] | undefined): string {
  return typeof input === "string" ? input : "";
}

function dateValue(input: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  const date = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input
    ? undefined
    : date;
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

export default async function MaintenanceRecordsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [params, { access, organizations }] = await Promise.all([
    searchParams,
    getMaintenancePageState(),
  ]);
  const isSystemAdministrator =
    access.status === "select-organization" ||
    access.context.isSystemAdministrator;
  const selectedId =
    access.status === "ready" ? access.context.organizationId : undefined;

  if (access.status === "select-organization") {
    return (
      <main className="space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Maintenance records</h1>
        <MaintenanceContextPanel
          isSystemAdministrator
          organizations={organizations}
        />
      </main>
    );
  }

  const pageInput = Number(value(params.page) || "1");
  const page = Number.isSafeInteger(pageInput)
    ? Math.max(1, Math.min(pageInput, 100000))
    : 1;
  const typeInput = value(params.type);
  const statusInput = value(params.status);
  const fromInput = value(params.from);
  const toInput = value(params.to);
  const from = dateValue(fromInput);
  const to = dateValue(toInput);
  const filterError =
    (fromInput && !from) ||
    (toInput && !to) ||
    (from && to && from > to);
  const filters = {
    search: value(params.search).slice(0, 100),
    type: typeValues.find((item) => item === typeInput) as MaintenanceType | undefined,
    vehicleId: isUuid(value(params.vehicleId)) ? value(params.vehicleId) : undefined,
    status: statusValues.find((item) => item === statusInput) as MaintenanceStatus | undefined,
    from: filterError ? undefined : from,
    to: filterError ? undefined : to,
  };
  const result = await getMaintenanceRecordsPage(
    access.context.organizationId,
    page,
    filters,
  );
  const values = {
    search: filters.search ?? "",
    type: filters.type ?? "",
    vehicleId: filters.vehicleId ?? "",
    status: filters.status ?? "",
    from: filterError ? "" : fromInput,
    to: filterError ? "" : toInput,
  };
  const success = value(params.success);

  return (
    <main className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <MaintenanceContextPanel
        isSystemAdministrator={isSystemAdministrator}
        organizationId={selectedId}
        organizationName={access.context.organizationName}
        organizations={organizations}
      />
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-blue-700">Vehicle Maintenance</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Maintenance records
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {result.total} active {result.total === 1 ? "record" : "records"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/transport/maintenance"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            Dashboard
          </Link>
          <Link
            href="/transport/maintenance/records/new"
            className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Add record
          </Link>
        </div>
      </header>
      {success === "created" && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Maintenance record created.
        </p>
      )}
      {success === "deleted" && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Maintenance record moved to deleted records.
        </p>
      )}
      {filterError && (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Enter valid dates and ensure the start date is not after the end date.
        </p>
      )}
      <MaintenanceFilters
        action="/transport/maintenance/records"
        vehicles={result.vehicles}
        values={values}
        withDateRange
      />
      <MaintenanceRecordsTable records={result.records} />
      <MaintenancePagination
        action="/transport/maintenance/records"
        page={result.page}
        pageCount={result.pageCount}
        values={values}
      />
    </main>
  );
}