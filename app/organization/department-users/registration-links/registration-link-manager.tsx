
"use client";

import { useActionState, useState } from "react";
import {
  createRegistrationLink,
  type RegistrationLinkState,
} from "./actions";

const initialState: RegistrationLinkState = {};

type RegistrationLinkManagerProps = {
  activeRegistrationUrl: string | null;
  hasUnrevokedLink: boolean;
};

export default function RegistrationLinkManager({
  activeRegistrationUrl,
  hasUnrevokedLink,
}: RegistrationLinkManagerProps) {
  const [state, action, pending] = useActionState(
    createRegistrationLink,
    initialState,
  );

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const registrationUrl =
    state.registrationUrl ?? activeRegistrationUrl;

  const linkExists =
    hasUnrevokedLink || Boolean(state.registrationUrl);

  async function copyLink() {
    if (!registrationUrl) return;

    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopied(false);
      setCopyError(
        "Copy failed. Select the link and copy it manually.",
      );
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        Department User registration link
      </h2>

      <p className="mt-2 text-sm text-gray-600">
        Share this link with applicants who want to apply for a
        Department User account in your organization.
      </p>

      {registrationUrl ? (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-medium text-green-900">
            Your registration link
          </h3>

          <p className="mt-1 text-sm text-green-800">
            This is your existing link. You can copy it whenever
            needed. It remains available until revoked or expired.
          </p>

          <textarea
            aria-label="Department User registration link"
            readOnly
            value={registrationUrl}
            rows={3}
            className="mt-3 w-full rounded-md border border-green-300 bg-white p-3 text-sm text-gray-900"
            onFocus={(event) =>
              event.currentTarget.select()
            }
          />

          <button
            type="button"
            onClick={copyLink}
            className="mt-3 rounded-lg border border-green-700 px-3 py-2 text-sm font-medium text-green-900 hover:bg-green-100"
          >
            {copied ? "Copied!" : "Copy registration link"}
          </button>

          {copied && (
            <p
              role="status"
              className="mt-2 text-sm text-green-800"
            >
              Link copied to clipboard.
            </p>
          )}

          {copyError && (
            <p
              role="alert"
              className="mt-2 text-sm text-red-700"
            >
              {copyError}
            </p>
          )}

          <p className="mt-3 text-sm text-gray-600">
            To create a replacement, revoke this link in the
            registration link history below first.
          </p>
        </div>
      ) : linkExists ? (
        <div
          role="status"
          className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          An unrevoked registration link already exists, but its
          original URL cannot be recovered. Revoke that link in
          the history below before generating a replacement.
        </div>
      ) : null}

      <form action={action} className="mt-4">
        <button
          type="submit"
          disabled={pending || linkExists}
          onClick={() => {
            setCopied(false);
            setCopyError("");
          }}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "Creating..."
            : linkExists
              ? "Revoke existing link to generate another"
              : "Generate registration link"}
        </button>
      </form>

      {state.error && (
        <p
          role="alert"
          className="mt-4 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}
    </section>
  );
}
