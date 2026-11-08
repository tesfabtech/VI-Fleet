import Link from "next/link";
import type { MaintenanceStatus, MaintenanceType, Prisma } from "@prisma/client";
import { getMaintenanceScheduleAlert } from "@/lib/maintenance/business-logic";
import MaintenanceStatusBadge from "@/components/maintenance/maintenance-status";

type ScheduleRow = {
  id: string;
  title: string;
  maintenanceType: MaintenanceType;
  intervalDays: number | null;
  intervalKm: Prisma.Decimal | null;
  lastServiceDate: Date | null;
  lastServiceOdometer: Prisma.Decimal | null;
  nextServiceDate: Date | null;
  nextServiceOdometer: Prisma.Decimal | null;
  status: MaintenanceStatus;
  deletedAt: Date | null;
  vehicle: {
    id: string;
    registrationNumber: string;
    make: string | null;
    model: string | null;
    currentOdometer: Prisma.Decimal | null;
  };
};

function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date)
    : "—";
}

function displayStatus(schedule: ScheduleRow): "UPCOMING" | "OVERDUE" | MaintenanceStatus {
  return (
    getMaintenanceScheduleAlert({
      status: schedule.status,
      deletedAt: schedule.deletedAt,
      nextServiceDate: schedule.nextServiceDate,
      nextServiceOdometer: schedule.nextServiceOdometer,
      currentOdometer: schedule.vehicle.currentOdometer,
    }) ?? schedule.status
  );
}

export default function MaintenanceScheduleTable({
  schedules,
}: {
  schedules: ScheduleRow[];
}) {
  if (!schedules.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
        <h2 className="font-semibold text-slate-900">No schedules found</h2>
        <p className="mt-1 text-sm text-slate-500">
          Try changing the filters or create a service schedule.
        </p>
        <Link
          href="/transport/maintenance/schedules/new"
          className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Create service schedule
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {schedules.map((schedule) => (
          <article key={schedule.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/transport/maintenance/schedules/${schedule.id}`} className="font-semibold text-blue-700 hover:underline">
                  {schedule.title}
                </Link>
                <p className="mt-1 text-sm text-slate-600">{schedule.vehicle.registrationNumber}</p>
              </div>
              <MaintenanceStatusBadge status={displayStatus(schedule)} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Interval</dt><dd className="mt-0.5 text-slate-800">{schedule.intervalDays ? `${schedule.intervalDays} days` : "—"}{schedule.intervalKm ? ` · ${schedule.intervalKm.toString()} km` : ""}</dd></div>
              <div><dt className="text-slate-500">Last service</dt><dd className="mt-0.5 text-slate-800">{formatDate(schedule.lastServiceDate)}</dd></div>
              <div><dt className="text-slate-500">Next service</dt><dd className="mt-0.5 text-slate-800">{formatDate(schedule.nextServiceDate)}</dd></div>
              <div><dt className="text-slate-500">Next odometer</dt><dd className="mt-0.5 text-slate-800">{schedule.nextServiceOdometer?.toString() ?? "—"}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Schedule</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Interval</th>
              <th className="px-4 py-3">Last service</th>
              <th className="px-4 py-3">Last odometer</th>
              <th className="px-4 py-3">Next service</th>
              <th className="px-4 py-3">Next odometer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedules.map((schedule) => (
              <tr key={schedule.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{schedule.title}</td>
                <td className="px-4 py-3 text-slate-600">{schedule.vehicle.registrationNumber}</td>
                <td className="px-4 py-3 text-slate-600">{schedule.intervalDays ? `${schedule.intervalDays} days` : "—"}{schedule.intervalKm ? ` / ${schedule.intervalKm.toString()} km` : ""}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(schedule.lastServiceDate)}</td>
                <td className="px-4 py-3 text-slate-600">{schedule.lastServiceOdometer?.toString() ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(schedule.nextServiceDate)}</td>
                <td className="px-4 py-3 text-slate-600">{schedule.nextServiceOdometer?.toString() ?? "—"}</td>
                <td className="px-4 py-3"><MaintenanceStatusBadge status={displayStatus(schedule)} /></td>
                <td className="px-4 py-3 text-right"><Link href={`/transport/maintenance/schedules/${schedule.id}`} className="font-semibold text-blue-700 hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}