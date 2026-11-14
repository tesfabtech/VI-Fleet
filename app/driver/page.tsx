import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";
import {
  decodeSpecialRequirements,
  formatAddisDateTime,
} from "@/lib/department-auth";
import { parseTripNotesAndHistory } from "@/lib/trip-scheduling";
import { TripLifecycleControls } from "@/app/transport/trips/trip-forms";

const navigation = [{ label: "My Assignments", href: "/driver" }];

const statusBadge: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function DriverDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "DRIVER") notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const driver = await prisma.driver.findFirst({
    where: {
      organizationId,
      userId: session.user.id,
      deletedAt: null,
    },
    include: {
      organization: { select: { name: true } },
      trips: {
        where: { deletedAt: null },
        orderBy: { scheduledStart: "asc" },
        include: {
          vehicle: {
            select: {
              registrationNumber: true,
              make: true,
              model: true,
              vehicleType: true,
              seatingCapacity: true,
              currentOdometer: true,
            },
          },
          transportationRequest: {
            select: {
              purpose: true,
              origin: true,
              destination: true,
              passengerCount: true,
              specialRequirements: true,
              department: { select: { name: true } },
              requestedBy: {
                select: { firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      },
    },
  });

  if (!driver) {
    return (
      <ManagementDashboardShell
        brand="Driver"
        roleLabel="Driver"
        userName={session.user.name ?? "Driver"}
        navigation={navigation}
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Your user account is not yet linked to an active driver profile in your organization. Please contact your Transport Manager.
        </div>
      </ManagementDashboardShell>
    );
  }

  const activeTrips = driver.trips.filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "SCHEDULED",
  );
  const completedTrips = driver.trips
    .filter((t) => t.status === "COMPLETED")
    .reverse();

  return (
    <ManagementDashboardShell
      brand="Driver"
      roleLabel={`${driver.organization.name} • Driver`}
      userName={`${driver.firstName} ${driver.lastName}`}
      navigation={navigation}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            License #{driver.licenseNumber} • {driver.status}
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Welcome, {driver.firstName} {driver.lastName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Review your assigned driving duties, check pickup contacts and vehicle details, and log starting/ending odometer readings.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Upcoming & Active Trips
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-600">
              {activeTrips.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Completed Trips
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {completedTrips.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Driver Status
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {driver.status}
            </p>
          </div>
        </div>

        {/* Active & Scheduled Assignments */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            My Active & Upcoming Trip Assignments
          </h2>

          {activeTrips.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-slate-800">
                You have no scheduled or active trips right now.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                When a Transport Manager assigns you to a trip, it will appear here automatically.
              </p>
            </div>
          ) : (
            activeTrips.map((trip) => {
              const req = trip.transportationRequest;
              const meta = decodeSpecialRequirements(req.specialRequirements);
              const { cleanNotes } = parseTripNotesAndHistory(trip.notes);
              const contactName =
                meta.contactName ||
                [req.requestedBy.firstName, req.requestedBy.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim() ||
                "Passenger Contact";
              const contactPhone =
                meta.contactPhone || req.requestedBy.phone || "Contact Office";

              return (
                <div
                  key={trip.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {req.origin} → {req.destination}
                        </h3>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge[trip.status]}`}
                        >
                          {trip.status}
                        </span>
                        {meta.priority === "URGENT" && (
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                            URGENT
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Department: <strong>{req.department.name}</strong> •
                        Purpose: {req.purpose}
                      </p>
                    </div>
                  </div>

                  {/* Privacy-Scoped Assignment Details */}
                  <div className="grid gap-4 text-xs sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="font-semibold text-slate-500 uppercase">
                        Assigned Vehicle
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {trip.vehicle.registrationNumber}
                      </p>
                      <p className="text-slate-600">
                        {[trip.vehicle.make, trip.vehicle.model]
                          .filter(Boolean)
                          .join(" ")}{" "}
                        ({trip.vehicle.seatingCapacity ?? "N/A"} seats)
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="font-semibold text-slate-500 uppercase">
                        Scheduled Window (EAT)
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {formatAddisDateTime(trip.scheduledStart)}
                      </p>
                      <p className="text-slate-600">
                        to {formatAddisDateTime(trip.scheduledEnd)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="font-semibold text-slate-500 uppercase">
                        On-Site Pickup Contact
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {contactName}
                      </p>
                      <p className="text-slate-600">Tel: {contactPhone}</p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="font-semibold text-slate-500 uppercase">
                        Passengers & Cargo
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {req.passengerCount} passenger(s)
                      </p>
                      {meta.cargoDetails && (
                        <p className="text-slate-600">{meta.cargoDetails}</p>
                      )}
                    </div>
                  </div>

                  {(cleanNotes || meta.extraRequirements) && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-xs text-slate-800 space-y-1">
                      {cleanNotes && (
                        <p>
                          <strong>Dispatch Instructions:</strong> {cleanNotes}
                        </p>
                      )}
                      {meta.extraRequirements && (
                        <p>
                          <strong>Special Requirements:</strong>{" "}
                          {meta.extraRequirements}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Driver Start / Complete / Breakdown Controls */}
                  <TripLifecycleControls
                    tripId={trip.id}
                    currentStatus={trip.status}
                    defaultOdometer={
                      trip.startOdometer
                        ? Number(trip.startOdometer)
                        : trip.vehicle.currentOdometer
                          ? Number(trip.vehicle.currentOdometer)
                          : null
                    }
                  />
                </div>
              );
            })
          )}
        </section>

        {/* Completed Trip History */}
        {completedTrips.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">
              Recent Completed Trips
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead>
                  <tr className="font-semibold text-slate-500 uppercase">
                    <th className="py-2.5 pr-4">Route & Department</th>
                    <th className="px-4 py-2.5">Vehicle</th>
                    <th className="px-4 py-2.5">Completed On</th>
                    <th className="py-2.5 pl-4 text-right">Distance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedTrips.slice(0, 10).map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">
                        {t.transportationRequest.origin} →{" "}
                        {t.transportationRequest.destination} (
                        {t.transportationRequest.department.name})
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {t.vehicle.registrationNumber}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {t.actualEnd
                          ? formatAddisDateTime(t.actualEnd)
                          : formatAddisDateTime(t.scheduledEnd)}
                      </td>
                      <td className="py-2.5 pl-4 text-right font-semibold text-emerald-700">
                        {t.distanceKm ? `${Number(t.distanceKm)} km` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </ManagementDashboardShell>
  );
}
