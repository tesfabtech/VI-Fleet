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
  TURNAROUND_BUFFER_MINUTES,
} from "@/lib/trip-scheduling";
import { ScheduleOrReassignTripForm } from "../../trip-forms";

const ALLOWED_ROLES = [
  "SYSTEM_ADMINISTRATOR",
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
];

type PageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function ScheduleApprovedRequestPage({
  params,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) notFound();

  const { requestId } = await params;
  if (!isUuid(requestId)) notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const request = await prisma.transportationRequest.findFirst({
    where: {
      id: requestId,
      organizationId,
      status: "APPROVED",
      deletedAt: null,
    },
    include: {
      department: { select: { name: true } },
      requestedBy: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      reviewedBy: { select: { firstName: true, lastName: true, email: true } },
      trip: { select: { id: true, status: true } },
    },
  });

  if (!request) notFound();

  if (request.trip && request.trip.status !== "CANCELLED") {
    redirect(`/transport/trips/${request.trip.id}`);
  }

  const { bufferedStart, bufferedEnd } = getBufferedWindow(
    request.requestedStart,
    request.requestedEnd,
    TURNAROUND_BUFFER_MINUTES,
  );
  const weekStart = new Date(Date.now() - 7 * 86_400_000);

  // Two-query batch fetch for all vehicles and drivers (including Driver.preferredVehicle from PR #34)
  const [rawVehicles, rawDrivers] = await Promise.all([
    prisma.vehicle.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        trips: {
          where: {
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
                  request.requestedStart.getUTCFullYear(),
                  request.requestedStart.getUTCMonth(),
                  request.requestedStart.getUTCDate(),
                ),
              ),
              lte: new Date(
                Date.UTC(
                  request.requestedEnd.getUTCFullYear(),
                  request.requestedEnd.getUTCMonth(),
                  request.requestedEnd.getUTCDate(),
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
          select: {
            title: true,
            nextServiceDate: true,
            nextServiceOdometer: true,
          },
        },
      },
      orderBy: { registrationNumber: "asc" },
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
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const meta = decodeSpecialRequirements(request.specialRequirements);

  const evaluatedVehicles = rawVehicles
    .map((v) => {
      const overlappingTrips = v.trips
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
        }));

      const scheduledMaintenances = [
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
      ];

      return evaluateVehicleCandidate(
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
          overlappingTrips,
          scheduledMaintenances,
          weeklyTripCount: v.trips.length,
        },
        request.passengerCount,
        meta.vehiclePreference,
      );
    })
    .sort((a, b) => a.score - b.score);

  const evaluatedDrivers = rawDrivers
    .map((d) => {
      const overlappingTrips = d.trips
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
        }));

      return evaluateDriverCandidate(
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
          overlappingTrips,
          weeklyTripCount: d.trips.length,
        },
        request.requestedEnd,
      );
    })
    .sort((a, b) => a.score - b.score);

  const requesterName =
    [request.requestedBy.firstName, request.requestedBy.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    request.requestedBy.email ||
    "Department User";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/transport/trips"
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          ← Back to Trip Scheduling Queue
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            Schedule Trip: {request.purpose}
          </h1>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-800">
            APPROVED
          </span>
          {meta.priority === "URGENT" && (
            <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
              URGENT
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Department: <strong>{request.department.name}</strong> • Requester:{" "}
          {requesterName}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="grid gap-4 text-xs sm:grid-cols-4">
          <div>
            <p className="font-semibold text-slate-500 uppercase">Route</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {request.origin} → {request.destination}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-500 uppercase">
              Requested Window (EAT)
            </p>
            <p className="mt-1 font-medium text-slate-900">
              {formatAddisDateTime(request.requestedStart)}
            </p>
            <p className="text-slate-500">
              to {formatAddisDateTime(request.requestedEnd)}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-500 uppercase">
              Passengers & Pref
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {request.passengerCount} pax ({meta.vehiclePreference})
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-500 uppercase">
              On-Site Contact
            </p>
            <p className="mt-1 font-medium text-slate-900">
              {meta.contactName || requesterName}
            </p>
            <p className="text-slate-500">
              {meta.contactPhone || request.requestedBy.phone || "No phone"}
            </p>
          </div>
        </div>

        {meta.adminReviewNote && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
            <strong>Organization Admin Dispatch Note:</strong>{" "}
            {meta.adminReviewNote}
          </div>
        )}
      </section>

      <ScheduleOrReassignTripForm
        mode="schedule"
        requestId={request.id}
        initialScheduledStart={toAddisDateTimeLocalValue(
          request.requestedStart,
        )}
        initialScheduledEnd={toAddisDateTimeLocalValue(request.requestedEnd)}
        initialNotes={meta.adminReviewNote || ""}
        vehicles={evaluatedVehicles}
        drivers={evaluatedDrivers}
      />
    </div>
  );
}