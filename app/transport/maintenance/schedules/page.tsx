import Link from "next/link";
import type { MaintenanceStatus, MaintenanceType } from "@prisma/client";
import MaintenanceContextPanel from "@/components/maintenance/maintenance-context-panel";
import MaintenanceFilters from "@/components/maintenance/maintenance-filters";
import MaintenancePagination from "@/components/maintenance/maintenance-pagination";
import MaintenanceScheduleTable from "@/components/maintenance/schedule-table";
import { getMaintenancePageState } from "@/lib/maintenance/access";
import {
  getMaintenanceSchedulesPage,
} from "@/lib/maintenance/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const typeValues = ["PREVENTIVE", "CORRECTIVE", "INSPECTION", "OTHER"] as const;
const statusValues = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

function value(input: string | string[] | undefined): string {
  return typeof input === "string" ? input : "";
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

export default async function MaintenanceSchedulesPage({
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
        <h1 className="text-2xl font-bold text-slate-950">Service schedules</h1>
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
  const filters = {
    search: value(params.search).slice(0, 100),
    type: typeValues.find((item) => item === typeInput) as MaintenanceType | undefined,
    vehicleId: isUuid(value(params.vehicleId)) ? value(params.vehicleId) : undefined,
    status: statusValues.find((item) => item === statusInput) as MaintenanceStatus | undefined,
  };
  const result = await getMaintenanceSchedulesPage(
    access.context.organizationId,
    page,
    filters,
  );
  const values = {
    search: filters.search ?? "",
    type: filters.type ?? "",
    vehicleId: filters.vehicleId ?? "",
    status: filters.status ?? "",
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
            Service schedules
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {result.total} active {result.total === 1 ? "schedule" : "schedules"}
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
            href="/transport/maintenance/schedules/new"
            className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Add schedule
          </Link>
        </div>
      </header>
      {success === "created" && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Service schedule created.
        </p>
      )}
      {success === "deleted" && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Service schedule moved to deleted records.
        </p>
      )}
      <MaintenanceFilters
        action="/transport/maintenance/schedules"
        vehicles={result.vehicles}
        values={values}
      />
      <MaintenanceScheduleTable schedules={result.schedules} />
      <MaintenancePagination
        action="/transport/maintenance/schedules"
        page={result.page}
        pageCount={result.pageCount}
        values={values}
      />
    </main>
  );
}