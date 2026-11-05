import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  decodeSpecialRequirements,
  formatAddisDateTime,
  requireDepartmentUserContext,
} from "@/lib/department-auth";

const badge: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function DepartmentDashboardPage() {
  const ctx = await requireDepartmentUserContext();
  const baseWhere = {
    organizationId: ctx.organizationId,
    departmentId: ctx.departmentId,
    deletedAt: null,
  };

  const [
    myPending,
    myApproved,
    deptTotal,
    completedTrips,
    recentRequests,
    upcomingApproved,
    maxVeh,
  ] = await Promise.all([
    prisma.transportationRequest.count({
      where: { ...baseWhere, requestedById: ctx.userId, status: "PENDING" },
    }),
    prisma.transportationRequest.count({
      where: { ...baseWhere, requestedById: ctx.userId, status: "APPROVED" },
    }),
    prisma.transportationRequest.count({ where: baseWhere }),
    prisma.trip.count({
      where: {
        organizationId: ctx.organizationId,
        status: "COMPLETED",
        deletedAt: null,
        transportationRequest: { departmentId: ctx.departmentId, requestedById: ctx.userId },
      },
    }),
    prisma.transportationRequest.findMany({
      where: { ...baseWhere, requestedById: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.transportationRequest.findMany({
      where: {
        ...baseWhere,
        requestedById: ctx.userId,
        status: "APPROVED",
        requestedEnd: { gte: new Date() },
      },
      orderBy: { requestedStart: "asc" },
      take: 3,
      include: {
        trip: {
          include: {
            vehicle: { select: { registrationNumber: true, make: true, model: true } },
            driver: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    }),
    prisma.vehicle.aggregate({
      where: { organizationId: ctx.organizationId, status: "ACTIVE", deletedAt: null },
      _max: { seatingCapacity: true },
    }),
  ]);

  const maxSeats = maxVeh._max.seatingCapacity ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {ctx.organizationName}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {ctx.departmentName}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Welcome, {ctx.userName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Submit transportation requests electronically and monitor approval decisions and vehicle dispatches.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/department/requests/new"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            + New Transport Request
          </Link>
          <Link
            href="/department/requests"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            All Requests
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "My Pending", val: myPending, color: "text-amber-600", href: "/department/requests?scope=mine&status=PENDING" },
          { label: "My Approved", val: myApproved, color: "text-emerald-600", href: "/department/requests?scope=mine&status=APPROVED" },
          { label: `${ctx.departmentName} Total`, val: deptTotal, color: "text-slate-900", href: "/department/requests?scope=department" },
          { label: "Completed Trips", val: completedTrips, color: "text-blue-600", href: "/department/requests?scope=mine" },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300"
          >
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.val}</p>
          </Link>
        ))}
      </div>

      {upcomingApproved.length > 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
          <h2 className="text-base font-bold text-slate-900">Upcoming Approved Trips</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {upcomingApproved.map((req) => (
              <Link
                key={req.id}
                href={`/department/requests/${req.id}`}
                className="rounded-xl border border-emerald-200 bg-white p-4 shadow-2xs hover:border-emerald-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{req.purpose}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    {req.trip ? req.trip.status : "APPROVED"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-700">
                  {req.origin} → {req.destination}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Departs: {formatAddisDateTime(req.requestedStart)}
                </p>
                {req.trip ? (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                    <strong>{req.trip.vehicle.registrationNumber}</strong> • Driver: {req.trip.driver.firstName} {req.trip.driver.lastName}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-amber-700">Awaiting vehicle & driver assignment</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">My Recent Requests</h2>
          <Link href="/department/requests" className="text-sm font-semibold text-blue-600 hover:underline">
            View All →
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">No transportation requests submitted yet.</p>
            <Link
              href="/department/requests/new"
              className="mt-3 inline-block rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              + Submit First Request
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 pr-4">Purpose & Route</th>
                  <th className="px-4 py-3">Departure (EAT)</th>
                  <th className="px-4 py-3">Passengers</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="py-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRequests.map((req) => {
                  const meta = decodeSpecialRequirements(req.specialRequirements);
                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/department/requests/${req.id}`} className="font-semibold text-slate-900 hover:text-blue-600">
                            {req.purpose}
                          </Link>
                          {meta.priority === "URGENT" && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">URGENT</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{req.origin} → {req.destination}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{formatAddisDateTime(req.requestedStart)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {req.passengerCount}
                        {maxSeats > 0 && req.passengerCount > maxSeats && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Multi-vehicle
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge[req.status]}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right text-xs font-semibold space-x-3">
                        <Link href={`/department/requests/${req.id}`} className="text-blue-600 hover:underline">
                          {req.status === "PENDING" ? "Edit / View" : "Details"}
                        </Link>
                        <Link href={`/department/requests/new?cloneFrom=${req.id}`} className="text-slate-500 hover:text-slate-800">
                          Clone
                        </Link>
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