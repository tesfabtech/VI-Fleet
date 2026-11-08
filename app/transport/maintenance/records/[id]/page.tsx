import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMaintenanceRecord } from "@/app/transport/maintenance/actions";
import MaintenanceContextPanel from "@/components/maintenance/maintenance-context-panel";
import MaintenanceDeleteButton from "@/components/maintenance/maintenance-delete-button";
import MaintenanceStatusBadge from "@/components/maintenance/maintenance-status";
import { getMaintenancePageState } from "@/lib/maintenance/access";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Addis_Ababa",
  }).format(date);
}

export default async function MaintenanceRecordDetailsPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, query, { access, organizations }] = await Promise.all([
    params,
    searchParams,
    getMaintenancePageState(),
  ]);
  const isSystemAdministrator =
    access.status === "select-organization" ||
    access.context.isSystemAdministrator;

  if (access.status === "select-organization") {
    return (
      <main className="space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Maintenance record</h1>
        <MaintenanceContextPanel
          isSystemAdministrator
          organizations={organizations}
        />
      </main>
    );
  }
  if (!isUuid(id)) notFound();

  const record = await prisma.maintenanceRecord.findFirst({
    where: {
      id,
      organizationId: access.context.organizationId,
      deletedAt: null,
    },
    include: {
      vehicle: {
        select: {
          registrationNumber: true,
          make: true,
          model: true,
          year: true,
        },
      },
    },
  });
  if (!record) notFound();

  const success = typeof query.success === "string" ? query.success : "";
  const details = [
    ["Vehicle", [record.vehicle.registrationNumber, record.vehicle.year, record.vehicle.make, record.vehicle.model].filter(Boolean).join(" ")],
    ["Maintenance type", record.maintenanceType.toLowerCase()],
    ["Service date", formatDate(record.maintenanceDate)],
    ["Odometer", record.odometer?.toString() ?? "—"],
    ["Cost", record.cost?.toString() ?? "—"],
    ["Service provider", record.serviceProvider ?? "—"],
    ["Created", formatTimestamp(record.createdAt)],
    ["Last updated", formatTimestamp(record.updatedAt)],
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <MaintenanceContextPanel
        isSystemAdministrator={isSystemAdministrator}
        organizationId={access.context.organizationId}
        organizationName={access.context.organizationName}
        organizations={organizations}
      />
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/transport/maintenance/records"
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            ← Back to records
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-950">{record.title}</h1>
            <MaintenanceStatusBadge status={record.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/transport/maintenance/records/${record.id}/edit`}
            className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Edit
          </Link>
          <form action={deleteMaintenanceRecord}>
            <input type="hidden" name="id" value={record.id} />
            <MaintenanceDeleteButton label="Delete" />
          </form>
        </div>
      </header>
      {success === "updated" && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Maintenance record updated.
        </p>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold text-slate-950">Service information</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-sm text-slate-500">Description</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{record.description || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-slate-500">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{record.notes || "—"}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}