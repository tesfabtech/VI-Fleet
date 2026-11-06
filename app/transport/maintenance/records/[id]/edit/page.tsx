import Link from "next/link";
import { notFound } from "next/navigation";
import { updateMaintenanceRecord } from "@/app/transport/maintenance/actions";
import MaintenanceContextPanel from "@/components/maintenance/maintenance-context-panel";
import MaintenanceRecordForm from "@/components/maintenance/maintenance-form";
import { getMaintenancePageState } from "@/lib/maintenance/access";
import { prisma } from "@/lib/prisma";

export default async function EditMaintenanceRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { access, organizations }] = await Promise.all([
    params,
    getMaintenancePageState(),
  ]);
  const isSystemAdministrator =
    access.status === "select-organization" ||
    access.context.isSystemAdministrator;

  if (access.status === "select-organization") {
    return (
      <main className="space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Edit maintenance record</h1>
        <MaintenanceContextPanel
          isSystemAdministrator
          organizations={organizations}
        />
      </main>
    );
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const [record, vehicles] = await Promise.all([
    prisma.maintenanceRecord.findFirst({
      where: {
        id,
        organizationId: access.context.organizationId,
        deletedAt: null,
      },
      include: { vehicle: { select: { deletedAt: true } } },
    }),
    prisma.vehicle.findMany({
      where: {
        organizationId: access.context.organizationId,
        deletedAt: null,
      },
      orderBy: { registrationNumber: "asc" },
      select: { id: true, registrationNumber: true },
    }),
  ]);
  if (!record) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <MaintenanceContextPanel
        isSystemAdministrator={isSystemAdministrator}
        organizationId={access.context.organizationId}
        organizationName={access.context.organizationName}
        organizations={organizations}
      />
      <header>
        <Link
          href={`/transport/maintenance/records/${id}`}
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Back to record
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">
          Edit maintenance record
        </h1>
      </header>
      {record.vehicle.deletedAt ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          This record’s vehicle is no longer active. Select an active vehicle
          before saving changes.
        </p>
      ) : (
        <MaintenanceRecordForm
          action={updateMaintenanceRecord}
          vehicles={vehicles}
          values={{
            id: record.id,
            vehicleId: record.vehicleId,
            maintenanceType: record.maintenanceType,
            title: record.title,
            description: record.description,
            maintenanceDate: record.maintenanceDate.toISOString().slice(0, 10),
            odometer: record.odometer?.toString(),
            cost: record.cost?.toString(),
            serviceProvider: record.serviceProvider,
            status: record.status,
            notes: record.notes,
          }}
          cancelHref={`/transport/maintenance/records/${id}`}
          submitLabel="Save changes"
        />
      )}
    </main>
  );
}
