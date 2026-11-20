"use client";

import { useActionState, useEffect, useState } from "react";
import {
  managerDecideInterruptionAction,
  managerReviewCompletionAction,
  type ManagerReviewActionResult,
} from "@/app/transport/trips/review-actions";
import { formatAddisDateTime } from "@/lib/date-format";

export function ManagerInterruptionReviewControl({
  report,
  tripId,
  availableVehicles = [],
  availableDrivers = [],
}: {
  report: {
    id: string;
    category: string;
    description: string;
    status: string;
    managerDecision?: string | null;
    resolutionNotes?: string | null;
    reportedAt: Date | string;
    resolvedAt?: Date | string | null;
    reportedByDriver?: { firstName: string; lastName: string; phone?: string | null } | null;
    reviewedBy?: { firstName?: string | null; lastName?: string | null } | null;
  };
  tripId: string;
  availableVehicles?: Array<{ id: string; registrationNumber: string; make?: string | null; model?: string | null }>;
  availableDrivers?: Array<{ id: string; firstName: string; lastName: string }>;
}) {
  const [decision, setDecision] = useState<string>("RESUME");
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState<ManagerReviewActionResult | null, FormData>(
    managerDecideInterruptionAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      setShowForm(false);
    }
  }, [state?.ok]);

  const isResolved = report.status === "RESOLVED";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-rose-100 text-rose-900 border border-rose-200 px-2 py-0.5 font-bold text-[10px]">
            {report.category}
          </span>
          <span className="text-slate-500">
            Reported by{" "}
            <strong>
              {report.reportedByDriver?.firstName} {report.reportedByDriver?.lastName}
            </strong>{" "}
            • {formatAddisDateTime(new Date(report.reportedAt))}
          </span>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 font-bold text-[10px] ${
            isResolved
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800 animate-pulse"
          }`}
        >
          {isResolved ? `Resolved: ${report.managerDecision}` : "PENDING REVIEW"}
        </span>
      </div>

      <p className="text-slate-800 text-sm">
        <strong>Description:</strong> {report.description}
      </p>

      {isResolved ? (
        <div className="rounded-lg bg-slate-50 p-2.5 text-slate-700">
          <p className="font-semibold text-slate-900">
            Resolution Decision: {report.managerDecision}
          </p>
          {report.resolutionNotes && (
            <p className="text-slate-600 mt-0.5">{report.resolutionNotes}</p>
          )}
          {report.reviewedBy && (
            <p className="text-[10px] text-slate-400 mt-1">
              Reviewed by {report.reviewedBy.firstName} {report.reviewedBy.lastName} at{" "}
              {report.resolvedAt ? formatAddisDateTime(new Date(report.resolvedAt)) : "—"}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {state?.error && (
            <p className="rounded-lg bg-rose-50 p-2 text-rose-800 font-semibold">{state.error}</p>
          )}
          {state?.ok && (
            <p className="rounded-lg bg-emerald-50 p-2 text-emerald-800 font-semibold">{state.message}</p>
          )}

          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 active:scale-95"
            >
              Review & Make Decision
            </button>
          ) : (
            <form action={formAction} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="decision" value={decision} />

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Manager Decision *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: "RESUME", label: "Resume Trip", desc: "Issue cleared" },
                    { val: "REASSIGN", label: "Reassign", desc: "Vehicle/driver" },
                    { val: "CANCEL", label: "Cancel Trip", desc: "Abort assignment" },
                    { val: "COMPLETE", label: "Complete", desc: "Close mission" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setDecision(opt.val)}
                      className={`rounded-lg border p-2 text-left transition-all ${
                        decision === opt.val
                          ? "border-blue-600 bg-blue-50/80 font-bold text-blue-900 ring-2 ring-blue-500"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="block">{opt.label}</span>
                      <span className="text-[10px] text-slate-400 block">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {decision === "REASSIGN" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableVehicles.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Select Replacement Vehicle
                      </label>
                      <select
                        name="newVehicleId"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                      >
                        <option value="">Keep current vehicle</option>
                        {availableVehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.registrationNumber} ({[v.make, v.model].filter(Boolean).join(" ")})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {availableDrivers.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Select Replacement Driver
                      </label>
                      <select
                        name="newDriverId"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                      >
                        <option value="">Keep current driver</option>
                        {availableDrivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.firstName} {d.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {decision === "CANCEL" && (
                <div>
                  <label className="block text-[11px] font-semibold text-rose-800">
                    Cancellation Reason (Required) *
                  </label>
                  <input
                    type="text"
                    name="cancellationReason"
                    required
                    minLength={5}
                    placeholder="Provide mandatory reason for cancelling the trip..."
                    className="mt-1 w-full rounded-lg border border-rose-300 bg-white p-2 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Resolution Notes / Instructions
                </label>
                <textarea
                  name="resolutionNotes"
                  rows={2}
                  placeholder="Operational notes or instructions..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={isPending}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Applying..." : "Confirm Decision"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function ManagerCompletionReviewControl({
  report,
  tripId,
}: {
  report: {
    id: string;
    outcome: string;
    description?: string | null;
    submittedEndOdometer?: number | null;
    odometerUnavailableReason?: string | null;
    reviewStatus: string;
    reviewNotes?: string | null;
    submittedAt: Date | string;
    resubmittedAt?: Date | string | null;
    submittedByDriver?: { firstName: string; lastName: string } | null;
    reviewedBy?: { firstName?: string | null; lastName?: string | null } | null;
    revisions?: Array<{
      id: string;
      revisionNumber: number;
      outcome: string;
      description?: string | null;
      submittedEndOdometer?: number | null;
      submittedAt: Date | string;
    }>;
  };
  tripId: string;
}) {
  const [showClarificationInput, setShowClarificationInput] = useState(false);
  const [state, formAction, isPending] = useActionState<ManagerReviewActionResult | null, FormData>(
    managerReviewCompletionAction,
    null,
  );

  const isApproved = report.reviewStatus === "APPROVED";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div>
          <span className="font-bold text-slate-900 text-sm">
            Completion Report: {report.outcome}
          </span>
          <span className="text-slate-500 block text-[11px]">
            Submitted by {report.submittedByDriver?.firstName} {report.submittedByDriver?.lastName} •{" "}
            {formatAddisDateTime(new Date(report.submittedAt))}
          </span>
        </div>

        <span
          className={`rounded-full px-2.5 py-0.5 font-bold text-[11px] ${
            report.reviewStatus === "APPROVED"
              ? "bg-emerald-100 text-emerald-800"
              : report.reviewStatus === "NEEDS_CLARIFICATION"
                ? "bg-rose-100 text-rose-800"
                : "bg-amber-100 text-amber-800"
          }`}
        >
          {report.reviewStatus.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-lg">
        <div>
          <span className="text-slate-400 block text-[10px]">Submitted Ending Odometer</span>
          <span className="font-bold text-slate-900">
            {report.submittedEndOdometer ? `${Number(report.submittedEndOdometer)} km` : "N/A"}
          </span>
        </div>
        {report.odometerUnavailableReason && (
          <div className="col-span-2 text-rose-800">
            <span className="text-rose-600 block text-[10px] font-bold">Odometer Exception</span>
            <span>{report.odometerUnavailableReason}</span>
          </div>
        )}
        {report.description && (
          <div className="col-span-2">
            <span className="text-slate-400 block text-[10px]">Driver Submission Notes</span>
            <span>{report.description}</span>
          </div>
        )}
      </div>

      {report.revisions && report.revisions.length > 0 && (
        <div className="border-t border-slate-100 pt-2 space-y-1">
          <p className="font-bold text-slate-500 text-[10px] uppercase">
            Revision History ({report.revisions.length})
          </p>
          {report.revisions.map((rev) => (
            <div key={rev.id} className="rounded bg-slate-50 p-2 text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">Revision #{rev.revisionNumber}:</span>{" "}
              {rev.outcome} • {formatAddisDateTime(new Date(rev.submittedAt))}
              {rev.description && <p className="mt-0.5 text-slate-700">{rev.description}</p>}
            </div>
          ))}
        </div>
      )}

      {state?.error && (
        <p className="rounded-lg bg-rose-50 p-2 text-rose-800 font-semibold">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 p-2 text-emerald-800 font-semibold">{state.message}</p>
      )}

      {!isApproved && (
        <div className="pt-2 border-t border-slate-100">
          {!showClarificationInput ? (
            <div className="flex gap-2">
              <form action={formAction} className="inline">
                <input type="hidden" name="reportId" value={report.id} />
                <input type="hidden" name="tripId" value={tripId} />
                <input type="hidden" name="action" value="APPROVE" />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPending ? "Approving..." : "Approve Report"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowClarificationInput(true)}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100"
              >
                Request Clarification
              </button>
            </div>
          ) : (
            <form action={formAction} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="action" value="REQUEST_CLARIFICATION" />

              <label className="block text-xs font-semibold text-amber-950">
                Instructions / What Needs Clarification *
              </label>
              <textarea
                name="reviewNotes"
                required
                rows={2}
                minLength={5}
                placeholder="Explain what the driver needs to clarify or correct..."
                className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowClarificationInput(false)}
                  disabled={isPending}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-[#E6A23C] px-3 py-1 text-xs font-bold text-[#142B45] hover:bg-[#d9942d] disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Send Clarification Request"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isApproved && (
        <div className="rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-800">
          ✓ Approved by {report.reviewedBy?.firstName} {report.reviewedBy?.lastName}
          {report.reviewNotes && ` — "${report.reviewNotes}"`}
        </div>
      )}
    </div>
  );
}
