import { Prisma } from "@prisma/client";
import { formatAddisDateTime } from "@/lib/department-auth";
import { appendTripHistoryEntry, type TripHistoryEntry } from "@/lib/trip-scheduling";
import type { TripStatus } from "@prisma/client";

export interface RecordStatusHistoryParams {
  tx: Prisma.TransactionClient;
  organizationId: string;
  tripId: string;
  changedById: string;
  actorName: string;
  previousStatus: TripStatus | null;
  newStatus: TripStatus;
  actionLabel: string;
  detail: string;
  reason?: string | null;
  existingNotes?: string | null;
  userNote?: string | null;
}

export async function recordTripStatusHistory({
  tx,
  organizationId,
  tripId,
  changedById,
  actorName,
  previousStatus,
  newStatus,
  actionLabel,
  detail,
  reason,
  existingNotes,
  userNote,
}: RecordStatusHistoryParams): Promise<string> {
  const now = new Date();
  const timestampStr = formatAddisDateTime(now);

  // 1. Create structured TripStatusHistory entry
  await tx.tripStatusHistory.create({
    data: {
      organizationId,
      tripId,
      changedById,
      previousStatus,
      newStatus,
      reason: reason || detail,
      createdAt: now,
    },
  });

  // 2. Dual-write to Trip.notes using existing [TRIP-HISTORY] format
  const historyEntry: TripHistoryEntry = {
    timestamp: timestampStr,
    actor: actorName,
    action: actionLabel,
    detail: detail + (reason ? ` (${reason})` : ""),
  };

  const updatedNotes = appendTripHistoryEntry(existingNotes, historyEntry, userNote);
  return updatedNotes;
}
