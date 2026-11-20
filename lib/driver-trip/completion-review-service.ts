import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type AuthContext,
  type CompletionReviewInput,
  type CreateRevisionInput,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "./types";
import { requireTransportManagerRole, requireDriverRole } from "./auth-context";
import { formatAddisDateTime } from "@/lib/department-auth";
import { appendTripHistoryEntry } from "@/lib/trip-scheduling";
import { validateEndingOdometer } from "./odometer-service";

export async function reviewCompletionReport(
  reportId: string,
  input: CompletionReviewInput,
  authContext: AuthContext,
) {
  requireTransportManagerRole(authContext);

  if (!input.action || !["APPROVE", "REQUEST_CLARIFICATION"].includes(input.action)) {
    throw new ValidationError("Invalid review action. Must be APPROVE or REQUEST_CLARIFICATION.");
  }

  if (input.action === "REQUEST_CLARIFICATION" && (!input.reviewNotes || input.reviewNotes.trim().length < 5)) {
    throw new ValidationError("Please provide a reason or clarification instructions (at least 5 characters).");
  }

  return await prisma.$transaction(async (tx) => {
    const report = await tx.tripCompletionReport.findFirst({
      where: {
        id: reportId,
        organizationId: authContext.organizationId,
      },
      include: {
        trip: {
          include: {
            driver: true,
            transportationRequest: { select: { purpose: true } },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundError("Completion report not found.");
    }

    const now = new Date();
    const nextStatus = input.action === "APPROVE" ? "APPROVED" : "NEEDS_CLARIFICATION";

    const updatedReport = await tx.tripCompletionReport.update({
      where: { id: report.id },
      data: {
        reviewStatus: nextStatus,
        reviewedById: authContext.userId,
        reviewedAt: now,
        reviewNotes: input.reviewNotes?.trim() || null,
      },
    });

    // Dual-write note in Trip history
    const actionLabel = input.action === "APPROVE" ? "COMPLETION_APPROVED" : "CLARIFICATION_REQUESTED";
    const detail = `${input.action === "APPROVE" ? "Report approved" : "Clarification requested"} by manager ${authContext.userName}.${input.reviewNotes ? ` Note: ${input.reviewNotes}` : ""}`;

    const updatedNotes = appendTripHistoryEntry(
      report.trip.notes,
      {
        timestamp: formatAddisDateTime(now),
        actor: authContext.userName,
        action: actionLabel,
        detail,
      },
      null,
    );

    await tx.trip.update({
      where: { id: report.tripId },
      data: { notes: updatedNotes },
    });

    // Alert driver if clarification requested
    if (input.action === "REQUEST_CLARIFICATION") {
      await tx.alert.create({
        data: {
          organizationId: authContext.organizationId,
          tripId: report.tripId,
          driverId: report.submittedByDriverId,
          alertType: "COMPLETION_CLARIFICATION_REQUESTED",
          severity: "WARNING",
          title: `Clarification Requested on Trip Completion: ${report.trip.transportationRequest.purpose}`.slice(0, 200),
          message: `Manager ${authContext.userName} requested clarification on your completion report: ${input.reviewNotes}. Please submit a revision.`,
          status: "OPEN",
          occurredAt: now,
        },
      });
    }

    return updatedReport;
  });
}

export async function submitCompletionRevision(
  reportId: string,
  input: CreateRevisionInput,
  authContext: AuthContext,
) {
  const driver = requireDriverRole(authContext);

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch completion report
    const report = await tx.tripCompletionReport.findFirst({
      where: {
        id: reportId,
        organizationId: authContext.organizationId,
      },
      include: {
        trip: {
          include: {
            vehicle: true,
            transportationRequest: { select: { purpose: true } },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundError("Completion report not found.");
    }

    if (report.submittedByDriverId !== driver.id) {
      throw new ForbiddenError("Only the driver who originally submitted this report can submit a revision.");
    }

    if (report.reviewStatus !== "NEEDS_CLARIFICATION") {
      throw new ConflictError(`Revisions can only be submitted when review status is NEEDS_CLARIFICATION (current status: ${report.reviewStatus}).`);
    }

    // 2. Validate ending odometer if resubmitted
    const startOdo = report.trip.startOdometer ? Number(report.trip.startOdometer) : null;
    const odoResult = validateEndingOdometer(
      startOdo,
      input.endOdometer,
      input.odometerUnavailableReason,
    );

    const now = new Date();
    const endOdoDecimal = odoResult.odometer !== null ? new Prisma.Decimal(odoResult.odometer) : null;

    // 3. Increment revision number
    const previousRevisionsCount = await tx.tripCompletionReportRevision.count({
      where: {
        organizationId: authContext.organizationId,
        completionReportId: report.id,
      },
    });
    const revisionNumber = previousRevisionsCount + 1;

    // 4. Create Revision record preserving history
    const revision = await tx.tripCompletionReportRevision.create({
      data: {
        organizationId: authContext.organizationId,
        completionReportId: report.id,
        revisionNumber,
        submittedByDriverId: driver.id,
        outcome: input.outcome,
        description: input.description?.trim() || null,
        submittedEndOdometer: endOdoDecimal,
        odometerUnavailableReason: input.odometerUnavailableReason?.trim() || null,
        submittedAt: now,
      },
    });

    // 5. Update main report: reviewStatus returns to PENDING_REVIEW
    const updatedReport = await tx.tripCompletionReport.update({
      where: { id: report.id },
      data: {
        outcome: input.outcome,
        description: input.description?.trim() || null,
        submittedEndOdometer: endOdoDecimal,
        odometerUnavailableReason: input.odometerUnavailableReason?.trim() || null,
        reviewStatus: "PENDING_REVIEW",
        resubmittedAt: now,
      },
    });

    // 6. Dual-write note in Trip history
    const detail = `Revision #${revisionNumber} submitted by driver ${authContext.userName} (${input.outcome}).${odoResult.odometer !== null ? ` Ending Odo: ${odoResult.odometer} km.` : ""}${input.description ? ` Details: ${input.description}` : ""}`;

    const updatedNotes = appendTripHistoryEntry(
      report.trip.notes,
      {
        timestamp: formatAddisDateTime(now),
        actor: authContext.userName,
        action: `COMPLETION_REVISION_${revisionNumber}`,
        detail,
      },
      null,
    );

    await tx.trip.update({
      where: { id: report.tripId },
      data: {
        ...(endOdoDecimal ? { endOdometer: endOdoDecimal } : {}),
        ...(odoResult.distanceKm !== null ? { distanceKm: new Prisma.Decimal(odoResult.distanceKm) } : {}),
        notes: updatedNotes,
      },
    });

    // 7. Alert managers of revision submission
    await tx.alert.create({
      data: {
        organizationId: authContext.organizationId,
        tripId: report.tripId,
        vehicleId: report.trip.vehicleId,
        driverId: driver.id,
        alertType: "COMPLETION_REVISION_SUBMITTED",
        severity: "INFO",
        title: `Revision #${revisionNumber} Submitted: ${report.trip.transportationRequest.purpose}`.slice(0, 200),
        message: `Driver ${authContext.userName} submitted revision #${revisionNumber} for trip completion. Now pending review.`,
        status: "OPEN",
        occurredAt: now,
      },
    });

    return { completionReport: updatedReport, revision };
  });
}
