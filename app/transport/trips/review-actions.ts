"use server";

import { revalidatePath } from "next/cache";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { decideInterruptionReport } from "@/lib/driver-trip/interruption-review-service";
import { reviewCompletionReport } from "@/lib/driver-trip/completion-review-service";
import type { TripInterruptionDecision } from "@prisma/client";

export type ManagerReviewActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
};

function revalidateTransportPaths(tripId?: string) {
  try {
    revalidatePath("/transport");
    revalidatePath("/transport/trips");
    revalidatePath("/driver");
    revalidatePath("/driver/trips");
    if (tripId) {
      revalidatePath(`/transport/trips/${tripId}`);
      revalidatePath(`/driver/trips/${tripId}`);
    }
  } catch {
    // Ignore outside request context
  }
}

export async function managerDecideInterruptionAction(
  _prev: ManagerReviewActionResult | null,
  formData: FormData,
): Promise<ManagerReviewActionResult> {
  try {
    const authContext = await resolveAuthContext();
    const reportId = String(formData.get("reportId") ?? "").trim();
    const tripId = String(formData.get("tripId") ?? "").trim();
    const decision = String(formData.get("decision") ?? "") as TripInterruptionDecision;
    const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim() || null;
    const cancellationReason = String(formData.get("cancellationReason") ?? "").trim() || null;
    const newVehicleId = String(formData.get("newVehicleId") ?? "").trim() || null;
    const newDriverId = String(formData.get("newDriverId") ?? "").trim() || null;

    if (!reportId) {
      return { ok: false, error: "Report ID is missing." };
    }
    if (!decision) {
      return { ok: false, error: "Decision is required." };
    }

    await decideInterruptionReport(
      reportId,
      {
        decision,
        resolutionNotes,
        cancellationReason,
        newVehicleId,
        newDriverId,
      },
      authContext,
    );

    revalidateTransportPaths(tripId);
    return {
      ok: true,
      message: `Interruption decision applied: ${decision}.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to record decision.";
    return { ok: false, error: errorMsg };
  }
}

export async function managerReviewCompletionAction(
  _prev: ManagerReviewActionResult | null,
  formData: FormData,
): Promise<ManagerReviewActionResult> {
  try {
    const authContext = await resolveAuthContext();
    const reportId = String(formData.get("reportId") ?? "").trim();
    const tripId = String(formData.get("tripId") ?? "").trim();
    const action = String(formData.get("action") ?? "") as "APPROVE" | "REQUEST_CLARIFICATION";
    const reviewNotes = String(formData.get("reviewNotes") ?? "").trim() || null;

    if (!reportId) {
      return { ok: false, error: "Report ID is missing." };
    }
    if (!action) {
      return { ok: false, error: "Action is required." };
    }

    await reviewCompletionReport(
      reportId,
      {
        action,
        reviewNotes,
      },
      authContext,
    );

    revalidateTransportPaths(tripId);
    return {
      ok: true,
      message:
        action === "APPROVE"
          ? "Completion report approved successfully."
          : "Clarification requested from driver.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to review completion report.";
    return { ok: false, error: errorMsg };
  }
}
