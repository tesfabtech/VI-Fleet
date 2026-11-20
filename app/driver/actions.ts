"use server";

import { revalidatePath } from "next/cache";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { startTrip, completeTrip } from "@/lib/driver-trip/trip-execution-service";
import { submitInterruptionReport } from "@/lib/driver-trip/interruption-service";
import { submitCompletionRevision } from "@/lib/driver-trip/completion-review-service";
import { uploadTripEvidence } from "@/lib/driver-trip/evidence-service";
import {
  serializeTripForClient,
  serializeCompletionReport,
  serializeCompletionRevision,
} from "@/lib/driver-trip/serializer";
import type { TripCompletionOutcome, TripInterruptionCategory } from "@/lib/driver-trip/types";

export type DriverActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: unknown;
};

function revalidateDriverPaths(tripId?: string) {
  try {
    revalidatePath("/driver");
    revalidatePath("/driver/trips");
    revalidatePath("/driver/history");
    revalidatePath("/driver/profile");
    if (tripId) {
      revalidatePath(`/driver/trips/${tripId}`);
      revalidatePath(`/transport/trips/${tripId}`);
    }
    revalidatePath("/transport/trips");
    revalidatePath("/transport");
  } catch {
    // Ignore outside request context
  }
}

export async function startTripAction(
  _prev: DriverActionResult | null,
  formData: FormData,
): Promise<DriverActionResult> {
  try {
    const authContext = await resolveAuthContext();
    const tripId = String(formData.get("tripId") ?? "").trim();
    const rawOdo = String(formData.get("startOdometer") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!tripId) {
      return { ok: false, error: "Trip ID is missing." };
    }
    if (!rawOdo) {
      return { ok: false, error: "Please enter a starting odometer reading." };
    }

    const startOdometer = Number(rawOdo);
    if (Number.isNaN(startOdometer)) {
      return { ok: false, error: "Starting odometer must be a valid number." };
    }

    // Optional photo upload
    const file = formData.get("evidencePhoto") as File | null;
    let evidenceId: string | null = null;

    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const evidence = await uploadTripEvidence(
        {
          tripId,
          evidenceType: "START_ODOMETER_PHOTO",
          fileName: file.name || "start_odometer.jpg",
          mimeType: file.type || "image/jpeg",
          fileBuffer: buffer,
          odometerReading: startOdometer,
        },
        authContext,
      );
      evidenceId = evidence.id;
    }

    const result = await startTrip(tripId, { startOdometer, notes, evidenceId }, authContext);

    revalidateDriverPaths(tripId);
    return {
      ok: true,
      message: result.alreadyStarted
        ? "Trip was already in progress."
        : "Trip started successfully! Drive safely.",
      data: serializeTripForClient(result.trip),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to start trip.";
    return { ok: false, error: errorMsg };
  }
}

export async function completeTripAction(
  _prev: DriverActionResult | null,
  formData: FormData,
): Promise<DriverActionResult> {
  try {
    const authContext = await resolveAuthContext();
    const tripId = String(formData.get("tripId") ?? "").trim();
    const outcome = String(formData.get("outcome") ?? "SUCCESSFUL") as TripCompletionOutcome;
    const rawEndOdo = String(formData.get("endOdometer") ?? "").trim();
    const odoUnavailable = formData.get("odometerUnavailable") === "true" || formData.get("odometerUnavailable") === "on";
    const odometerUnavailableReason = String(formData.get("odometerUnavailableReason") ?? "").trim() || null;
    const description = String(formData.get("description") ?? "").trim() || null;

    if (!tripId) {
      return { ok: false, error: "Trip ID is missing." };
    }

    let endOdometer: number | null = null;
    if (!odoUnavailable && rawEndOdo) {
      endOdometer = Number(rawEndOdo);
      if (Number.isNaN(endOdometer)) {
        return { ok: false, error: "Ending odometer must be a valid number." };
      }
    }

    // Optional photo upload
    const file = formData.get("evidencePhoto") as File | null;
    let evidenceId: string | null = null;

    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const evidence = await uploadTripEvidence(
        {
          tripId,
          evidenceType: "COMPLETION_ODOMETER_PHOTO",
          fileName: file.name || "completion_odometer.jpg",
          mimeType: file.type || "image/jpeg",
          fileBuffer: buffer,
          odometerReading: endOdometer,
        },
        authContext,
      );
      evidenceId = evidence.id;
    }

    const result = await completeTrip(
      tripId,
      {
        outcome,
        endOdometer,
        odometerUnavailableReason,
        description,
        evidenceId,
      },
      authContext,
    );

    revalidateDriverPaths(tripId);
    return {
      ok: true,
      message: result.alreadyCompleted
        ? "Trip was already completed."
        : "Trip completed successfully! Report submitted for manager review.",
      data: {
        alreadyCompleted: result.alreadyCompleted,
        trip: serializeTripForClient(result.trip),
        completionReport: result.completionReport
          ? serializeCompletionReport(result.completionReport)
          : null,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to complete trip.";
    return { ok: false, error: errorMsg };
  }
}

export async function submitInterruptionAction(
  _prev: DriverActionResult | null,
  formData: FormData,
): Promise<DriverActionResult> {
  try {
    const authContext = await resolveAuthContext();
    const tripId = String(formData.get("tripId") ?? "").trim();
    const category = String(formData.get("category") ?? "") as TripInterruptionCategory;
    const description = String(formData.get("description") ?? "").trim();

    if (!tripId) return { ok: false, error: "Trip ID is missing." };
    if (!category) return { ok: false, error: "Please select an interruption category." };
    if (!description || description.length < 5) {
      return { ok: false, error: "Please describe the situation (at least 5 characters)." };
    }

    const report = await submitInterruptionReport(tripId, { category, description }, authContext);

    revalidateDriverPaths(tripId);
    return {
      ok: true,
      message: "Interruption report submitted to Transport Office. Trip remains IN_PROGRESS until a manager reviews.",
      data: report,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to report interruption.";
    return { ok: false, error: errorMsg };
  }
}

export async function submitRevisionAction(
  _prev: DriverActionResult | null,
  formData: FormData,
): Promise<DriverActionResult> {
  try {
    const authContext = await resolveAuthContext();
    const reportId = String(formData.get("reportId") ?? "").trim();
    const tripId = String(formData.get("tripId") ?? "").trim();
    const outcome = String(formData.get("outcome") ?? "SUCCESSFUL") as TripCompletionOutcome;
    const rawEndOdo = String(formData.get("endOdometer") ?? "").trim();
    const odoUnavailable = formData.get("odometerUnavailable") === "true" || formData.get("odometerUnavailable") === "on";
    const odometerUnavailableReason = String(formData.get("odometerUnavailableReason") ?? "").trim() || null;
    const description = String(formData.get("description") ?? "").trim() || null;

    if (!reportId) return { ok: false, error: "Report ID is missing." };

    let endOdometer: number | null = null;
    if (!odoUnavailable && rawEndOdo) {
      endOdometer = Number(rawEndOdo);
      if (Number.isNaN(endOdometer)) {
        return { ok: false, error: "Ending odometer must be a valid number." };
      }
    }

    const result = await submitCompletionRevision(
      reportId,
      {
        outcome,
        endOdometer,
        odometerUnavailableReason,
        description,
      },
      authContext,
    );

    revalidateDriverPaths(tripId);
    return {
      ok: true,
      message: "Revision submitted successfully and is now pending review.",
      data: {
        completionReport: serializeCompletionReport(result.completionReport),
        revision: serializeCompletionRevision(result.revision),
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to submit revision.";
    return { ok: false, error: errorMsg };
  }
}
