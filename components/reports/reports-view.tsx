"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  REPORT_TYPES,
  REPORT_METADATA,
  QUICK_DATE_RANGES,
  type ReportType,
  type QuickDateRange,
} from "@/lib/reports/validation";
import type { ReportResult } from "@/lib/reports/queries";

export default function ReportsView({
  reportData,
  initialType,
  initialRange,
  initialStartDate,
  initialEndDate,
  initialSearch,
  initialStatus,
  organizationName,
}: {
  reportData: ReportResult;
  initialType: ReportType;
  initialRange: QuickDateRange;
  initialStartDate: string;
  initialEndDate: string;
  initialSearch: string;
  initialStatus: string;
  organizationName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<ReportType>(initialType);
  const [range, setRange] = useState<QuickDateRange>(initialRange);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

  function applyFilters(updates: Partial<{
    type: ReportType;
    range: QuickDateRange;
    startDate: string;
    endDate: string;
    search: string;
    status: string;
  }>) {
    const nextType = updates.type !== undefined ? updates.type : type;
    const nextRange = updates.range !== undefined ? updates.range : range;
    const nextStart = updates.startDate !== undefined ? updates.startDate : startDate;
    const nextEnd = updates.endDate !== undefined ? updates.endDate : endDate;
    const nextSearch = updates.search !== undefined ? updates.search : search;
    const nextStatus = updates.status !== undefined ? updates.status : status;

    const params = new URLSearchParams(searchParams.toString());
    params.set("type", nextType);

    if (nextRange && nextRange !== "all") {
      params.set("range", nextRange);
    } else {
      params.delete("range");
    }

    if (nextStart) {
      params.set("startDate", nextStart);
    } else {
      params.delete("startDate");
    }

    if (nextEnd) {
      params.set("endDate", nextEnd);
    } else {
      params.delete("endDate");
    }

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    } else {
      params.delete("search");
    }

    if (nextStatus) {
      params.set("status", nextStatus);
    } else {
      params.delete("status");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleTypeChange(newType: ReportType) {
    setType(newType);
    applyFilters({ type: newType });
  }

  function handleRangeChange(newRange: QuickDateRange) {
    setRange(newRange);
    // When a quick range is selected, clear custom date inputs
    setStartDate("");
    setEndDate("");
    applyFilters({ range: newRange, startDate: "", endDate: "" });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters({ search });
  }

  function handleClearFilters() {
    setRange("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setStatus("");
    applyFilters({
      range: "all",
      startDate: "",
      endDate: "",
      search: "",
      status: "",
    });
  }

  // Build CSV export URL with current filters
  const exportUrl = `/api/reports/export?${new URLSearchParams({
    type,
    range: range !== "all" ? range : "",
    startDate,
    endDate,
    search,
    status,
  }).toString()}`;

  const currentMeta = REPORT_METADATA[type];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {currentMeta.badge}
            </span>
            <span className="text-xs text-slate-500">• {organizationName}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {currentMeta.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-3xl">
            {currentMeta.description}
          </p>
        </div>

        {/* Export to CSV Button */}
        <div className="flex items-center gap-2.5">
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-95 cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {reportData.kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <p className="text-xs font-medium text-slate-500 truncate">
              {kpi.label}
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              {kpi.value}
            </p>
            {kpi.subtext && (
              <p className="mt-0.5 text-[11px] font-medium text-slate-400 truncate">
                {kpi.subtext}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Report Types Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav
          className="-mb-px flex space-x-2 overflow-x-auto pb-1"
          aria-label="Report Categories"
        >
          {REPORT_TYPES.map((t) => {
            const meta = REPORT_METADATA[t];
            const active = type === t;
            return (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {meta.title.split("&")[0].trim()}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filters Bar Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
        {/* Quick Date Range Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">
            Time Range:
          </span>
          {QUICK_DATE_RANGES.map((r) => {
            const active = range === r.id && !startDate && !endDate;
            return (
              <button
                key={r.id}
                onClick={() => handleRangeChange(r.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  active
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Detailed Controls: Search, Custom Dates & Status */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
          {/* Keyword Search */}
          <form
            onSubmit={handleSearchSubmit}
            className="sm:col-span-5 relative"
          >
            <label
              htmlFor="report-search"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Search Records
            </label>
            <div className="relative">
              <input
                id="report-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Plate #, Driver name, Destination, Provider..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <svg
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>

          {/* Start Date */}
          <div className="sm:col-span-2">
            <label
              htmlFor="start-date"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              From Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setRange("all");
                applyFilters({ startDate: e.target.value, range: "all" });
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* End Date */}
          <div className="sm:col-span-2">
            <label
              htmlFor="end-date"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              To Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setRange("all");
                applyFilters({ endDate: e.target.value, range: "all" });
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Status Dropdown */}
          <div className="sm:col-span-2">
            <label
              htmlFor="report-status"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Status Filter
            </label>
            <select
              id="report-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                applyFilters({ status: e.target.value });
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="AVAILABLE">Available</option>
              <option value="IN_USE">In Use</option>
              <option value="MAINTENANCE">In Maintenance</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Reset Action */}
          <div className="sm:col-span-1">
            <button
              type="button"
              onClick={handleClearFilters}
              title="Reset all filters"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* GPS Notice Banner when no hardware paired */}
      {type === "gps-geofence" && !reportData.hasHardwareData && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <svg
            className="h-5 w-5 shrink-0 text-amber-600 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-bold text-amber-900">
              Live Telemetry Hardware Unavailable
            </h4>
            <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
              No GPS hardware trackers have been paired with vehicles in this
              organization yet. As GPS devices are registered and synced with
              the OBD/CAN-bus ports, real-time geofence alerts and telemetry pings
              will populate here automatically.
            </p>
          </div>
        </div>
      )}

      {/* Report Records Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/60">
          <p className="text-xs font-semibold text-slate-700">
            Displaying {reportData.records.length} of {reportData.totalCount} records
            {isPending && (
              <span className="ml-2 text-blue-600 animate-pulse font-normal">
                Updating...
              </span>
            )}
          </p>
          <span className="text-[11px] text-slate-400">
            Generated: {new Date(reportData.generatedAt).toLocaleTimeString()}
          </span>
        </div>

        {reportData.records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">
              No report records found
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              No matching records were found for the selected time window and
              filter criteria.
            </p>
            <button
              onClick={handleClearFilters}
              className="mt-4 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {type === "vehicle-usage" && (
              <VehicleUsageTable records={reportData.records as never[]} />
            )}
            {type === "trip-history" && (
              <TripHistoryTable records={reportData.records as never[]} />
            )}
            {type === "driver-activity" && (
              <DriverActivityTable records={reportData.records as never[]} />
            )}
            {type === "maintenance" && (
              <MaintenanceTable records={reportData.records as never[]} />
            )}
            {type === "fuel-consumption" && (
              <FuelTable records={reportData.records as never[]} />
            )}
            {type === "gps-geofence" && (
              <GpsGeofenceTable records={reportData.records as never[]} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SPECIFIC REPORT DATA TABLES
// ─────────────────────────────────────────────────────────────

function VehicleUsageTable({ records }: { records: Array<Record<string, unknown>> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-5 py-3">Vehicle Plate</th>
          <th className="px-4 py-3">Make & Model</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Availability</th>
          <th className="px-4 py-3 text-right">Odometer</th>
          <th className="px-4 py-3 text-center">Trips</th>
          <th className="px-4 py-3 text-center">Services</th>
          <th className="px-4 py-3 text-center">Fuel Logs</th>
          <th className="px-5 py-3 text-right">Registered</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
        {records.map((v) => (
          <tr key={String(v.id)} className="hover:bg-slate-50/70 transition">
            <td className="px-5 py-3 font-bold text-slate-900">
              {String(v.registrationNumber)}
            </td>
            <td className="px-4 py-3">{String(v.makeModel)} ({String(v.year || "N/A")})</td>
            <td className="px-4 py-3">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  v.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {String(v.status)}
              </span>
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  v.availability === "AVAILABLE"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {String(v.availability)}
              </span>
            </td>
            <td className="px-4 py-3 text-right font-mono font-semibold">
              {v.currentOdometer ? `${Number(v.currentOdometer).toLocaleString()} km` : "N/A"}
            </td>
            <td className="px-4 py-3 text-center font-bold text-slate-900">
              {String(v.tripCount)}
            </td>
            <td className="px-4 py-3 text-center text-slate-600">
              {String(v.maintenanceCount)}
            </td>
            <td className="px-4 py-3 text-center text-slate-600">
              {String(v.fuelRecordCount)}
            </td>
            <td className="px-5 py-3 text-right text-slate-400">
              {String(v.createdAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TripHistoryTable({ records }: { records: Array<Record<string, unknown>> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-5 py-3">Purpose</th>
          <th className="px-4 py-3">Department</th>
          <th className="px-4 py-3">Route</th>
          <th className="px-4 py-3 text-center">Pax</th>
          <th className="px-4 py-3">Departure</th>
          <th className="px-4 py-3">Vehicle</th>
          <th className="px-4 py-3">Driver</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-5 py-3 text-right">Distance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
        {records.map((t) => (
          <tr key={String(t.id)} className="hover:bg-slate-50/70 transition">
            <td className="px-5 py-3 font-bold text-slate-900">
              {String(t.purpose)}
            </td>
            <td className="px-4 py-3 text-slate-600">{String(t.department)}</td>
            <td className="px-4 py-3 text-slate-600">
              <span className="font-semibold text-slate-800">{String(t.origin)}</span> → {String(t.destination)}
            </td>
            <td className="px-4 py-3 text-center font-semibold">
              {String(t.passengerCount)}
            </td>
            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
              {String(t.scheduledStart)}
            </td>
            <td className="px-4 py-3 font-semibold text-slate-800">
              {String(t.vehiclePlate)}
            </td>
            <td className="px-4 py-3 text-slate-700">{String(t.driverName)}</td>
            <td className="px-4 py-3">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  t.status === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : t.status === "IN_PROGRESS"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : t.status === "CANCELLED"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-slate-100 text-slate-700"
                }`}
              >
                {String(t.status)}
              </span>
            </td>
            <td className="px-5 py-3 text-right font-mono font-semibold">
              {t.distanceKm ? `${Number(t.distanceKm).toLocaleString()} km` : "N/A"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DriverActivityTable({ records }: { records: Array<Record<string, unknown>> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-5 py-3">Driver Name</th>
          <th className="px-4 py-3">License #</th>
          <th className="px-4 py-3">Expiry Date</th>
          <th className="px-4 py-3">Phone</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3 text-center">Completed Trips</th>
          <th className="px-5 py-3 text-right">Total Assigned</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
        {records.map((d) => (
          <tr key={String(d.id)} className="hover:bg-slate-50/70 transition">
            <td className="px-5 py-3 font-bold text-slate-900">
              {String(d.fullName)}
            </td>
            <td className="px-4 py-3 font-mono text-slate-700">
              {String(d.licenseNumber)}
            </td>
            <td className="px-4 py-3 text-slate-600">
              {String(d.licenseExpiryDate || "Not Provided")}
            </td>
            <td className="px-4 py-3 text-slate-600">
              {String(d.phone || "N/A")}
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  d.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {String(d.status)}
              </span>
            </td>
            <td className="px-4 py-3 text-center font-bold text-slate-900">
              {String(d.completedTrips)}
            </td>
            <td className="px-5 py-3 text-right font-bold text-blue-700">
              {String(d.totalTrips)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MaintenanceTable({ records }: { records: Array<Record<string, unknown>> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-5 py-3">Service Title</th>
          <th className="px-4 py-3">Vehicle Plate</th>
          <th className="px-4 py-3">Service Type</th>
          <th className="px-4 py-3">Service Date</th>
          <th className="px-4 py-3 text-right">Odometer</th>
          <th className="px-4 py-3 text-right">Cost ($)</th>
          <th className="px-4 py-3">Service Provider</th>
          <th className="px-5 py-3 text-right">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
        {records.map((m) => (
          <tr key={String(m.id)} className="hover:bg-slate-50/70 transition">
            <td className="px-5 py-3 font-bold text-slate-900">
              {String(m.title)}
            </td>
            <td className="px-4 py-3 font-semibold text-slate-800">
              {String(m.vehiclePlate)}
            </td>
            <td className="px-4 py-3">
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                {String(m.maintenanceType)}
              </span>
            </td>
            <td className="px-4 py-3 text-slate-600">
              {String(m.maintenanceDate)}
            </td>
            <td className="px-4 py-3 text-right font-mono">
              {m.odometer ? `${Number(m.odometer).toLocaleString()} km` : "N/A"}
            </td>
            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
              {m.cost !== null && m.cost !== undefined
                ? `$${Number(m.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "N/A"}
            </td>
            <td className="px-4 py-3 text-slate-600">
              {String(m.serviceProvider || "Internal")}
            </td>
            <td className="px-5 py-3 text-right">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  m.status === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {String(m.status)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FuelTable({ records }: { records: Array<Record<string, unknown>> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-5 py-3">Fuel Date</th>
          <th className="px-4 py-3">Vehicle Plate</th>
          <th className="px-4 py-3 text-right">Volume (L)</th>
          <th className="px-4 py-3 text-right">Price / L</th>
          <th className="px-4 py-3 text-right">Total Cost ($)</th>
          <th className="px-4 py-3 text-right">Odometer</th>
          <th className="px-4 py-3">Gas Station</th>
          <th className="px-5 py-3 text-right">Receipt #</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
        {records.map((f) => (
          <tr key={String(f.id)} className="hover:bg-slate-50/70 transition">
            <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
              {String(f.fuelDate)}
            </td>
            <td className="px-4 py-3 font-bold text-slate-900">
              {String(f.vehiclePlate)}
            </td>
            <td className="px-4 py-3 text-right font-mono font-semibold">
              {Number(f.quantityLiters).toFixed(1)} L
            </td>
            <td className="px-4 py-3 text-right font-mono text-slate-600">
              {f.pricePerLiter ? `$${Number(f.pricePerLiter).toFixed(2)}` : "N/A"}
            </td>
            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
              {f.totalCost
                ? `$${Number(f.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "N/A"}
            </td>
            <td className="px-4 py-3 text-right font-mono text-slate-600">
              {f.odometer ? `${Number(f.odometer).toLocaleString()} km` : "N/A"}
            </td>
            <td className="px-4 py-3 text-slate-600">
              {String(f.stationName || "N/A")}
            </td>
            <td className="px-5 py-3 text-right font-mono text-slate-500">
              {String(f.receiptNumber || "N/A")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GpsGeofenceTable({ records }: { records: Array<Record<string, unknown>> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-5 py-3">Event ID</th>
          <th className="px-4 py-3">Event Type</th>
          <th className="px-4 py-3">Geofence Perimeter</th>
          <th className="px-4 py-3">Vehicle Plate</th>
          <th className="px-5 py-3 text-right">Timestamp</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
        {records.map((g) => (
          <tr key={String(g.id)} className="hover:bg-slate-50/70 transition">
            <td className="px-5 py-3 font-mono text-slate-500">#{String(g.id)}</td>
            <td className="px-4 py-3">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  String(g.eventType).includes("ENTER")
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {String(g.eventType)}
              </span>
            </td>
            <td className="px-4 py-3 font-semibold text-slate-900">
              {String(g.geofenceName)}
            </td>
            <td className="px-4 py-3 font-bold text-slate-800">
              {String(g.vehiclePlate)}
            </td>
            <td className="px-5 py-3 text-right text-slate-500 whitespace-nowrap">
              {String(g.occurredAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
