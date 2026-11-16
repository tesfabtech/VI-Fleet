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

      {history.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">
            Trip Assignment & Execution Audit Log
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