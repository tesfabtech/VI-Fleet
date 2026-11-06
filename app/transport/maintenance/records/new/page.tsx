import Link from "next/link";
import MaintenanceContextPanel from "@/components/maintenance/maintenance-context-panel";
import MaintenanceRecordForm from "@/components/maintenance/maintenance-form";
import { createMaintenanceRecord } from "@/app/transport/maintenance/actions";
import { getMaintenancePageState } from "@/lib/maintenance/access";
import { prisma } from "@/lib/prisma";

export default async function NewMaintenanceRecordPage() {
  const { access, organizations } = await getMaintenancePageState();
  const isSystemAdministrator =
    access.status === "select-organization" ||
    access.context.isSystemAdministrator;

  if (access.status === "select-organization") {
    return (
      <main className="space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Add maintenance record</h1>
        <MaintenanceContextPanel
          isSystemAdministrator
          organizations={organizations}
        />
      </main>
    );
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      organizationId: access.context.organizationId,
      deletedAt: null,
      status: "MAINTENANCE",
    },
    orderBy: { registrationNumber: "asc" },
    select: { id: true, registrationNumber: true },
  });

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
          href="/transport/maintenance/records"
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Back to records
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">
          Add maintenance record
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Record service work performed on an organization vehicle.
        </p>
      </header>
      {!vehicles.length ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Set a vehicle’s status to Maintenance before recording maintenance.
        </section>
      ) : (
        <MaintenanceRecordForm
          action={createMaintenanceRecord}
          vehicles={vehicles}
          values={{ maintenanceDate: new Date().toISOString().slice(0, 10) }}
          cancelHref="/transport/maintenance/records"
          submitLabel="Create record"
        />
      )}
    </main>
  );
}