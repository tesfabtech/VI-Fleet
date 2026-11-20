import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { getDriverTripDetail } from "@/lib/driver-trip/driver-trip-query-service";
import { isUuid, decodeSpecialRequirements } from "@/lib/department-auth";
import { formatAddisDateTime } from "@/lib/date-format";
import { ActiveTripCard } from "@/components/driver/active-trip-card";
import { serializeActiveTripCardData, decimalToNumber } from "@/lib/driver-trip/serializer";
import { PhotoEvidenceViewer } from "@/components/driver/photo-evidence-viewer";
import { DriverTripDetailActions } from "./trip-actions-client";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function DriverTripDetailPage({ params }: PageProps) {
  let authContext;
  try {
    authContext = await resolveAuthContext();
  } catch {
    redirect("/login");
  }

  const { tripId } = await params;
  if (!isUuid(tripId)) notFound();

  let trip;
  try {
    trip = await getDriverTripDetail(tripId, authContext);
  } catch {
    notFound();
  }

  const req = trip.transportationRequest;
  const meta = decodeSpecialRequirements(req.specialRequirements);
  const contactName =
    meta.contactName ||
    [req.requestedBy?.firstName, req.requestedBy?.lastName].filter(Boolean).join(" ").trim() ||
    "Passenger Contact";
  const contactPhone = meta.contactPhone || req.requestedBy?.phone || "";
  const isUrgent = meta.priority === "URGENT";

  const completion = trip.completionReport;
  const isNeedsClarification = completion?.reviewStatus === "NEEDS_CLARIFICATION";

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <Link
          href="/driver"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <span>← Back to Home</span>
        </Link>
        <span className="text-xs font-medium text-slate-500">
          Trip #{trip.id.slice(0, 8)}
        </span>
      </div>

      {/* Needs Clarification Banner */}
      {isNeedsClarification && completion && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-xs">
              !
            </span>
            <h3 className="text-sm font-bold text-amber-900">
              Clarification Requested by Transport Manager
            </h3>
          </div>
          <p className="text-xs text-amber-950 font-medium">
            {completion.reviewNotes || "Please review and submit a revised completion report."}
          </p>
          <div className="pt-1">
            <DriverTripDetailActions
              reportId={completion.id}
              tripId={trip.id}
              reviewNotes={completion.reviewNotes}
              previousOutcome={completion.outcome}
            />
          </div>
        </div>
      )}

      {/* Main Operational Card */}
      <ActiveTripCard
        trip={serializeActiveTripCardData(trip)}
        contactName={contactName}
        contactPhone={contactPhone}
        isUrgent={isUrgent}
      />

      {/* Dispatch Notes / Special Requirements */}
      {(req.description || meta.cargoDetails || meta.extraRequirements) && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2.5 text-xs">
          <h3 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
            Trip Notes & Passenger Requirements
          </h3>
          {req.description && (
            <p className="text-slate-700">
              <strong>Request Note:</strong> {req.description}
            </p>
          )}
          {meta.cargoDetails && (
            <p className="text-slate-700">
              <strong>Cargo Details:</strong> {meta.cargoDetails}
            </p>
          )}
          {meta.extraRequirements && (
            <p className="text-slate-700">
              <strong>Special Instructions:</strong> {meta.extraRequirements}
            </p>
          )}
        </section>
      )}

      {/* Completion Report Details (If Completed) */}
      {completion && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
              Completion Report Summary
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                completion.reviewStatus === "APPROVED"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : completion.reviewStatus === "NEEDS_CLARIFICATION"
                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}
            >
              Review: {completion.reviewStatus.replace(/_/g, " ")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <span className="text-slate-400 block text-[10px]">Outcome</span>
              <span className="font-bold text-slate-900 block mt-0.5">{completion.outcome}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Ending Odometer</span>
              <span className="font-bold text-slate-900 block mt-0.5">
                {completion.submittedEndOdometer ? `${Number(completion.submittedEndOdometer)} km` : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Distance</span>
              <span className="font-bold text-emerald-700 block mt-0.5">
                {trip.distanceKm ? `${Number(trip.distanceKm)} km` : "—"}
              </span>
            </div>
          </div>

          {completion.odometerUnavailableReason && (
            <p className="rounded-lg bg-rose-50 p-2 text-rose-800 text-xs">
              <strong>Odometer Exception:</strong> {completion.odometerUnavailableReason}
            </p>
          )}

          {completion.description && (
            <p className="text-slate-600">
              <strong>Driver Notes:</strong> {completion.description}
            </p>
          )}

          {completion.revisions.length > 0 && (
            <div className="border-t border-slate-100 pt-2 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Previous Revisions ({completion.revisions.length})
              </span>
              {completion.revisions.map((rev) => (
                <div key={rev.id} className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-800">Revision #{rev.revisionNumber}:</span>{" "}
                  {rev.outcome} • {formatAddisDateTime(rev.submittedAt)}
                  {rev.description && <p className="mt-0.5">{rev.description}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Evidence Photos */}
      {trip.evidence.length > 0 && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3 text-xs">
          <h3 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
            Photo Evidence Uploads ({trip.evidence.length})
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {trip.evidence.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between"
              >
                <div>
                  <span className="font-bold text-slate-800 block text-xs">
                    {ev.evidenceType.replace(/_/g, " ")}
                  </span>
                  {ev.odometerReading && (
                    <span className="text-[11px] text-[#245B85] font-semibold block">
                      Reading: {Number(ev.odometerReading)} km
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {formatAddisDateTime(ev.uploadedAt)}
                  </span>
                </div>
                <PhotoEvidenceViewer
                  tripId={trip.id}
                  evidenceId={ev.id}
                  evidenceType={ev.evidenceType}
                  odometerReading={decimalToNumber(ev.odometerReading)}
                  uploadedAt={ev.uploadedAt}
                  uploadedByName={
                    ev.uploadedBy
                      ? `${ev.uploadedBy.firstName} ${ev.uploadedBy.lastName}`.trim()
                      : "Driver"
                  }
                  buttonLabel="View Photo ↗"
                  className="mt-2 text-center rounded-lg bg-white border border-slate-300 py-1.5 text-[11px] font-semibold text-[#245B85] hover:bg-slate-100 transition-colors cursor-pointer"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Structured Status History Audit Trail */}
      {trip.statusHistory.length > 0 && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3 text-xs">
          <h3 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
            Status Audit History ({trip.statusHistory.length})
          </h3>
          <div className="space-y-2">
            {trip.statusHistory.map((h) => (
              <div
                key={h.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-xl bg-[#F4F6F8] p-2.5"
              >
                <div>
                  <span className="font-bold text-[#142B45]">
                    {h.previousStatus ? `${h.previousStatus} → ` : ""}
                    {h.newStatus}
                  </span>
                  <span className="text-slate-600 block sm:inline sm:ml-1">
                    by {h.changedBy.firstName} {h.changedBy.lastName}
                  </span>
                  {h.reason && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{h.reason}</p>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {formatAddisDateTime(h.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
