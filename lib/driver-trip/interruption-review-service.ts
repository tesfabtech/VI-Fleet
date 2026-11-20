import { prisma } from "@/lib/prisma";
import {
  type AuthContext,
  type InterruptionDecisionInput,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "./types";
import { requireTransportManagerRole } from "./auth-context";
import { recordTripStatusHistory } from "./history-service";
import { getBufferedWindow, TURNAROUND_BUFFER_MINUTES } from "@/lib/trip-scheduling";
import { isUuid } from "@/lib/department-auth";

export async function decideInterruptionReport(
  reportId: string,
  input: InterruptionDecisionInput,
  authContext: AuthContext,
) {
  requireTransportManagerRole(authContext);

  if (!input.decision || !["RESUME", "REASSIGN", "CANCEL", "COMPLETE"].includes(input.decision)) {
    throw new ValidationError(`Invalid decision: ${input.decision}. Valid decisions: RESUME, REASSIGN, CANCEL, COMPLETE.`);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch report and associated trip
    const report = await tx.tripInterruptionReport.findFirst({
      where: {
        id: reportId,
        organizationId: authContext.organizationId,
      },
      include: {
        trip: {
          include: {
            vehicle: true,
            driver: true,
            transportationRequest: {
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundError("Interruption report not found.");
    }

    if (report.status === "RESOLVED") {
      throw new ConflictError("This interruption report has already been resolved.");
    }

    const now = new Date();
    const trip = report.trip;

    // 2. Execute Decision
    if (input.decision === "RESUME") {
      // Mark report resolved; trip stays IN_PROGRESS
      const updatedReport = await tx.tripInterruptionReport.update({
        where: { id: report.id },
        data: {
          status: "RESOLVED",
          managerDecision: "RESUME",
          resolutionNotes: input.resolutionNotes?.trim() || null,
          reviewedById: authContext.userId,
          reviewedAt: now,
          resolvedAt: now,
        },
      });

      const updatedNotes = await recordTripStatusHistory({
        tx,
        organizationId: authContext.organizationId,
        tripId: trip.id,
        changedById: authContext.userId,
        actorName: authContext.userName,
        previousStatus: trip.status,
        newStatus: trip.status,
        actionLabel: "INTERRUPTION_RESUMED",
        detail: `Trip resumed by manager ${authContext.userName}.${input.resolutionNotes ? ` Note: ${input.resolutionNotes}` : ""}`,
        reason: input.resolutionNotes || "Trip resumed after interruption review",
        existingNotes: trip.notes,
      });

      await tx.trip.update({
        where: { id: trip.id },
        data: { notes: updatedNotes },
      });

      return { report: updatedReport, trip };
    }

    if (input.decision === "CANCEL") {
      const reason = (input.cancellationReason || input.resolutionNotes || "").trim();
      if (reason.length < 5) {
        throw new ValidationError("A cancellation reason of at least 5 characters is required to cancel this trip.");
      }

      // Mark report resolved
      const updatedReport = await tx.tripInterruptionReport.update({
        where: { id: report.id },
        data: {
          status: "RESOLVED",
          managerDecision: "CANCEL",
          resolutionNotes: reason,
          reviewedById: authContext.userId,
          reviewedAt: now,
          resolvedAt: now,
        },
      });

      // Update Trip to CANCELLED and release vehicle
      const updatedNotes = await recordTripStatusHistory({
        tx,
        organizationId: authContext.organizationId,
        tripId: trip.id,
        changedById: authContext.userId,
        actorName: authContext.userName,
        previousStatus: trip.status,
        newStatus: "CANCELLED",
        actionLabel: "CANCELLED_AFTER_INTERRUPTION",
        detail: `Trip aborted and cancelled by manager ${authContext.userName}. Reason: ${reason}`,
        reason,
        existingNotes: trip.notes,
      });

      const updatedTrip = await tx.trip.update({
        where: { id: trip.id },
        data: {
          status: "CANCELLED",
          notes: updatedNotes,
        },
      });

      await tx.vehicle.update({
        where: { id: trip.vehicle.id },
        data: { availability: "AVAILABLE" },
      });

      await tx.alert.create({
        data: {
          organizationId: authContext.organizationId,
          tripId: trip.id,
          vehicleId: trip.vehicle.id,
          driverId: trip.driver.id,
          alertType: "TRIP_CANCELLED",
          severity: "CRITICAL",
          title: `Trip Cancelled: ${trip.transportationRequest.purpose}`.slice(0, 200),
          message: `Manager ${authContext.userName} cancelled trip for ${trip.transportationRequest.department.name} following an interruption (${report.category}). Reason: ${reason}. Vehicle released to AVAILABLE.`,
          status: "OPEN",
          occurredAt: now,
        },
      });

      return { report: updatedReport, trip: updatedTrip };
    }

    if (input.decision === "COMPLETE") {
      const notes = (input.resolutionNotes || "").trim();
      const updatedReport = await tx.tripInterruptionReport.update({
        where: { id: report.id },
        data: {
          status: "RESOLVED",
          managerDecision: "COMPLETE",
          resolutionNotes: notes,
          reviewedById: authContext.userId,
          reviewedAt: now,
          resolvedAt: now,
        },
      });

      const updatedNotes = await recordTripStatusHistory({
        tx,
        organizationId: authContext.organizationId,
        tripId: trip.id,
        changedById: authContext.userId,
        actorName: authContext.userName,
        previousStatus: trip.status,
        newStatus: "COMPLETED",
        actionLabel: "COMPLETED_BY_MANAGER",
        detail: `Trip operationally marked completed by manager ${authContext.userName}.${notes ? ` Detail: ${notes}` : ""}`,
        reason: notes || "Resolved and completed by manager",
        existingNotes: trip.notes,
      });

      const updatedTrip = await tx.trip.update({
        where: { id: trip.id },
        data: {
          status: "COMPLETED",
          actualEnd: now,
          notes: updatedNotes,
        },
      });

      await tx.vehicle.update({
        where: { id: trip.vehicle.id },
        data: { availability: "AVAILABLE" },
      });

      return { report: updatedReport, trip: updatedTrip };
    }

    if (input.decision === "REASSIGN") {
      const newVehicleId = input.newVehicleId?.trim();
      const newDriverId = input.newDriverId?.trim();

      if (!newVehicleId && !newDriverId) {
        throw new ValidationError("Please specify a new vehicle, a new driver, or both for reassignment.");
      }

      let targetVehicleId = trip.vehicleId;
      let targetDriverId = trip.driverId;

      if (newVehicleId && newVehicleId !== trip.vehicleId) {
        if (!isUuid(newVehicleId)) throw new ValidationError("Invalid new vehicle ID.");
        const nextVehicle = await tx.vehicle.findFirst({
          where: { id: newVehicleId, organizationId: authContext.organizationId, deletedAt: null },
        });
        if (!nextVehicle || nextVehicle.status !== "ACTIVE") {
          throw new ConflictError("Selected replacement vehicle is not active.");
        }
        targetVehicleId = nextVehicle.id;
      }

      if (newDriverId && newDriverId !== trip.driverId) {
        if (!isUuid(newDriverId)) throw new ValidationError("Invalid new driver ID.");
        const nextDriver = await tx.driver.findFirst({
          where: { id: newDriverId, organizationId: authContext.organizationId, deletedAt: null },
        });
        if (!nextDriver || nextDriver.status !== "ACTIVE") {
          throw new ConflictError("Selected replacement driver is not active.");
        }
        targetDriverId = nextDriver.id;
      }

      // Check conflicting trips for the new vehicle/driver in buffered window
      const { bufferedStart, bufferedEnd } = getBufferedWindow(
        trip.scheduledStart,
        trip.scheduledEnd,
        TURNAROUND_BUFFER_MINUTES,
      );

      const [conflictVehicle, conflictDriver] = await Promise.all([
        tx.trip.findFirst({
          where: {
            organizationId: authContext.organizationId,
            vehicleId: targetVehicleId,
            id: { not: trip.id },
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
            scheduledStart: { lt: bufferedEnd },
            scheduledEnd: { gt: bufferedStart },
            deletedAt: null,
          },
        }),
        tx.trip.findFirst({
          where: {
            organizationId: authContext.organizationId,
            driverId: targetDriverId,
            id: { not: trip.id },
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
            scheduledStart: { lt: bufferedEnd },
            scheduledEnd: { gt: bufferedStart },
            deletedAt: null,
          },
        }),
      ]);

      if (conflictVehicle) {
        throw new ConflictError("The replacement vehicle has a conflicting trip schedule.");
      }
      if (conflictDriver) {
        throw new ConflictError("The replacement driver has a conflicting trip schedule.");
      }

      // Update vehicle availabilities if vehicle changed
      if (targetVehicleId !== trip.vehicleId) {
        await tx.vehicle.update({
          where: { id: trip.vehicleId },
          data: { availability: "AVAILABLE" },
        });
        await tx.vehicle.update({
          where: { id: targetVehicleId },
          data: { availability: "ASSIGNED" },
        });
      }

      const updatedReport = await tx.tripInterruptionReport.update({
        where: { id: report.id },
        data: {
          status: "RESOLVED",
          managerDecision: "REASSIGN",
          resolutionNotes: input.resolutionNotes?.trim() || null,
          reviewedById: authContext.userId,
          reviewedAt: now,
          resolvedAt: now,
        },
      });

      const updatedNotes = await recordTripStatusHistory({
        tx,
        organizationId: authContext.organizationId,
        tripId: trip.id,
        changedById: authContext.userId,
        actorName: authContext.userName,
        previousStatus: trip.status,
        newStatus: trip.status,
        actionLabel: "REASSIGNED_AFTER_INTERRUPTION",
        detail: `Reassigned by manager ${authContext.userName}. New vehicle: ${targetVehicleId}, New driver: ${targetDriverId}.${input.resolutionNotes ? ` Detail: ${input.resolutionNotes}` : ""}`,
        reason: input.resolutionNotes || "Reassigned after interruption",
        existingNotes: trip.notes,
      });

      const updatedTrip = await tx.trip.update({
        where: { id: trip.id },
        data: {
          vehicleId: targetVehicleId,
          driverId: targetDriverId,
          notes: updatedNotes,
        },
      });

      return { report: updatedReport, trip: updatedTrip };
    }

    throw new ValidationError(`Unhandled decision: ${input.decision}`);
  });
}
