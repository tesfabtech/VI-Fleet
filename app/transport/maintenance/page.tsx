
import Link from "next/link";
import MaintenanceStats from "@/components/maintenance/maintenance-stats";
import MaintenanceContextPanel from "@/components/maintenance/maintenance-context-panel";
import MaintenanceStatusBadge from "@/components/maintenance/maintenance-status";
import { getMaintenancePageState } from "@/lib/maintenance/access";
import { getMaintenanceDashboard } from "@/lib/maintenance/queries";
import { getMaintenanceScheduleAlert } from "@/lib/maintenance/business-logic";

function formatDate(date: Date | null) {
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export default async function MaintenancePage() {
  const { access, organizations } = await getMaintenancePageState();
  const isSystemAdministrator =
    access.status === "select-organization" ||
    access.context.isSystemAdministrator;

  if (access.status === "select-organization") {
    return (
      <main className="space-y-6 p-4 sm:p-6">
        <header>
          <p className="text-sm font-medium text-blue-700">Transport workspace</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Vehicle Maintenance
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose an organization to review its maintenance information.
          </p>
        </header>
        <MaintenanceContextPanel
          isSystemAdministrator
          organizations={organizations}
        />
      </main>
    );
  }

  const dashboard = await getMaintenanceDashboard(
    access.context.organizationId,
  );
  const contextPanel = (
    <MaintenanceContextPanel
      isSystemAdministrator={isSystemAdministrator}
      organizationId={access.context.organizationId}
      organizationName={access.context.organizationName}
      organizations={organizations}
    />
  );

  return (
    <div className="space-y-6 p-4 sm:space-y-8 sm:p-6">
      {contextPanel}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <header>
          <p className="text-sm font-medium text-blue-700">Fleet operations</p>
          <h1 className="text-2xl font-bold text-gray-900">
            Vehicle Maintenance
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage vehicle maintenance records and service schedules.
          </p>
        </header>
        <Link
          href="/transport/maintenance/records/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          + Add Maintenance Record
        </Link>
      </div>

      <MaintenanceStats
        totalRecords={dashboard.totalRecords}
        scheduled={dashboard.scheduled}
        upcoming={dashboard.upcoming}
        overdue={dashboard.overdue}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Maintenance Records
            </h2>

            <Link
              href="/transport/maintenance/records"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all →
            </Link>
          </div>
          {dashboard.recentRecords.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {dashboard.recentRecords.map((record) => (
                <Link
                  key={record.id}
                  href={`/transport/maintenance/records/${record.id}`}
                  className="flex flex-col justify-between gap-3 py-4 hover:bg-slate-50 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {record.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {record.vehicle.registrationNumber} · {formatDate(record.maintenanceDate)}
                    </p>
                  </div>
                  <MaintenanceStatusBadge status={record.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">
                No maintenance records to display yet.
              </p>
              <Link
                href="/transport/maintenance/records/new"
                className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline"
              >
                Create your first record
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Service Schedules
            </h2>

            <Link
              href="/transport/maintenance/schedules"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all →
            </Link>
          </div>
          {dashboard.recentSchedules.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {dashboard.recentSchedules.map((schedule) => {
                const alert = getMaintenanceScheduleAlert({
                  status: schedule.status,
                  deletedAt: schedule.deletedAt,
                  nextServiceDate: schedule.nextServiceDate,
                  nextServiceOdometer: schedule.nextServiceOdometer,
                  currentOdometer: schedule.vehicle.currentOdometer,
                });
                return (
                  <Link
                    key={schedule.id}
                    href={`/transport/maintenance/schedules/${schedule.id}`}
                    className="flex flex-col justify-between gap-3 py-4 hover:bg-slate-50 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {schedule.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {schedule.vehicle.registrationNumber} · Next service{" "}
                        {formatDate(schedule.nextServiceDate)}
                      </p>
                    </div>
                    <MaintenanceStatusBadge status={alert ?? schedule.status} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">
                No service schedules to display yet.
              </p>
              <Link
                href="/transport/maintenance/schedules/new"
                className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline"
              >
                Create a service schedule
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
