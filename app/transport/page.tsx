import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  decodeSpecialRequirements,
  formatAddisDateTime,
} from "@/lib/department-auth";
import { TransportCannotFulfilButton } from "@/app/organization/requests/review-actions";

const ALLOWED_ROLES = [
  "SYSTEM_ADMINISTRATOR",
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
];

export default async function TransportDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const [
    awaitingDispatchRequests,
    scheduledTripsCount,
    activeVehiclesCount,
    activeDriversCount,
  ] = await Promise.all([
    prisma.transportationRequest.findMany({
      where: {
        organizationId,
        status: "APPROVED",
        deletedAt: null,
        OR: [{ trip: { is: null } }, { trip: { status: "CANCELLED" } }],
      },
      orderBy: { requestedStart: "asc" },
      take: 15,
      include: {
        department: { select: { name: true } },
        requestedBy: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        reviewedBy: { select: { firstName: true, lastName: true, email: true } },
        trip: { select: { id: true, status: true } },
      },
    }),
    prisma.trip.count({
      where: {
        organizationId,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        deletedAt: null,
      },
    }),
    prisma.vehicle.count({
      where: { organizationId, status: "ACTIVE", deletedAt: null },
    }),
    prisma.driver.count({
      where: { organizationId, status: "ACTIVE", deletedAt: null },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
            Transport Operations Workspace
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Dispatch & Fleet Overview
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Schedule organization-approved transportation requests, assign eligible vehicles and drivers, and track active fleet trips.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/transport/trips"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            Open Trip Scheduling ({awaitingDispatchRequests.length})
          </Link>
          <Link
            href="/transport/vehicles"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Vehicles ({activeVehiclesCount})
          </Link>
          <Link
            href="/transport/drivers"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Drivers ({activeDriversCount})
          </Link>
        </div>
      </section>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/transport/trips?tab=queue"
          className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs transition hover:border-emerald-400"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Approved & Ready to Schedule
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {awaitingDispatchRequests.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Assign vehicle & driver →
          </p>
        </Link>

        <Link
          href="/transport/trips?tab=trips"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Scheduled / Active Trips
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {scheduledTripsCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Manage active trips →</p>
        </Link>

        <Link
          href="/transport/vehicles"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Active Fleet Vehicles
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {activeVehiclesCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">View fleet vehicles →</p>
        </Link>

        <Link
          href="/transport/drivers"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Active Drivers
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {activeDriversCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">View drivers directory →</p>
        </Link>
      </div>

      {/* Organization-Approved Requests Handoff Queue */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Organization-Approved Requests Ready for Scheduling
            </h3>
            <p className="text-xs text-slate-500">
              Click "Schedule Vehicle & Driver" on any approved request below to assign an eligible vehicle and driver.
            </p>
          </div>
          <Link
            href="/transport/trips?tab=trips"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            View All Scheduled Trips →
          </Link>
        </div>

        {awaitingDispatchRequests.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No approved requests are currently waiting for dispatch.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 pr-4">Purpose, Route & Admin Note</th>
                  <th className="px-4 py-3">Department & Contact</th>
                  <th className="px-4 py-3">Departure Window (EAT)</th>
                  <th className="px-4 py-3">Pax & Vehicle Pref</th>
                  <th className="py-3 pl-4 text-right">Dispatch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {awaitingDispatchRequests.map((req) => {
                  const meta = decodeSpecialRequirements(req.specialRequirements);
                  const requesterName =
                    [req.requestedBy.firstName, req.requestedBy.lastName]
                      .filter(Boolean)
                      .join(" ")
                      .trim() ||
                    req.requestedBy.email ||
                    "Requester";
                  const approverName = req.reviewedBy
                    ? [req.reviewedBy.firstName, req.reviewedBy.lastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || req.reviewedBy.email
                    : "Organization Admin";

                  return (
                    <tr key={req.id} className="hover:bg-slate-50 align-top">
                      <td className="py-3.5 pr-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/transport/trips/schedule/${req.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600"
                          >
                            {req.purpose}
                          </Link>
                          {meta.priority === "URGENT" && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              URGENT
                            </span>
                          )}
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Approved by {approverName}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {req.origin} → {req.destination}
                        </p>
                        {meta.adminReviewNote && (
                          <p className="mt-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-900">
                            <strong>Admin Note:</strong> {meta.adminReviewNote}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        <p className="font-semibold text-slate-900">
                          {req.department.name}
                        </p>
                        <p className="text-slate-600">
                          Contact: {meta.contactName || requesterName}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <div className="font-semibold">
                          {formatAddisDateTime(req.requestedStart)}
                        </div>
                        <div className="text-slate-400">
                          to {formatAddisDateTime(req.requestedEnd)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <p className="font-semibold">
                          {req.passengerCount} passenger(s)
                        </p>
                        <p className="text-slate-500">
                          Pref: {meta.vehiclePreference}
                        </p>
                      </td>

                      <td className="py-3.5 pl-4 text-right">
                        <div className="inline-flex flex-col items-end gap-1.5">
                          <Link
                            href={`/transport/trips/schedule/${req.id}`}
                            className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
                          >
                            Schedule Vehicle & Driver →
                          </Link>
                          <TransportCannotFulfilButton
                            requestId={req.id}
                            existingFlag={meta.transportFlagReason}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}