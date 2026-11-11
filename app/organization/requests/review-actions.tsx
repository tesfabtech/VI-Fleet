"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminCancelApprovedRequest,
  approveTransportationRequest,
  flagUnfulfillableRequest,
  rejectTransportationRequest,
  type ReviewActionState,
} from "./actions";

const REJECTION_TEMPLATES = [
  "No vehicle available for the requested time window.",
  "Insufficient advance notice for fleet scheduling.",
  "Outside organization transportation policy.",
  "Incomplete trip justification or passenger details.",
  "Requested departure date/time has already passed.",
];

export function ReviewDecisionCard({
  requestId,
  expectedUpdatedAt,
  isExpired,
  defaultAdminNote = "",
}: {
  requestId: string;
  expectedUpdatedAt: string;
  isExpired: boolean;
  defaultAdminNote?: string;
}) {
  const router = useRouter();
  const [approveState, approveAction, isApproving] = useActionState<
    ReviewActionState,
    FormData
  >(approveTransportationRequest, {});
  const [rejectState, rejectAction, isRejecting] = useActionState<
    ReviewActionState,
    FormData
  >(rejectTransportationRequest, {});

  const [rejectionReason, setRejectionReason] = useState(
    isExpired ? "Requested departure date/time has already passed." : "",
  );

  useEffect(() => {
    if (
      approveState.ok ||
      rejectState.ok ||
      approveState.staleConflict ||
      rejectState.staleConflict
    ) {
      router.refresh();
    }
  }, [
    approveState.ok,
    rejectState.ok,
    approveState.staleConflict,
    rejectState.staleConflict,
    router,
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Approve Card */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-emerald-950">
            Approve Request for Dispatch
          </h2>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            Routes to Transport Manager
          </span>
        </div>
        <p className="mt-1 text-xs text-emerald-800">
          Approving records your decision and timestamp, notifies the requester, and places this request in the Transport Manager's vehicle & driver dispatch queue.
        </p>

        {isExpired && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            Departure time has already passed. Expired requests cannot be approved—use the Reject panel on the right.
          </div>
        )}

        {approveState.error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-300 bg-white p-3 text-xs font-semibold text-rose-700"
          >
            {approveState.error}
          </p>
        )}

        {approveState.ok && approveState.message && (
          <p
            role="status"
            className="mt-3 rounded-xl border border-emerald-300 bg-white p-3 text-xs font-semibold text-emerald-800"
          >
            {approveState.message}
          </p>
        )}

        <form action={approveAction} className="mt-4 space-y-3">
          <input type="hidden" name="requestId" value={requestId} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={expectedUpdatedAt}
          />

          <div>
            <label className="block text-xs font-semibold text-emerald-950">
              Admin Dispatch Instructions for Transport Manager (Optional)
            </label>
            <textarea
              name="adminReviewNote"
              rows={2}
              maxLength={500}
              defaultValue={defaultAdminNote}
              disabled={isExpired || isApproving}
              placeholder="e.g., Approved for Coaster bus; coordinate pickup at Main Gate..."
              className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={isExpired || isApproving || isRejecting}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApproving
              ? "Approving Request..."
              : "Approve Transportation Request"}
          </button>
        </form>
      </section>

      {/* Reject Card */}
      <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
        <h2 className="text-base font-bold text-rose-950">
          Reject Transportation Request
        </h2>
        <p className="mt-1 text-xs text-rose-800">
          Select a quick rejection template below or write a custom reason. The requester will see this reason on their request details page.
        </p>

        {rejectState.error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-300 bg-white p-3 text-xs font-semibold text-rose-700"
          >
            {rejectState.error}
          </p>
        )}

        {rejectState.ok && rejectState.message && (
          <p
            role="status"
            className="mt-3 rounded-xl border border-emerald-300 bg-white p-3 text-xs font-semibold text-emerald-800"
          >
            {rejectState.message}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {REJECTION_TEMPLATES.map((tpl) => (
            <button
              key={tpl}
              type="button"
              onClick={() => setRejectionReason(tpl)}
              className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-medium text-rose-800 transition hover:bg-rose-100"
            >
              + {tpl}
            </button>
          ))}
        </div>

        <form action={rejectAction} className="mt-3 space-y-3">
          <input type="hidden" name="requestId" value={requestId} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={expectedUpdatedAt}
          />

          <div>
            <label className="block text-xs font-semibold text-rose-950">
              Rejection Reason <span className="text-rose-600">*</span>
            </label>
            <textarea
              name="rejectionReason"
              required
              rows={2}
              minLength={5}
              maxLength={500}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this request cannot be approved..."
              className="mt-1 w-full rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isRejecting || isApproving}
            className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-50"
          >
            {isRejecting
              ? "Rejecting Request..."
              : "Reject Transportation Request"}
          </button>
        </form>
      </section>
    </div>
  );
}

export function AdminCancelApprovedCard({
  requestId,
  hasScheduledTrip,
  transportFlagReason,
}: {
  requestId: string;
  hasScheduledTrip: boolean;
  transportFlagReason?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ReviewActionState,
    FormData
  >(adminCancelApprovedRequest, {});

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
      <h2 className="text-base font-bold text-rose-950">
        Cancel Approved Request (Organization Admin)
      </h2>
      <p className="mt-1 text-xs text-rose-800">
        {hasScheduledTrip
          ? "Cancelling this approved request will automatically cancel its scheduled trip and release the assigned vehicle back to AVAILABLE."
          : "If this approved request can no longer be fulfilled or policy has changed, you can cancel it here with an audit reason."}
      </p>

      {state.error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-rose-300 bg-white p-3 text-xs font-semibold text-rose-700"
        >
          {state.error}
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="requestId" value={requestId} />
        <textarea
          name="cancellationReason"
          required
          rows={2}
          minLength={5}
          maxLength={500}
          defaultValue={
            transportFlagReason
              ? `Unable to fulfil dispatch: ${transportFlagReason}`
              : ""
          }
          placeholder="State the reason for cancelling this approved request..."
          className="w-full rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {isPending
            ? "Cancelling Approved Request..."
            : "Confirm Admin Cancellation"}
        </button>
      </form>
    </section>
  );
}

export function TransportCannotFulfilButton({
  requestId,
  existingFlag,
}: {
  requestId: string;
  existingFlag?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(
    existingFlag || "No suitable vehicle or driver available for this window",
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await flagUnfulfillableRequest(requestId, reason);
      if (!res.ok) {
        setError(res.error ?? "Failed to flag request.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
      >
        {existingFlag ? "Update Escalation" : "Can't Fulfil → Alert Admin"}
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        placeholder="Reason why dispatch cannot be fulfilled..."
        className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send Alert to Org Admin"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
        >
          Cancel
        </button>
      </div>
      {error && <span className="text-[11px] font-medium text-rose-600">{error}</span>}
    </div>
  );
}