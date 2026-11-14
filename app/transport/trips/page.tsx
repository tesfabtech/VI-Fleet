import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma, TripStatus } from "@prisma/client";
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

const TRIP_STATUSES: TripStatus[] = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const tripStatusBadge: Record<TripStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    q?: string;
  }>;
};

export default async function TransportTripsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const params = await searchParams;
  const activeTab = params.tab === "trips" ? "trips" : "queue";
  const statusFilter = TRIP_STATUSES.includes(params.status as TripStatus)
    ? (params.status as TripStatus)
    : undefined;
  const query = (params.q ?? "").trim().slice(0, 120);

  // Approved requests awaiting dispatch (either no trip yet, or previous trip was CANCELLED)
  const queueWhere: Prisma.TransportationRequestWhereInput = {
    organizationId,
    status: "APPROVED",
    deletedAt: null,
    OR: [{ trip: { is: null } }, { trip: { status: "CANCELLED" } }],
    ...(query
      ? {
          AND: [
            {
              OR: [
                { purpose: { contains: query, mode: "insensitive" } },
                { origin: { contains: query, mode: "insensitive" } },
                { destination: { contains: query, mode: "insensitive" } },
                {
                  department: { name: { contains: query, mode: "insensitive" } },
                },
              ],
            },
          ],
        }
      : {}),
  };

  const tripsWhere: Prisma.TripWhereInput = {
    organizationId,
    deletedAt: null,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            {
              transportationRequest: {
                purpose: { contains: query, mode: "insensitive" },
              },
            },
            {
              transportationRequest: {
                destination: { contains: query, mode: "insensitive" },
              },
            },
            {
              vehicle: {
                registrationNumber: { contains: query, mode: "insensitive" },
              },
            },
            {
              driver: { firstName: { contains: query, mode: "insensitive" } },
            },
            {
              driver: { lastName: { contains: query, mode: "insensitive" } },
            },
          ],
        }
      : {}),
  };

  const [
    readyToSchedule,
    trips,
    scheduledCount,
    inProgressCount,
    completedCount,
  ] = await Promise.all([
    prisma.transportationRequest.findMany({
      where: queueWhere,
      orderBy: { requestedStart: "asc" },
      take: 30,
      include: {
        department: { select: { name: true } },
        requestedBy: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        reviewedBy: { select: { firstName: true, lastName: true, email: true } },
        trip: { select: { id: true, status: true } },
      },
    }),
    prisma.trip.findMany({
      where: tripsWhere,
      orderBy: { scheduledStart: "desc" },
      take: 30,
      include: {
        transportationRequest: {
          select: {
            id: true,
            purpose: true,
            origin: true,
            destination: true,
            passengerCount: true,
            department: { select: { name: true } },
          },
        },
        vehicle: {
          select: {
            registrationNumber: true,
            make: true,
            model: true,
            seatingCapacity: true,
          },
        },
        driver: {
          select: { firstName: true, lastName: true, phone: true },
        },
      },
    }),
    prisma.trip.count({
      where: { organizationId, status: "SCHEDULED", deletedAt: null },
    }),
    prisma.trip.count({
      where: { organizationId, status: "IN_PROGRESS", deletedAt: null },
    }),
    prisma.trip.count({
      where: { organizationId, status: "COMPLETED", deletedAt: null },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
            Transport Dispatch & Scheduling
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Trip Scheduling & Vehicle Assignment
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Schedule approved transportation requests, validate vehicle and driver availability, and monitor active trips.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/transport/vehicles"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Fleet Vehicles
          </Link>
          <Link
            href="/transport/drivers"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Drivers Directory
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/transport/trips?tab=queue"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-amber-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Ready to Schedule
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {readyToSchedule.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Approved requests awaiting vehicle & driver
          </p>
        </Link>

        <Link
          href="/transport/trips?tab=trips&status=SCHEDULED"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-blue-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Scheduled Trips
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {scheduledCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Assigned and awaiting departure
          </p>
        </Link>

        <Link
          href="/transport/trips?tab=trips&status=IN_PROGRESS"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-emerald-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            In Progress Now
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {inProgressCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Vehicles actively on the road
          </p>
        </Link>

        <Link
          href="/transport/trips?tab=trips&status=COMPLETED"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-slate-400"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Completed Trips
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {completedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Finished dispatches
          </p>
        </Link>
      </div>

      {/* Main Content Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <Link
              href="/transport/trips?tab=queue"
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
                activeTab === "queue"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600"
              }`}
            >
              Approved Requests Ready to Schedule ({readyToSchedule.length})
            </Link>
            <Link
              href="/transport/trips?tab=trips"
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
                activeTab === "trips"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600"
              }`}
            >
              Scheduled & Active Trips ({trips.length})
            </Link>
          </div>

          <form action="/transport/trips" method="GET" className="flex gap-2">
            <input type="hidden" name="tab" value={activeTab} />
            {statusFilter && (
              <input type="hidden" name="status" value={statusFilter} />
            )}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search route, plate, driver, department..."
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 sm:w-64"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              Filter
            </button>
          </form>
        </div>

        {activeTab === "trips" && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/transport/trips?tab=trips"
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                !statusFilter
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              All Trip Statuses
            </Link>
            {TRIP_STATUSES.map((st) => (
              <Link
                key={st}
                href={`/transport/trips?tab=trips&status=${st}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === st
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {st}
              </Link>
            ))}
          </div>
        )}

        {/* TAB 1: Approved Requests Ready to Schedule */}
        {activeTab === "queue" ? (
          readyToSchedule.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-sm font-semibold text-slate-800">
                All approved requests have been scheduled!
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Switch to the "Scheduled & Active Trips" tab to view or manage assigned trips.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-3 pr-4">Approved Request & Route</th>
                    <th className="px-4 py-3">Department & Contact</th>
                    <th className="px-4 py-3">Requested Window (EAT)</th>
                    <th className="px-4 py-3">Passengers & Pref</th>
                    <th className="py-3 pl-4 text-right">Dispatch Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {readyToSchedule.map((req) => {
                    const meta = decodeSpecialRequirements(
                      req.specialRequirements,
                    );
                    const requesterName =
                      [req.requestedBy.firstName, req.requestedBy.lastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() ||
                      req.requestedBy.email ||
                      "Requester";

                    return (
                      <tr key={req.id} className="hover:bg-slate-50 align-top">
                        <td className="py-3.5 pr-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-900">
                              {req.purpose}
                            </span>
                            {meta.priority === "URGENT" && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                URGENT
                              </span>
                            )}
                            {req.trip?.status === "CANCELLED" && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                Needs Rescheduling
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {req.origin} → {req.destination}
                          </p>
                          {meta.adminReviewNote && (
                            <p className="mt-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-900">
                              <strong>Admin Note:</strong>{" "}
                              {meta.adminReviewNote}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs">
                          <p className="font-semibold text-slate-900">
                            {req.department.name}
                          </p>
                          <p className="text-slate-600">
                            {meta.contactName || requesterName}
                          </p>
                          {(meta.contactPhone || req.requestedBy.phone) && (
                            <p className="text-slate-500">
                              {meta.contactPhone || req.requestedBy.phone}
                            </p>
                          )}
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
                            {req.passengerCount} pax
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
          )
        ) : /* TAB 2: Scheduled & Active Trips */
        trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No scheduled trips match the current filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 pr-4">Trip & Department</th>
                  <th className="px-4 py-3">Assigned Vehicle</th>
                  <th className="px-4 py-3">Assigned Driver</th>
                  <th className="px-4 py-3">Scheduled Window (EAT)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="py-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50">
                    <td className="py-3.5 pr-4">
                      <Link
                        href={`/transport/trips/${trip.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {trip.transportationRequest.purpose}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {trip.transportationRequest.department.name} •{" "}
                        {trip.transportationRequest.origin} →{" "}
                        {trip.transportationRequest.destination} (
                        {trip.transportationRequest.passengerCount} pax)
                      </p>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <p className="font-semibold text-slate-900">
                        {trip.vehicle.registrationNumber}
                      </p>
                      <p className="text-slate-500">
                        {[trip.vehicle.make, trip.vehicle.model]
                          .filter(Boolean)
                          .join(" ") || "Fleet Vehicle"}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <p className="font-semibold text-slate-900">
                        {trip.driver.firstName} {trip.driver.lastName}
                      </p>
                      {trip.driver.phone && (
                        <p className="text-slate-500">{trip.driver.phone}</p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      <div>{formatAddisDateTime(trip.scheduledStart)}</div>
                      <div className="text-slate-400">
                        to {formatAddisDateTime(trip.scheduledEnd)}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tripStatusBadge[trip.status]}`}
                      >
                        {trip.status}
                      </span>
                    </td>

                    <td className="py-3.5 pl-4 text-right text-xs font-semibold">
                      <Link
                        href={`/transport/trips/${trip.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {trip.status === "SCHEDULED"
                          ? "Manage / Reassign"
                          : "View Details"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}