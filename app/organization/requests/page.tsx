import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma, TransportationRequestStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  decodeSpecialRequirements,
  formatAddisDateTime,
  formatWaitingDuration,
  isUuid,
} from "@/lib/department-auth";

const PAGE_SIZE = 10;
const ALLOWED_ROLES = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];
const STATUSES: TransportationRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

const statusStyles: Record<TransportationRequestStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

type PageProps = {
  searchParams: Promise<{
    status?: string;
    departmentId?: string;
    priority?: string;
    q?: string;
    page?: string;
  }>;
};

export default async function OrganizationRequestsReviewPage({
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: {
        select: { id: true, name: true, status: true, deletedAt: true },
      },
    },
  });

  if (
    !user ||
    user.deletedAt !== null ||
    user.status !== "ACTIVE" ||
    !user.organizationId ||
    !user.organization ||
    user.organization.deletedAt !== null ||
    user.organization.status !== "ACTIVE"
  ) {
    notFound();
  }

  const organizationId = user.organizationId;
  const params = await searchParams;

  // Strict server-side query param validation
  const statusFilter = STATUSES.includes(
    params.status as TransportationRequestStatus,
  )
    ? (params.status as TransportationRequestStatus)
    : undefined;
  const departmentFilter =
    params.departmentId && isUuid(params.departmentId)
      ? params.departmentId
      : undefined;
  const priorityFilter = params.priority === "URGENT" ? "URGENT" : undefined;
  const query = (params.q ?? "").trim().slice(0, 120);
  const currentPage = Math.max(1, Number(params.page) || 1);

  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 3600_000);

  const where: Prisma.TransportationRequestWhereInput = {
    organizationId,
    deletedAt: null,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(departmentFilter ? { departmentId: departmentFilter } : {}),
    ...(priorityFilter === "URGENT"
      ? { specialRequirements: { contains: "PRIORITY=URGENT" } }
      : {}),
    ...(query
      ? {
          OR: [
            { purpose: { contains: query, mode: "insensitive" } },
            { origin: { contains: query, mode: "insensitive" } },
            { destination: { contains: query, mode: "insensitive" } },
            {
              department: { name: { contains: query, mode: "insensitive" } },
            },
          ],
        }
      : {}),
  };

  const [
    totalMatching,
    requests,
    departments,
    pendingCount,
    urgentOrImminentCount,
    awaitingDispatchCount,
    dispatchedOrClosedCount,
    maxVeh,
  ] = await Promise.all([
    prisma.transportationRequest.count({ where }),
    prisma.transportationRequest.findMany({
      where,
      orderBy:
        statusFilter === "PENDING"
          ? [{ requestedStart: "asc" }, { createdAt: "asc" }]
          : [{ createdAt: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        department: { select: { id: true, name: true } },
        requestedBy: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        trip: {
          select: {
            id: true,
            status: true,
            vehicle: { select: { registrationNumber: true } },
          },
        },
      },
    }),
    prisma.department.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transportationRequest.count({
      where: { organizationId, status: "PENDING", deletedAt: null },
    }),
    prisma.transportationRequest.count({
      where: {
        organizationId,
        status: "PENDING",
        deletedAt: null,
        OR: [
          { specialRequirements: { contains: "PRIORITY=URGENT" } },
          { requestedStart: { gte: now, lte: in24Hours } },
        ],
      },
    }),
    prisma.transportationRequest.count({
      where: {
        organizationId,
        status: "APPROVED",
        deletedAt: null,
        trip: { is: null },
      },
    }),
    prisma.transportationRequest.count({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { status: { in: ["REJECTED", "CANCELLED"] } },
          { status: "APPROVED", trip: { isNot: null } },
        ],
      },
    }),
    prisma.vehicle.aggregate({
      where: { organizationId, status: "ACTIVE", deletedAt: null },
      _max: { seatingCapacity: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const maxSeats = maxVeh._max.seatingCapacity ?? 0;

  const buildUrl = (next: {
    status?: string;
    departmentId?: string;
    priority?: string;
    q?: string;
    page?: number;
  }) => {
    const sp = new URLSearchParams();
    const st = next.status !== undefined ? next.status : (statusFilter ?? "");
    const dep =
      next.departmentId !== undefined
        ? next.departmentId
        : (departmentFilter ?? "");
    const pri =
      next.priority !== undefined ? next.priority : (priorityFilter ?? "");
    const qv = next.q !== undefined ? next.q : query;
    const pv = next.page ?? 1;

    if (st) sp.set("status", st);
    if (dep) sp.set("departmentId", dep);
    if (pri) sp.set("priority", pri);
    if (qv) sp.set("q", qv);
    if (pv > 1) sp.set("page", String(pv));
    const qs = sp.toString();
    return qs ? `/organization/requests?${qs}` : "/organization/requests";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
            {user.organization.name} • Request Governance
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Transportation Request Review & Approval
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Review department transportation requests, verify fleet feasibility, and approve eligible trips for Transport Manager dispatch.
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={buildUrl({ status: "PENDING", priority: "", page: 1 })}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-amber-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Pending Admin Review
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {pendingCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Needs Approve / Reject decision
          </p>
        </Link>

        <Link
          href={buildUrl({ status: "PENDING", priority: "URGENT", page: 1 })}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-rose-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Urgent / Departing Within 24h
          </p>
          <p className="mt-1 text-2xl font-bold text-rose-600">
            {urgentOrImminentCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            High-priority pending requests
          </p>
        </Link>

        <Link
          href={buildUrl({ status: "APPROVED", priority: "", page: 1 })}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-emerald-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Approved (Awaiting Dispatch)
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {awaitingDispatchCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            With Transport Manager for vehicle assignment
          </p>
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Dispatched / Closed
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {dispatchedOrClosedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Completed reviews & assigned trips
          </p>
        </div>
      </div>

      {/* Filter Bar & Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildUrl({ status: "", page: 1 })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                !statusFilter
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All ({totalMatching})
            </Link>
            {STATUSES.map((st) => (
              <Link
                key={st}
                href={buildUrl({ status: st, page: 1 })}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === st
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {st}
              </Link>
            ))}
            <Link
              href={buildUrl({
                priority: priorityFilter === "URGENT" ? "" : "URGENT",
                page: 1,
              })}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                priorityFilter === "URGENT"
                  ? "bg-rose-600 text-white"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              Urgent Only
            </Link>
          </div>

          {/* Department + Search Form */}
          <form
            action="/organization/requests"
            method="GET"
            className="flex flex-wrap items-center gap-2"
          >
            {statusFilter && (
              <input type="hidden" name="status" value={statusFilter} />
            )}
            {priorityFilter && (
              <input type="hidden" name="priority" value={priorityFilter} />
            )}
            <select
              name="departmentId"
              defaultValue={departmentFilter ?? ""}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search purpose, route, department..."
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 sm:w-56"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Apply
            </button>
          </form>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No transportation requests match the current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 pr-4">Purpose & Itinerary</th>
                  <th className="px-4 py-3">Department & Requester</th>
                  <th className="px-4 py-3">Departure & Window (EAT)</th>
                  <th className="px-4 py-3">Passengers</th>
                  <th className="px-4 py-3">Status & Dispatch State</th>
                  <th className="py-3 pl-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const meta = decodeSpecialRequirements(req.specialRequirements);
                  const requesterName =
                    [
                      req.requestedBy.firstName,
                      req.requestedBy.middleName,
                      req.requestedBy.lastName,
                    ]
                      .filter(Boolean)
                      .join(" ")
                      .trim() ||
                    req.requestedBy.email ||
                    "Department User";

                  const isExpired =
                    req.status === "PENDING" &&
                    req.requestedStart.getTime() < now.getTime();
                  const isImminent =
                    req.status === "PENDING" &&
                    !isExpired &&
                    req.requestedStart.getTime() <= in24Hours.getTime();
                  const needsMultiVehicle =
                    maxSeats > 0 && req.passengerCount > maxSeats;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-3.5 pr-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/organization/requests/${req.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600"
                          >
                            {req.purpose}
                          </Link>
                          {meta.priority === "URGENT" && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              URGENT
                            </span>
                          )}
                          {isImminent && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              Departs Within 24h
                            </span>
                          )}
                          {isExpired && (
                            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              Expired
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {req.origin} → {req.destination}
                        </p>
                        {meta.transportFlagReason && (
                          <p className="mt-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            ⚠ Transport Flag: {meta.transportFlagReason}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        <p className="font-semibold text-slate-900">
                          {req.department.name}
                        </p>
                        <p className="text-slate-500">{requesterName}</p>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <div>{formatAddisDateTime(req.requestedStart)}</div>
                        <div className="text-slate-400">
                          to {formatAddisDateTime(req.requestedEnd)}
                        </div>
                        {req.status === "PENDING" && (
                          <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            Waiting {formatWaitingDuration(req.createdAt, now)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <span className="font-semibold">
                          {req.passengerCount}
                        </span>
                        {needsMultiVehicle && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Multi-vehicle
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[req.status]}`}
                          >
                            {req.status}
                          </span>
                          {req.status === "APPROVED" && (
                            <span className="text-[11px] font-medium text-slate-600">
                              {req.trip
                                ? `Dispatched: ${req.trip.vehicle.registrationNumber} (${req.trip.status})`
                                : meta.transportFlagReason
                                  ? "⚠ Escalated by Transport"
                                  : "Awaiting Transport Dispatch"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 pl-4 text-right text-xs font-semibold">
                        <Link
                          href={`/organization/requests/${req.id}`}
                          className={`inline-flex items-center rounded-xl px-3.5 py-1.5 text-xs font-semibold ${
                            req.status === "PENDING"
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {req.status === "PENDING"
                            ? "Review & Decide →"
                            : "View Details"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-600">
            <span>
              Page <strong>{currentPage}</strong> of{" "}
              <strong>{totalPages}</strong> ({totalMatching} total)
            </span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  href={buildUrl({ page: currentPage - 1 })}
                  className="rounded-lg border px-3 py-1 font-semibold"
                >
                  Previous
                </Link>
              )}
              {currentPage < totalPages && (
                <Link
                  href={buildUrl({ page: currentPage + 1 })}
                  className="rounded-lg border px-3 py-1 font-semibold"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}