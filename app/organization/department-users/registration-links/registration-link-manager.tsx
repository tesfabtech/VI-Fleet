"use client";

import { useActionState, useState } from "react";
import { createRegistrationLink, type RegistrationLinkState } from "./actions";

type Props = {
  activeRegistrationUrl: string | null;
  hasUnrevokedLink: boolean;
  organizationName?: string;
};

export default function RegistrationLinkManager({
  activeRegistrationUrl,
  hasUnrevokedLink,
  organizationName = "our organization",
}: Props) {
  const [state, action, pending] = useActionState(createRegistrationLink, {});
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const url = state.registrationUrl ?? activeRegistrationUrl;
  const linkExists = hasUnrevokedLink || Boolean(state.registrationUrl);

  const message = `Apply for a Department User account at ${organizationName} on VI-Fleet:`;
  const fullText = `${message} ${url ?? ""}`;
  const encUrl = encodeURIComponent(url ?? "");
  const encMsg = encodeURIComponent(message);
  const encFull = encodeURIComponent(fullText);

  const shareChannels = url
    ? [
        { label: "Telegram", href: `https://t.me/share/url?url=${encUrl}&text=${encMsg}` },
        { label: "WhatsApp", href: `https://wa.me/?text=${encFull}` },
        { label: "SMS", href: `sms:?&body=${encFull}` },
        { label: "Email", href: `mailto:?subject=${encodeURIComponent(`VI-Fleet Registration — ${organizationName}`)}&body=${encFull}` },
        { label: "X / Twitter", href: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encMsg}` },
        { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}` },
        { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}` },
      ]
    : [];

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function nativeShare() {
    if (!url || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: `VI-Fleet — ${organizationName}`, text: message, url });
    } catch {
      // User cancelled share sheet
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Department User Registration Link</h2>
        <p className="mt-1 text-sm text-gray-600">
          Share this public application link with department staff via Telegram, WhatsApp, SMS, or email.
        </p>
      </div>

      {url ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-green-900">Active Registration Link</h3>
            <span className="text-xs text-green-800">Admin approval required after submission</span>
          </div>

          <input
            readOnly
            value={url}
            aria-label="Registration link"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border border-green-300 bg-white px-3 py-2 font-mono text-xs text-gray-900"
          />

          {/* Primary Actions: Copy, Native Share, QR Code */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg bg-green-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-green-800"
            >
              {copied ? "✓ Copied!" : "Copy link"}
            </button>

            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={nativeShare}
                className="rounded-lg border border-green-700 bg-white px-3.5 py-1.5 text-xs font-semibold text-green-900 hover:bg-green-100"
              >
                Share via device...
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="rounded-lg border border-green-700 bg-white px-3.5 py-1.5 text-xs font-semibold text-green-900 hover:bg-green-100"
            >
              {showQr ? "Hide QR code" : "Show QR code"}
            </button>
          </div>

          {/* Direct Social & Messaging Channels */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-green-200 pt-3">
            <span className="mr-1 text-xs font-medium text-green-900">Share on:</span>
            {shareChannels.map((ch) => (
              <a
                key={ch.label}
                href={ch.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-green-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-green-100"
              >
                {ch.label}
              </a>
            ))}
          </div>

          {showQr && (
            <div className="flex items-center gap-4 rounded-lg bg-white p-3 border border-green-200 w-fit">
              {/* Uses standard QR image endpoint for notice boards/meetings */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encUrl}`}
                alt="Registration link QR code"
                width={140}
                height={140}
                className="rounded"
              />
              <div className="text-xs text-gray-600 max-w-xs">
                <p className="font-semibold text-gray-900">{organizationName}</p>
                <p className="mt-1">Scan with a phone camera to open the Department User application form.</p>
              </div>
            </div>
          )}
        </div>
      ) : linkExists ? (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          An unrevoked link exists. Revoke it in the history below to generate a replacement.
        </div>
      ) : null}

      <form action={action}>
        <button
          type="submit"
          disabled={pending || linkExists}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Creating..." : linkExists ? "Revoke existing link to generate another" : "Generate registration link"}
        </button>
      </form>

      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </section>
  );
}
