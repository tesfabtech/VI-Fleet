"use client";

import { useState, useEffect, useCallback } from "react";
import { formatAddisDateTime } from "@/lib/date-format";

export interface PhotoEvidenceViewerProps {
  tripId: string;
  evidenceId: string;
  evidenceType: string;
  odometerReading?: number | null;
  uploadedAt: Date | string;
  uploadedByName?: string | null;
  buttonLabel?: string;
  className?: string;
}

export function PhotoEvidenceViewer({
  tripId,
  evidenceId,
  evidenceType,
  odometerReading,
  uploadedAt,
  uploadedByName,
  buttonLabel = "View Photo ↗",
  className = "mt-2 text-center rounded-lg bg-white border border-slate-300 py-1.5 text-[11px] font-semibold text-[#245B85] hover:bg-slate-100 transition-colors",
}: PhotoEvidenceViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const fetchSignedUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    setImageLoaded(false);

    try {
      const res = await fetch(`/api/v1/trips/${tripId}/evidence/${evidenceId}/url`, {
        headers: {
          Accept: "application/json",
        },
      });

      const json = await res.json();

      if (!res.ok || !json.ok || !json.data?.url) {
        throw new Error(
          json.error || `Unable to load photo evidence (status ${res.status}).`,
        );
      }

      setSignedUrl(json.data.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load photo evidence.";
      setError(msg);
      setSignedUrl(null);
    } finally {
      setLoading(false);
    }
  }, [tripId, evidenceId]);

  const handleOpen = () => {
    setIsOpen(true);
    fetchSignedUrl();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Keyboard navigation: Escape closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock background scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const readableType = evidenceType.replace(/_/g, " ");

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={className}
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-evidence-title"
        >
          <div
            className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <h3
                    id="photo-evidence-title"
                    className="text-sm font-bold text-slate-900 truncate"
                  >
                    {readableType}
                  </h3>
                  {odometerReading !== null && odometerReading !== undefined && (
                    <span className="rounded-full bg-[#142B45]/10 px-2.5 py-0.5 text-xs font-bold text-[#142B45]">
                      {Number(odometerReading).toLocaleString()} km
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {uploadedByName ? `Uploaded by ${uploadedByName} • ` : ""}
                  {formatAddisDateTime(new Date(uploadedAt))}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Close modal"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/5 flex items-center justify-center min-h-[300px]">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-500">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-[#245B85]" />
                  <p className="text-xs font-semibold">Generating secure viewing link...</p>
                </div>
              )}

              {error && !loading && (
                <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-4 text-center space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">Photo Unavailable</h4>
                    <p className="text-xs text-rose-700 mt-1">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchSignedUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Retry Request</span>
                  </button>
                </div>
              )}

              {signedUrl && !loading && !error && (
                <div className="relative flex flex-col items-center justify-center w-full">
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
                      <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-[#245B85]" />
                      <p className="text-xs font-semibold">Loading photo evidence...</p>
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signedUrl}
                    alt={readableType}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                      setError("The image link has expired or the file could not be displayed. Click below to request a fresh link.");
                      setSignedUrl(null);
                    }}
                    className={`max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-md border border-slate-200 transition-opacity duration-200 ${
                      imageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
              <div className="flex items-center gap-2">
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span>Open in New Tab ↗</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={fetchSignedUrl}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <svg
                    className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>{loading ? "Refreshing..." : "Refresh Link"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-[#142B45] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#142B45]/90 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
