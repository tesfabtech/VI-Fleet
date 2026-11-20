"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAddisDateTime } from "@/lib/date-format";
import { StartTripModal, CompleteTripModal, InterruptionModal } from "./driver-modals";

export interface ActiveTripCardData {
  id: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  scheduledStart: Date | string;
  scheduledEnd: Date | string;
  actualStart?: Date | string | null;
  startOdometer?: number | null;
  distanceKm?: number | null;
  transportationRequest: {
    purpose: string;
    origin: string;
    destination: string;
    passengerCount: number;
    department: { name: string };
    requestedBy?: { firstName?: string | null; lastName?: string | null; phone?: string | null } | null;
  };
  vehicle: {
    id?: string;
    registrationNumber: string;
    make?: string | null;
    model?: string | null;
    seatingCapacity?: number | null;
    currentOdometer?: number | null;
  };
  interruptionReports?: Array<{
    id: string;
    category: string;
    status: string;
    description: string;
  }>;
}

export function ActiveTripCard({
  trip,
  contactName,
  contactPhone,
  isUrgent = false,
}: {
  trip: ActiveTripCardData;
  contactName?: string;
  contactPhone?: string;
  isUrgent?: boolean;
}) {
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showInterruptionModal, setShowInterruptionModal] = useState(false);

  const isInProgress = trip.status === "IN_PROGRESS";
  const isScheduled = trip.status === "SCHEDULED";

  const vehicleOdometer = trip.vehicle.currentOdometer
    ? Number(trip.vehicle.currentOdometer)
    : null;
  const startOdo = trip.startOdometer ? Number(trip.startOdometer) : vehicleOdometer;

  const pendingInterruption = trip.interruptionReports?.find(
    (r) => r.status !== "RESOLVED",
  );

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md transition-shadow hover:shadow-lg">
        {/* Top Status Header */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-b ${
            isInProgress
              ? "bg-amber-500/10 border-amber-200"
              : "bg-[#142B45]/5 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isInProgress
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "bg-blue-100 text-blue-900 border border-blue-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isInProgress ? "animate-pulse bg-amber-600" : "bg-blue-600"
                }`}
              />
              {isInProgress ? "ACTIVE IN PROGRESS" : "NEXT SCHEDULED TRIP"}
            </span>

            {isUrgent && (
              <span className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-700">
                URGENT
              </span>
            )}
          </div>

          <Link
            href={`/driver/trips/${trip.id}`}
            className="text-xs font-bold text-[#245B85] hover:underline"
          >
            Full Details →
          </Link>
        </div>

        {/* Route Details */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {trip.transportationRequest.department.name} • {trip.transportationRequest.purpose}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#142B45] tracking-tight">
                {trip.transportationRequest.origin}
              </h2>
              <span className="text-slate-400 font-bold">→</span>
              <h2 className="text-xl sm:text-2xl font-black text-[#142B45] tracking-tight">
                {trip.transportationRequest.destination}
              </h2>
            </div>
          </div>

          {/* Pending Interruption Alert banner if present */}
          {pendingInterruption && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-950">
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <span>⚠ Interruption Reported:</span>
                <span>{pendingInterruption.category}</span>
              </div>
              <p className="mt-1 text-slate-700">{pendingInterruption.description}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-rose-600">
                Awaiting Transport Manager review. Trip remains IN_PROGRESS.
              </p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-[#F4F6F8] p-3">
              <p className="font-semibold text-slate-500">Vehicle</p>
              <p className="mt-0.5 text-sm font-black text-slate-900">
                {trip.vehicle.registrationNumber}
              </p>
              <p className="text-[11px] text-slate-600 truncate">
                {[trip.vehicle.make, trip.vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
              </p>
            </div>

            <div className="rounded-xl bg-[#F4F6F8] p-3">
              <p className="font-semibold text-slate-500">
                {isInProgress ? "Started (EAT)" : "Departs (EAT)"}
              </p>
              <p className="mt-0.5 text-xs font-bold text-slate-900">
                {formatAddisDateTime(new Date(trip.actualStart || trip.scheduledStart))}
              </p>
              <p className="text-[11px] text-slate-600 truncate">
                Return: {formatAddisDateTime(new Date(trip.scheduledEnd))}
              </p>
            </div>

            <div className="rounded-xl bg-[#F4F6F8] p-3">
              <p className="font-semibold text-slate-500">Passengers</p>
              <p className="mt-0.5 text-sm font-black text-slate-900">
                {trip.transportationRequest.passengerCount} pax
              </p>
              <p className="text-[11px] text-slate-600 truncate">
                Cap: {trip.vehicle.seatingCapacity ?? "N/A"} seats
              </p>
            </div>

            <div className="rounded-xl bg-[#F4F6F8] p-3">
              <p className="font-semibold text-slate-500">
                {isInProgress ? "Start Odometer" : "Current Odometer"}
              </p>
              <p className="mt-0.5 text-sm font-black text-slate-900">
                {startOdo !== null ? `${startOdo} km` : "N/A"}
              </p>
              <p className="text-[11px] text-slate-600">Recorded</p>
            </div>
          </div>

          {/* On-Site Pickup Contact & Tap-to-Call */}
          {(contactName || contactPhone) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs">
              <div>
                <p className="font-semibold text-slate-500">Pickup Contact</p>
                <p className="text-sm font-bold text-slate-900">{contactName || "Contact Office"}</p>
                {contactPhone && <p className="text-slate-600">{contactPhone}</p>}
              </div>

              {contactPhone && (
                <a
                  href={`tel:${contactPhone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#245B85] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#1a4463] active:scale-95 transition-all"
                >
                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  <span>Call Contact</span>
                </a>
              )}
            </div>
          )}

          {/* Operational Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            {isScheduled && (
              <button
                type="button"
                onClick={() => setShowStartModal(true)}
                className="w-full flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E6A23C] hover:bg-[#d9942d] px-6 py-3.5 text-sm font-bold text-[#142B45] shadow-md shadow-[#E6A23C]/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Start Trip</span>
              </button>
            )}

            {isInProgress && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(true)}
                  className="w-full sm:w-2/3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Complete Trip</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInterruptionModal(true)}
                  className="w-full sm:w-1/3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50/50 hover:bg-rose-100 px-4 py-3.5 text-xs font-bold text-rose-800 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Report Interruption</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <StartTripModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        tripId={trip.id}
        currentVehicleOdometer={vehicleOdometer}
      />

      <CompleteTripModal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        tripId={trip.id}
        startOdometer={startOdo}
      />

      <InterruptionModal
        isOpen={showInterruptionModal}
        onClose={() => setShowInterruptionModal(false)}
        tripId={trip.id}
      />
    </>
  );
}
