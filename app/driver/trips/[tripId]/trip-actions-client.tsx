"use client";

import { useState } from "react";
import { RevisionModal } from "@/components/driver/driver-modals";

export function DriverTripDetailActions({
  reportId,
  tripId,
  reviewNotes,
  previousOutcome,
}: {
  reportId: string;
  tripId: string;
  reviewNotes?: string | null;
  previousOutcome?: string;
}) {
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowRevisionModal(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#E6A23C] hover:bg-[#d9942d] px-4 py-2 text-xs font-bold text-[#142B45] shadow-xs active:scale-95 transition-all"
      >
        <span>Respond to Clarification / Submit Revision</span>
      </button>

      <RevisionModal
        isOpen={showRevisionModal}
        onClose={() => setShowRevisionModal(false)}
        reportId={reportId}
        tripId={tripId}
        reviewNotes={reviewNotes}
        previousOutcome={previousOutcome}
      />
    </>
  );
}
