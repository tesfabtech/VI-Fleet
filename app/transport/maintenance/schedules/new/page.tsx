import Link from "next/link";
import { createMaintenanceSchedule } from "@/app/transport/maintenance/actions";
import MaintenanceContextPanel from "@/components/maintenance/maintenance-context-panel";
import MaintenanceScheduleForm from "@/components/maintenance/schedule-form";
import { getMaintenancePageState } from "@/lib/maintenance/access";
import { prisma } from "@/lib/prisma";

export default async function NewMaintenanceSchedulePage() {
  const { access, organizations } = await getMaintenancePageState();
  const isSystemAdministrator =
    access.status === "select-organization" ||
    access.context.isSystemAdministrator;

  if (access.status === "select-organization") {
    return (
      <main className="space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Create service schedule</h1>
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
          href="/transport/maintenance/schedules"
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Back to schedules
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">
          Create service schedule
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Set the service intervals and due targets for a vehicle.
        </p>
      </header>
      {!vehicles.length ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Add a vehicle to this organization before creating a service schedule.
        </section>
      ) : (
        <MaintenanceScheduleForm
          action={createMaintenanceSchedule}
          vehicles={vehicles}
          cancelHref="/transport/maintenance/schedules"
          submitLabel="Create schedule"
        />
      )}
    </main>
  );
}