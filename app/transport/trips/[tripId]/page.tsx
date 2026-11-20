import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatVehicleLabel } from "@/lib/drivers/preferred-vehicle";
import {
  decodeSpecialRequirements,
  formatAddisDateTime,
  isUuid,
  toAddisDateTimeLocalValue,
} from "@/lib/department-auth";
import {
  evaluateDriverCandidate,
  evaluateVehicleCandidate,
  getBufferedWindow,
  parseTripNotesAndHistory,
  TURNAROUND_BUFFER_MINUTES,
} from "@/lib/trip-scheduling";
import {
  ScheduleOrReassignTripForm,
  TripLifecycleControls,
} from "../trip-forms";
import {
  ManagerInterruptionReviewControl,
  ManagerCompletionReviewControl,
} from "@/components/transport/report-review-controls";
import {
  serializeCompletionReportForReview,
  decimalToNumber,
} from "@/lib/driver-trip/serializer";
import { PhotoEvidenceViewer } from "@/components/driver/photo-evidence-viewer";

const ALLOWED_ROLES = [
  "SYSTEM_ADMINISTRATOR",
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
];

const badgeStyles: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-700 border-slate-300",
};

type PageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ scheduled?: string }>;
};

export default async function TransportTripDetailPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) notFound();

  const { tripId } = await params;
  const query = await searchParams;
  if (!isUuid(tripId)) notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      organizationId,
      deletedAt: null,
    },
    include: {
      transportationRequest: {
        include: {
          department: { select: { name: true } },
          requestedBy: {
            select: { firstName: true, lastName: true, email: true, phone: true },
          },
          reviewedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      vehicle: true,
      driver: {
        include: {
          preferredVehicle: {
            select: {
              id: true,
              registrationNumber: true,
              make: true,
              model: true,
              vehicleType: true,
            },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          changedBy: {
            select: { firstName: true, lastName: true, role: true },
          },
        },
      },
      interruptionReports: {
        orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
        include: {
          reportedByDriver: {
            select: { firstName: true, lastName: true, phone: true },
          },
          reviewedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      },
      completionReport: {
        include: {
          submittedByDriver: {
            select: { firstName: true, lastName: true },
          },
          reviewedBy: {
            select: { firstName: true, lastName: true },
          },
          revisions: {
            orderBy: { revisionNumber: "asc" },
          },
        },
      },
      evidence: {
        orderBy: { uploadedAt: "desc" },
        include: {
          uploadedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!trip) notFound();

  const req = trip.transportationRequest;
  const meta = decodeSpecialRequirements(req.specialRequirements);
  const { cleanNotes, history } = parseTripNotesAndHistory(trip.notes);

  let evaluatedVehicles: ReturnType<typeof evaluateVehicleCandidate>[] = [];
  let evaluatedDrivers: ReturnType<typeof evaluateDriverCandidate>[] = [];

  if (trip.status === "SCHEDULED") {
    const { bufferedStart, bufferedEnd } = getBufferedWindow(
      trip.scheduledStart,
      trip.scheduledEnd,
      TURNAROUND_BUFFER_MINUTES,
    );
    const weekStart = new Date(Date.now() - 7 * 86_400_000);

    const [rawVehicles, rawDrivers] = await Promise.all([
      prisma.vehicle.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          trips: {
            where: {
              id: { not: trip.id },
              deletedAt: null,
              status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] },
              scheduledEnd: { gte: weekStart },
            },
            select: {
              id: true,
              status: true,
              scheduledStart: true,
              scheduledEnd: true,
              transportationRequest: { select: { destination: true } },
            },
          },
          maintenanceRecords: {
            where: {
              deletedAt: null,
              status: "SCHEDULED",
              maintenanceDate: {
                gte: new Date(
                  Date.UTC(
                    trip.scheduledStart.getUTCFullYear(),
                    trip.scheduledStart.getUTCMonth(),
                    trip.scheduledStart.getUTCDate(),
                  ),
                ),
                lte: new Date(
                  Date.UTC(
                    trip.scheduledEnd.getUTCFullYear(),
                    trip.scheduledEnd.getUTCMonth(),
                    trip.scheduledEnd.getUTCDate(),
                    23,
                    59,
                    59,
                  ),
                ),
              },
            },
            select: { title: true, maintenanceDate: true },
          },
          maintenanceSchedules: {
            where: { deletedAt: null, status: "SCHEDULED" },
            select: { title: true, nextServiceOdometer: true },
          },
        },
      }),
      prisma.driver.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          preferredVehicle: {
            select: {
              id: true,
              registrationNumber: true,
              make: true,
              model: true,
              vehicleType: true,
            },
          },
          trips: {
            where: {
              id: { not: trip.id },
              deletedAt: null,
              status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] },
              scheduledEnd: { gte: weekStart },
            },
            select: {
              id: true,
              status: true,
              scheduledStart: true,
              scheduledEnd: true,
              transportationRequest: { select: { destination: true } },
            },
          },
        },
      }),
    ]);

    evaluatedVehicles = rawVehicles
      .map((v) =>
        evaluateVehicleCandidate(
          {
            id: v.id,
            registrationNumber: v.registrationNumber,
            make: v.make,
            model: v.model,
            vehicleType: v.vehicleType,
            status: v.status,
            availability: v.availability,
            seatingCapacity: v.seatingCapacity,
            currentOdometer: v.currentOdometer ? Number(v.currentOdometer) : null,
            overlappingTrips: v.trips
              .filter(
                (t) =>
                  (t.status === "SCHEDULED" || t.status === "IN_PROGRESS") &&
                  t.scheduledStart < bufferedEnd &&
                  t.scheduledEnd > bufferedStart,
              )
              .map((t) => ({
                id: t.id,
                scheduledStart: t.scheduledStart,
                scheduledEnd: t.scheduledEnd,
                destination: t.transportationRequest.destination,
              })),
            scheduledMaintenances: [
              ...v.maintenanceRecords.map((m) => ({
                title: m.title,
                date: m.maintenanceDate,
                nextOdometer: null,
              })),
              ...v.maintenanceSchedules.map((s) => ({
                title: s.title,
                date: null,
                nextOdometer: s.nextServiceOdometer
                  ? Number(s.nextServiceOdometer)
                  : null,
              })),
            ],
            weeklyTripCount: v.trips.length,
          },
          req.passengerCount,
          meta.vehiclePreference,
        ),
      )
      .sort((a, b) => a.score - b.score);

    evaluatedDrivers = rawDrivers
      .map((d) =>
        evaluateDriverCandidate(
          {
            id: d.id,
            firstName: d.firstName,
            lastName: d.lastName,
            phone: d.phone,
            licenseNumber: d.licenseNumber,
            licenseExpiryDate: d.licenseExpiryDate,
            status: d.status,
            userId: d.userId,
            preferredVehicleId: d.preferredVehicleId,
            preferredVehicleLabel: d.preferredVehicle
              ? formatVehicleLabel(d.preferredVehicle)
              : null,
            overlappingTrips: d.trips
              .filter(
                (t) =>
                  (t.status === "SCHEDULED" || t.status === "IN_PROGRESS") &&
                  t.scheduledStart < bufferedEnd &&
                  t.scheduledEnd > bufferedStart,
              )
              .map((t) => ({
                id: t.id,
                scheduledStart: t.scheduledStart,
                scheduledEnd: t.scheduledEnd,
                destination: t.transportationRequest.destination,
              })),
            weeklyTripCount: d.trips.length,
          },
          trip.scheduledEnd,
        ),
      )
      .sort((a, b) => a.score - b.score);
  }

  // Vehicles and drivers list for interruption reassignment
  const [fleetVehicles, fleetDrivers] = await Promise.all([
    prisma.vehicle.findMany({
      where: { organizationId, status: "ACTIVE", deletedAt: null },
      select: { id: true, registrationNumber: true, make: true, model: true },
    }),
    prisma.driver.findMany({
      where: { organizationId, status: "ACTIVE", deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/transport/trips?tab=trips"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            ← Back to Trips & Scheduling
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{req.purpose}</h1>
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${badgeStyles[trip.status]}`}
            >
              {trip.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Department: <strong>{req.department.name}</strong> • Route:{" "}
            {req.origin} → {req.destination}
          </p>
        </div>
      </div>

      {query.scheduled === "1" && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          Trip scheduled and assigned! Both the Department User and Assigned Driver can now see this assignment.
        </div>
      )}

      {/* Vehicle, Driver & Schedule Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Assigned Vehicle
            </p>
            {trip.driver.preferredVehicleId === trip.vehicleId && (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Driver's Preferred
              </span>
            )}
          </div>
          <p className="mt-1 text-base font-bold text-slate-900">
            {trip.vehicle.registrationNumber}
          </p>
          <p className="text-xs text-slate-600">
            {[trip.vehicle.make, trip.vehicle.model].filter(Boolean).join(" ") ||
              "Fleet Vehicle"}{" "}
            ({trip.vehicle.seatingCapacity ?? "N/A"} seats)
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Odometer:{" "}
            {trip.vehicle.currentOdometer
              ? `${Number(trip.vehicle.currentOdometer)} km`
              : "N/A"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Assigned Driver
          </p>
          <p className="mt-1 text-base font-bold text-slate-900">
            {trip.driver.firstName} {trip.driver.lastName}
          </p>
          <p className="text-xs text-slate-600">
            License: {trip.driver.licenseNumber}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Preferred:{" "}
            {trip.driver.preferredVehicle
              ? formatVehicleLabel(trip.driver.preferredVehicle)
              : "None"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Schedule & Mileage
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-900">
            Departs: {formatAddisDateTime(trip.scheduledStart)}
          </p>
          <p className="text-xs text-slate-600">
            Ends: {formatAddisDateTime(trip.scheduledEnd)}
          </p>
          {trip.distanceKm && (
            <p className="mt-1 text-xs font-bold text-emerald-700">
              Distance Logged: {Number(trip.distanceKm)} km
            </p>
          )}
        </div>
      </div>

      {/* Driver Interruption Reports Section */}
      {trip.interruptionReports.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Trip Interruption & Incident Reports ({trip.interruptionReports.length})
            </h2>
          </div>
          <div className="space-y-3">
            {trip.interruptionReports.map((report) => (
              <ManagerInterruptionReviewControl
                key={report.id}
                report={report}
                tripId={trip.id}
                availableVehicles={fleetVehicles}
                availableDrivers={fleetDrivers}
              />
            ))}
          </div>
        </section>
      )}

      {/* Driver Completion Report Section */}
      {trip.completionReport && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            Driver Completion Report & Sign-off
          </h2>
          <ManagerCompletionReviewControl
            report={serializeCompletionReportForReview(trip.completionReport)}
            tripId={trip.id}
          />
        </section>
      )}

      {/* Lifecycle Controls */}
      <TripLifecycleControls
        tripId={trip.id}
        currentStatus={trip.status}
        defaultOdometer={
          trip.startOdometer
            ? Number(trip.startOdometer)
            : trip.vehicle.currentOdometer
              ? Number(trip.vehicle.currentOdometer)
              : null
        }
      />

      {/* Reassign Form for Scheduled Trips */}
      {trip.status === "SCHEDULED" && (
        <ScheduleOrReassignTripForm
          mode="reassign"
          requestId={req.id}
          initialVehicleId={trip.vehicleId}
          initialDriverId={trip.driverId}
          initialScheduledStart={toAddisDateTimeLocalValue(trip.scheduledStart)}
          initialScheduledEnd={toAddisDateTimeLocalValue(trip.scheduledEnd)}
          initialNotes={cleanNotes}
          vehicles={evaluatedVehicles}
          drivers={evaluatedDrivers}
        />
      )}

      {/* Trip Evidence / Photos Section */}
      {trip.evidence.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            Trip Photo Evidence ({trip.evidence.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {trip.evidence.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">
                    {ev.evidenceType.replace(/_/g, " ")}
                  </span>
                  {ev.odometerReading && (
                    <span className="text-[11px] text-blue-700 font-semibold block">
                      Reading: {Number(ev.odometerReading)} km
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Uploaded by {ev.uploadedBy.firstName} {ev.uploadedBy.lastName} •{" "}
                    {formatAddisDateTime(ev.uploadedAt)}
                  </span>
                </div>
                <PhotoEvidenceViewer
                  tripId={trip.id}
                  evidenceId={ev.id}
                  evidenceType={ev.evidenceType}
                  odometerReading={decimalToNumber(ev.odometerReading)}
                  uploadedAt={ev.uploadedAt}
                  uploadedByName={`${ev.uploadedBy.firstName} ${ev.uploadedBy.lastName}`}
                  buttonLabel="View Evidence Photo ↗"
                  className="mt-3 text-center rounded-lg bg-white border border-slate-300 py-1.5 text-xs font-semibold text-blue-700 hover:bg-slate-100 transition-colors cursor-pointer"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Structured Status History Audit Trail */}
      {trip.statusHistory.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">
            Trip Status History Audit Trail ({trip.statusHistory.length})
          </h2>
          <div className="mt-3 space-y-2">
            {trip.statusHistory.map((h) => (
              <div
                key={h.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">
                    {h.previousStatus ? `${h.previousStatus} → ` : ""}
                    {h.newStatus}
                  </span>{" "}
                  by{" "}
                  <span className="font-semibold text-blue-700">
                    {h.changedBy.firstName} {h.changedBy.lastName} ({h.changedBy.role})
                  </span>
                  {h.reason && (
                    <p className="mt-0.5 text-slate-600">{h.reason}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {formatAddisDateTime(h.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Legacy Assignment Audit Log */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">
            Legacy Dispatch Notes & History
          </h2>
          <div className="mt-3 space-y-2">
            {history.map((h, i) => (
              <div
                key={`${h.timestamp}-${i}`}
                className="flex flex-col justify-between gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center"
              >
                <div>
                  <span className="font-bold text-slate-900">{h.action}</span>{" "}
                  by <span className="font-semibold text-blue-700">{h.actor}</span>
                  : <span className="text-slate-700">{h.detail}</span>
                </div>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {h.timestamp}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
