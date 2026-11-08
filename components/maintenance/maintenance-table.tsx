import Link from "next/link";
import type { MaintenanceStatus, MaintenanceType, Prisma } from "@prisma/client";
import MaintenanceStatusBadge from "@/components/maintenance/maintenance-status";

type RecordRow = {
  id: string;
  title: string;
  maintenanceType: MaintenanceType;
  maintenanceDate: Date;
  odometer: Prisma.Decimal | null;
  cost: Prisma.Decimal | null;
  serviceProvider: string | null;
  status: MaintenanceStatus;
  vehicle: {
    id: string;
    registrationNumber: string;
    make: string | null;
    model: string | null;
  };
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export default function MaintenanceRecordsTable({
  records,
}: {
  records: RecordRow[];
}) {
  if (!records.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
        <h2 className="font-semibold text-slate-900">No records found</h2>
        <p className="mt-1 text-sm text-slate-500">
          Try changing the filters or add a maintenance record.
        </p>
        <Link
          href="/transport/maintenance/records/new"
          className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Add maintenance record
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {records.map((record) => (
          <article key={record.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/transport/maintenance/records/${record.id}`}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  {record.title}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  {record.vehicle.registrationNumber} · {record.maintenanceType.toLowerCase()}
                </p>
              </div>
              <MaintenanceStatusBadge status={record.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Service date</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{formatDate(record.maintenanceDate)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Odometer</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{record.odometer?.toString() ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Cost</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{record.cost?.toString() ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Service provider</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{record.serviceProvider ?? "—"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Record</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Service date</th>
              <th className="px-4 py-3">Odometer</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{record.title}</td>
                <td className="px-4 py-3 text-slate-600">{record.vehicle.registrationNumber}</td>
                <td className="px-4 py-3 text-slate-600">{record.maintenanceType.toLowerCase()}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(record.maintenanceDate)}</td>
                <td className="px-4 py-3 text-slate-600">{record.odometer?.toString() ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{record.cost?.toString() ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{record.serviceProvider ?? "—"}</td>
                <td className="px-4 py-3"><MaintenanceStatusBadge status={record.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/transport/maintenance/records/${record.id}`} className="font-semibold text-blue-700 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}