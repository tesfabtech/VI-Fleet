import Link from "next/link";
import type { Prisma, TransportationRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  decodeSpecialRequirements,
  formatAddisDateTime,
  requireDepartmentUserContext,
} from "@/lib/department-auth";

const PAGE_SIZE = 10;
const STATUSES: TransportationRequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const statusStyles: Record<TransportationRequestStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

type PageProps = {
  searchParams: Promise<{ scope?: string; status?: string; q?: string; page?: string }>;
};

export default async function DepartmentRequestsPage({ searchParams }: PageProps) {
  const ctx = await requireDepartmentUserContext();
  const params = await searchParams;

  const scope = params.scope === "department" ? "department" : "mine";
  const statusFilter = STATUSES.includes(params.status as TransportationRequestStatus)
    ? (params.status as TransportationRequestStatus)
    : undefined;
  const query = (params.q ?? "").trim();
  const currentPage = Math.max(1, Number(params.page) || 1);

  const baseScope = {
    organizationId: ctx.organizationId,
    departmentId: ctx.departmentId,
    deletedAt: null,
  };

  const where: Prisma.TransportationRequestWhereInput = {
    ...baseScope,
    ...(scope === "mine" ? { requestedById: ctx.userId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            { purpose: { contains: query, mode: "insensitive" } },
            { origin: { contains: query, mode: "insensitive" } },
            { destination: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [totalMatching, requests, myPending, myApproved, myClosed, deptTotal, maxVeh] =
    await Promise.all([
      prisma.transportationRequest.count({ where }),
      prisma.transportationRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          requestedBy: { select: { firstName: true, middleName: true, lastName: true, email: true } },
          trip: {
            select: {
              status: true,
              vehicle: { select: { registrationNumber: true } },
            },
          },
        },
      }),
      prisma.transportationRequest.count({
        where: { ...baseScope, requestedById: ctx.userId, status: "PENDING" },
      }),
      prisma.transportationRequest.count({
        where: { ...baseScope, requestedById: ctx.userId, status: "APPROVED" },
      }),
      prisma.transportationRequest.count({
        where: { ...baseScope, requestedById: ctx.userId, status: { in: ["REJECTED", "CANCELLED"] } },
      }),
      prisma.transportationRequest.count({ where: baseScope }),
      prisma.vehicle.aggregate({
        where: { organizationId: ctx.organizationId, status: "ACTIVE", deletedAt: null },
        _max: { seatingCapacity: true },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const maxSeats = maxVeh._max.seatingCapacity ?? 0;

  const buildUrl = (next: { scope?: string; status?: string; q?: string; page?: number }) => {
    const sp = new URLSearchParams();
    const s = next.scope ?? scope;
    const st = next.status !== undefined ? next.status : (statusFilter ?? "");
    const qv = next.q !== undefined ? next.q : query;
    const pv = next.page ?? 1;
    if (s) sp.set("scope", s);
    if (st) sp.set("status", st);
    if (qv) sp.set("q", qv);
    if (pv > 1) sp.set("page", String(pv));
    return `/department/requests?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transportation Requests</h1>
          <p className="mt-1 text-sm text-slate-600">
            {ctx.departmentName} • {ctx.organizationName}
          </p>
        </div>
        <Link
          href="/department/requests/new"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
        >
          + Submit New Request
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "My Pending", val: myPending, cls: "text-amber-600" },
          { label: "My Approved", val: myApproved, cls: "text-emerald-600" },
          { label: "Rejected / Cancelled", val: myClosed, cls: "text-slate-700" },
          { label: "Department Total", val: deptTotal, cls: "text-blue-600" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.cls}`}>{item.val}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {(["mine", "department"] as const).map((tab) => (
              <Link
                key={tab}
                href={buildUrl({ scope: tab, page: 1 })}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
                  scope === tab ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                }`}
              >
                {tab === "mine" ? "My Requests" : `All ${ctx.departmentName} Requests`}
              </Link>
            ))}
          </div>

          <form action="/department/requests" method="GET" className="flex gap-2">
            <input type="hidden" name="scope" value={scope} />
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search purpose, origin, destination..."
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 sm:w-64"
            />
            <button type="submit" className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white">
              Filter
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={buildUrl({ status: "", page: 1 })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !statusFilter ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            All Statuses
          </Link>
          {STATUSES.map((st) => (
            <Link
              key={st}
              href={buildUrl({ status: st, page: 1 })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                statusFilter === st ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {st}
            </Link>
          ))}
        </div>

        {scope === "department" && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Showing department-wide schedule. Private notes, full details, edit, and cancel are restricted to your own requests.
          </p>
        )}

        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm font-semibold text-slate-800">No matching transportation requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 pr-4">Purpose & Route</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Schedule (EAT)</th>
                  <th className="px-4 py-3">Passengers</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="py-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const isMine = req.requestedById === ctx.userId;
                  const requesterName =
                    [req.requestedBy.firstName, req.requestedBy.middleName, req.requestedBy.lastName]
                      .filter(Boolean)
                      .join(" ")
                      .trim() ||
                    req.requestedBy.email ||
                    "Department User";
                  const meta = decodeSpecialRequirements(req.specialRequirements);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-3.5 pr-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isMine ? (
                            <Link href={`/department/requests/${req.id}`} className="font-semibold text-slate-900 hover:text-blue-600">
                              {req.purpose}
                            </Link>
                          ) : (
                            <span className="font-semibold text-slate-900">{req.purpose}</span>
                          )}
                          {meta.priority === "URGENT" && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">URGENT</span>
                          )}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {meta.tripType === "ONE_WAY" ? "One-Way" : "Round-Trip"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{req.origin} → {req.destination}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        {requesterName}
                        {isMine && <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">You</span>}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <div>{formatAddisDateTime(req.requestedStart)}</div>
                        <div className="text-slate-400">to {formatAddisDateTime(req.requestedEnd)}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <span className="font-semibold">{req.passengerCount}</span>
                        {maxSeats > 0 && req.passengerCount > maxSeats && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Multi-vehicle
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[req.status]}`}>
                          {req.status}
                        </span>
                        {req.trip && (
                          <div className="mt-1 text-[11px] text-slate-500">
                            {req.trip.status} ({req.trip.vehicle.registrationNumber})
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pl-4 text-right text-xs font-semibold">
                        {isMine ? (
                          <div className="inline-flex gap-3">
                            <Link href={`/department/requests/${req.id}`} className="text-blue-600 hover:underline">
                              {req.status === "PENDING" ? "Edit / View" : "Details"}
                            </Link>
                            <Link href={`/department/requests/new?cloneFrom=${req.id}`} className="text-slate-500 hover:text-slate-800">
                              Clone
                            </Link>
                          </div>
                        ) : (
                          <span className="text-slate-400">Read-only</span>
                        )}
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
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalMatching} total)
            </span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link href={buildUrl({ page: currentPage - 1 })} className="rounded-lg border px-3 py-1 font-semibold">
                  Previous
                </Link>
              )}
              {currentPage < totalPages && (
                <Link href={buildUrl({ page: currentPage + 1 })} className="rounded-lg border px-3 py-1 font-semibold">
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