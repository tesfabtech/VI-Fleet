import Link from "next/link";
import { formatAddisDateTime } from "@/lib/date-format";
import type { TripStatus } from "@prisma/client";

const statusStyles: Record<TripStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-700 border-slate-300",
};

const reviewBadgeStyles: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  NEEDS_CLARIFICATION: "bg-rose-50 text-rose-800 border-rose-300 font-bold",
};

export interface TripListItem {
  id: string;
  status: TripStatus;
  scheduledStart: Date | string;
  scheduledEnd: Date | string;
  actualStart?: Date | string | null;
  actualEnd?: Date | string | null;
  distanceKm?: number | null;
  transportationRequest: {
    purpose: string;
    origin: string;
    destination: string;
    department: { name: string };
  };
  vehicle: {
    registrationNumber: string;
    make?: string | null;
    model?: string | null;
  };
  completionReport?: {
    reviewStatus: string;
    outcome: string;
  } | null;
}

export function TripCard({ trip }: { trip: TripListItem }) {
  return (
    <Link
      href={`/driver/trips/${trip.id}`}
      className="block rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-[#245B85]/50 hover:shadow-xs transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase truncate">
            {trip.transportationRequest.department.name} • {trip.transportationRequest.purpose}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 font-bold text-slate-900 text-sm sm:text-base">
            <span className="truncate">{trip.transportationRequest.origin}</span>
            <span className="text-slate-400">→</span>
            <span className="truncate">{trip.transportationRequest.destination}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
              statusStyles[trip.status]
            }`}
          >
            {trip.status}
          </span>
          {trip.completionReport && (
            <span
              className={`rounded-full border px-2 py-0.2 text-[10px] ${
                reviewBadgeStyles[trip.completionReport.reviewStatus] || "bg-slate-100 text-slate-600"
              }`}
            >
              Review: {trip.completionReport.reviewStatus.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:grid-cols-3">
        <div>
          <span className="text-slate-400 block text-[10px]">Vehicle</span>
          <span className="font-semibold text-slate-800 truncate block">
            {trip.vehicle.registrationNumber}
          </span>
        </div>

        <div>
          <span className="text-slate-400 block text-[10px]">
            {trip.status === "COMPLETED" ? "Completed (EAT)" : "Departure (EAT)"}
          </span>
          <span className="font-semibold text-slate-800 truncate block">
            {formatAddisDateTime(new Date(trip.actualEnd || trip.actualStart || trip.scheduledStart))}
          </span>
        </div>

        {trip.distanceKm && (
          <div className="col-span-2 sm:col-span-1">
            <span className="text-slate-400 block text-[10px]">Distance</span>
            <span className="font-bold text-emerald-700">
              {Number(trip.distanceKm)} km
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
