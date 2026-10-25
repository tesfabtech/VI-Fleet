
"use client";

import { useActionState, useState } from "react";
import {
  approveOrganizationApplication,
  markApplicationUnderReview,
  rejectOrganizationApplication,
  reissueAdministratorInvitation,
  type ApplicationActionState,
} from "../actions";

const initialState: ApplicationActionState = {
  success: false,
  message: "",
};

function InvitationLink({
  invitationPath,
}: {
  invitationPath: string;
}) {
  const [copied, setCopied] = useState(false);

  const invitationUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${invitationPath}`
      : invitationPath;

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 border-t border-green-200 pt-3">
      <p className="font-semibold">Administrator invitation link</p>

      <p className="mt-1 break-all font-mono text-xs">
        {invitationUrl}
      </p>

      <button
        type="button"
        onClick={copyInvitation}
        className="mt-3 rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
      >
        {copied ? "Copied" : "Copy invitation link"}
      </button>

      <p className="mt-2 text-xs">
        Treat this link as a secret. It expires after 48 hours. Share it
        only with the intended administrator. Email delivery is not
        configured yet.
      </p>
    </div>
  );
}

export default function ApplicationActions({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const [reviewState, reviewAction, reviewPending] = useActionState(
    markApplicationUnderReview,
    initialState,
  );

  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectOrganizationApplication,
    initialState,
  );

  const [approveState, approveAction, approvePending] = useActionState(
    approveOrganizationApplication,
    initialState,
  );

  const [invitationState, invitationAction, invitationPending] =
    useActionState(reissueAdministratorInvitation, initialState);

  const actionable = status === "PENDING" || status === "UNDER_REVIEW";
  const alreadyApproved = status === "APPROVED";

  if (!actionable) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-700">
            This application has already been processed.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            No further review or approval actions are available.
          </p>
        </div>

        {alreadyApproved && (
          <section className="rounded-xl border border-blue-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">
              Administrator invitation
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-600">
              If the existing Organization Administrator has not started
              setup and the original invitation link is unavailable, you
              can create a replacement invitation for that account.
              This does not create another organization or user.
            </p>

            <form action={invitationAction} className="mt-4">
              <input
                type="hidden"
                name="applicationId"
                value={applicationId}
              />

              <button
                type="submit"
                disabled={invitationPending}
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
              >
                {invitationPending
                  ? "Creating replacement invitation..."
                  : "Generate replacement invitation"}
              </button>
            </form>

            {invitationState.message && (
              <div
                role="status"
                className={`mt-4 rounded-lg p-3 text-sm leading-6 ${
                  invitationState.success
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                <p>{invitationState.message}</p>

                {invitationState.success &&
                  invitationState.invitationPath && (
                    <InvitationLink
                      invitationPath={invitationState.invitationPath}
                    />
                  )}
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900">Review status</h2>
        <p className="mt-1 text-sm text-gray-500">
          Mark the application as under review before making a decision.
        </p>

        <form action={reviewAction} className="mt-4">
          <input
            type="hidden"
            name="applicationId"
            value={applicationId}
          />

          <button
            type="submit"
            disabled={reviewPending || status === "UNDER_REVIEW"}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reviewPending
              ? "Updating..."
              : status === "UNDER_REVIEW"
                ? "Already under review"
                : "Mark as under review"}
          </button>
        </form>

        {reviewState.message && (
          <p
            role="status"
            className={`mt-3 text-sm ${
              reviewState.success ? "text-green-700" : "text-red-700"
            }`}
          >
            {reviewState.message}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-red-200 p-5">
        <h2 className="font-semibold text-gray-900">Reject application</h2>
        <p className="mt-1 text-sm text-gray-500">
          Record the reason for the decision. This is an internal review
          note; it does not send an email to the applicant.
        </p>

        <form action={rejectAction} className="mt-4 space-y-4">
          <input
            type="hidden"
            name="applicationId"
            value={applicationId}
          />

          <div>
            <label
              htmlFor="rejection-notes"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Rejection reason
            </label>

            <textarea
              id="rejection-notes"
              name="reviewNotes"
              rows={3}
              minLength={10}
              maxLength={2000}
              required
              placeholder="Explain why this application is being rejected..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <button
            type="submit"
            disabled={rejectPending}
            className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
          >
            {rejectPending ? "Rejecting..." : "Reject application"}
          </button>

          {rejectState.message && (
            <p
              role="status"
              className={`text-sm ${
                rejectState.success ? "text-green-700" : "text-red-700"
              }`}
            >
              {rejectState.message}
            </p>
          )}
        </form>
      </section>

      <section className="rounded-xl border border-green-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Approve application</h2>

        <p className="mt-1 text-sm leading-6 text-gray-500">
          Approving creates the organization and an inactive Organization
          Administrator account. The administrator enters their name,
          login email, and password through the invitation setup process.
        </p>

        <form action={approveAction} className="mt-5 space-y-4">
          <input
            type="hidden"
            name="applicationId"
            value={applicationId}
          />

          <div>
            <label
              htmlFor="approval-notes"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Internal review notes (optional)
            </label>

            <textarea
              id="approval-notes"
              name="reviewNotes"
              rows={3}
              maxLength={2000}
              placeholder="Add any relevant internal notes..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            Approval creates an organization and an inactive administrator
            account. Confirm the application details before proceeding.
          </div>

          <button
            type="submit"
            disabled={approvePending}
            className="w-full rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-wait disabled:opacity-60"
          >
            {approvePending
              ? "Creating organization..."
              : "Approve and create organization"}
          </button>

          {approveState.message && (
            <div
              role="status"
              className={`rounded-lg p-3 text-sm leading-6 ${
                approveState.success
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              <p>{approveState.message}</p>

              {approveState.success && approveState.invitationPath && (
                <InvitationLink
                  invitationPath={approveState.invitationPath}
                />
              )}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
