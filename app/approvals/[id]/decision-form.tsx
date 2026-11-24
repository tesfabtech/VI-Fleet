"use client";

import { useActionState, useState } from "react";
import {
  processWorkflowDecisionAction,
  skipWorkflowStageAction,
  type ApproverActionState,
} from "../actions";

interface DecisionFormProps {
  instanceId: string;
  stageName: string;
  stageOrder: number;
  isOptional: boolean;
  approvalPolicy: string;
}

export default function DecisionForm({
  instanceId,
  stageName,
  stageOrder,
  isOptional,
  approvalPolicy,
}: DecisionFormProps) {
  const [activeAction, setActiveAction] = useState<
    "NONE" | "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "SKIP"
  >("NONE");
  const [comment, setComment] = useState("");

  const [decisionState, submitDecision, isPendingDecision] = useActionState(
    processWorkflowDecisionAction,
    {},
  );

  const [skipState, submitSkip, isPendingSkip] = useActionState(
    skipWorkflowStageAction,
    {},
  );

  const isSubmitting = isPendingDecision || isPendingSkip;
  const activeError = decisionState?.error || skipState?.error;
  const activeSuccess = decisionState?.message || skipState?.message;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-blue-100 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Current Action Required
          </span>
          <h3 className="text-lg font-bold text-slate-900">
            Stage {stageOrder}: {stageName}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200 shadow-xs">
            Policy: {approvalPolicy === "ANY_ONE" ? "Any One Approver" : "All Approvers Required"}
          </span>
          {isOptional && (
            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Optional Stage
            </span>
          )}
        </div>
      </div>

      {activeSuccess && (
        <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
          <p className="font-semibold">{activeSuccess}</p>
        </div>
      )}

      {activeError && (
        <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
          <p className="font-semibold">{activeError}</p>
        </div>
      )}

      {!activeSuccess && (
        <div className="mt-5 space-y-4">
          {activeAction === "NONE" && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveAction("APPROVE")}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition"
              >
                Approve Request
              </button>

              <button
                type="button"
                onClick={() => setActiveAction("REQUEST_CHANGES")}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition"
              >
                Request Changes
              </button>

              <button
                type="button"
                onClick={() => setActiveAction("REJECT")}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition"
              >
                Reject Request
              </button>

              {isOptional && (
                <button
                  type="button"
                  onClick={() => setActiveAction("SKIP")}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition"
                >
                  Skip Optional Stage
                </button>
              )}
            </div>
          )}

          {activeAction === "APPROVE" && (
            <form action={submitDecision} className="space-y-4 rounded-lg bg-white p-4 border border-emerald-200">
              <input type="hidden" name="instanceId" value={instanceId} />
              <input type="hidden" name="decisionType" value="APPROVE" />
              <div>
                <label htmlFor="approve-comment" className="block text-sm font-medium text-slate-700 mb-1">
                  Approval Notes / Dispatch Comments (Optional)
                </label>
                <textarea
                  id="approve-comment"
                  name="comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional comments or special instructions for the requester and dispatch team..."
                  className="w-full rounded-md border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting Approval..." : "Confirm Approval"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAction("NONE");
                    setComment("");
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {activeAction === "REQUEST_CHANGES" && (
            <form action={submitDecision} className="space-y-4 rounded-lg bg-white p-4 border border-amber-200">
              <input type="hidden" name="instanceId" value={instanceId} />
              <input type="hidden" name="decisionType" value="REQUEST_CHANGES" />
              <div>
                <label htmlFor="changes-comment" className="block text-sm font-medium text-slate-700 mb-1">
                  Required Changes / Clarifications <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Explain clearly what needs to be changed. The requester will be able to edit and resubmit their request.
                </p>
                <textarea
                  id="changes-comment"
                  name="comment"
                  rows={3}
                  required
                  minLength={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Please update the passenger count and provide contact phone number..."
                  className="w-full rounded-md border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-amber-500 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || comment.trim().length < 3}
                  className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Sending Request..." : "Send Changes Request"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAction("NONE");
                    setComment("");
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {activeAction === "REJECT" && (
            <form action={submitDecision} className="space-y-4 rounded-lg bg-white p-4 border border-rose-200">
              <input type="hidden" name="instanceId" value={instanceId} />
              <input type="hidden" name="decisionType" value="REJECT" />
              <div>
                <label htmlFor="reject-comment" className="block text-sm font-medium text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Provide an official reason for rejection. This will terminate the approval workflow.
                </p>
                <textarea
                  id="reject-comment"
                  name="comment"
                  rows={3}
                  required
                  minLength={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Schedule conflicts with high-priority organizational events..."
                  className="w-full rounded-md border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-rose-500 focus:ring-rose-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || comment.trim().length < 3}
                  className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAction("NONE");
                    setComment("");
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {activeAction === "SKIP" && (
            <form action={submitSkip} className="space-y-4 rounded-lg bg-white p-4 border border-slate-300">
              <input type="hidden" name="instanceId" value={instanceId} />
              <div>
                <label htmlFor="skip-reason" className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for Skipping Optional Stage <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Document why this optional stage is being waived for this request.
                </p>
                <textarea
                  id="skip-reason"
                  name="reason"
                  rows={3}
                  required
                  minLength={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Waived due to emergency priority dispatch..."
                  className="w-full rounded-md border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-slate-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || comment.trim().length < 3}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Skipping..." : "Confirm Skip Stage"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAction("NONE");
                    setComment("");
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
