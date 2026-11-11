import Link from "next/link";
import type { Prisma, TransportationRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canHardDeleteTransportationRequest,
  decodeSpecialRequirements,
  formatAddisDateTime,
  requireDepartmentUserContext,
} from "@/lib/department-auth";
import {
  EmptyRecycleBinButton,
  PermanentDeleteButton,
  RestoreRequestButton,
} from "../request-form";

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
    q?: string;
    status?: string;
    trashed?: string;
    deleted?: string;
  }>;
};

export default async function DepartmentRecycleBinPage({
  searchParams,
}: PageProps) {
  const ctx = await requireDepartmentUserContext();
  const params = await searchParams;

  const query = (params.q ?? "").trim();
  const statusFilter = STATUSES.includes(
    params.status as TransportationRequestStatus,
  )
    ? (params.status as TransportationRequestStatus)
    : undefined;

  const where: Prisma.TransportationRequestWhereInput = {
    organizationId: ctx.organizationId,
    departmentId: ctx.departmentId,
    requestedById: ctx.userId,
    deletedAt: { not: null },
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

  const trashedRequests = await prisma.transportationRequest.findMany({
    where,
    orderBy: { deletedAt: "desc" },
    include: {
      trip: {
        select: {
          id: true,
          status: true,
          vehicle: { select: { registrationNumber: true } },
        },
      },
    },
  });

  const hardDeletableCount = trashedRequests.filter((r) =>
    canHardDeleteTransportationRequest(r.trip?.status, r.deletedAt),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/department/requests"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            ← Back to Active Transportation Requests
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Recycle Bin — Deleted Requests
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Restore soft-deleted transportation requests back to your active list or permanently remove them.
          </p>
        </div>

        <EmptyRecycleBinButton count={hardDeletableCount} />
      </div>

      {params.trashed === "1" && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900"
        >
          Request moved to the Recycle Bin. You can restore it or delete it permanently below.
        </div>
      )}

      {params.deleted === "1" && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
        >
          Transportation request permanently deleted from the database.
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Total in Recycle Bin
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {trashedRequests.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Restorable Requests
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {trashedRequests.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Eligible for Permanent Delete
          </p>
          <p className="mt-1 text-2xl font-bold text-rose-600">
            {hardDeletableCount}
          </p>
        </div>
      </div>

      {/* Filters + Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/department/requests/recycle-bin${query ? `?q=${encodeURIComponent(query)}` : ""}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                !statusFilter
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              All Statuses
            </Link>
            {STATUSES.map((st) => (
              <Link
                key={st}
                href={`/department/requests/recycle-bin?status=${st}${
                  query ? `&q=${encodeURIComponent(query)}` : ""
                }`}
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

          <form
            action="/department/requests/recycle-bin"
            method="GET"
            className="flex gap-2"
          >
            {statusFilter && (
              <input type="hidden" name="status" value={statusFilter} />
            )}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search deleted requests..."
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 sm:w-64"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              Search
            </button>
          </form>
        </div>

        {trashedRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm font-semibold text-slate-800">
              Your Recycle Bin is empty.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Requests that you delete from your active list will appear here so you can restore or permanently remove them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 pr-4">Purpose & Route</th>
                  <th className="px-4 py-3">Original Schedule (EAT)</th>
                  <th className="px-4 py-3">Deleted On</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="py-3 pl-4 text-right">Recycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trashedRequests.map((req) => {
                  const meta = decodeSpecialRequirements(req.specialRequirements);
                  const allowHardDelete = canHardDeleteTransportationRequest(
                    req.trip?.status,
                    req.deletedAt,
                  );

                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-3.5 pr-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/department/requests/${req.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600"
                          >
                            {req.purpose}
                          </Link>
                          {meta.priority === "URGENT" && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              URGENT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {req.origin} → {req.destination} ({req.passengerCount}{" "}
                          pax)
                        </p>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <div>{formatAddisDateTime(req.requestedStart)}</div>
                        <div className="text-slate-400">
                          to {formatAddisDateTime(req.requestedEnd)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-rose-700 font-medium">
                        {req.deletedAt
                          ? formatAddisDateTime(req.deletedAt)
                          : "—"}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[req.status]}`}
                        >
                          {req.status}
                        </span>
                      </td>

                      <td className="py-3.5 pl-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/department/requests/${req.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </Link>
                          <RestoreRequestButton requestId={req.id} compact />
                          {allowHardDelete ? (
                            <PermanentDeleteButton requestId={req.id} />
                          ) : (
                            <span
                              title="Completed trip records are retained for audit history"
                              className="text-[11px] text-slate-400"
                            >
                              Audit-locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}