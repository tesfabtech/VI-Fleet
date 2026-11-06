import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleAvailability, VehicleStatus } from "@prisma/client";
import { requireVehicleContext } from "@/lib/vehicles/access";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const statusStyles: Record<VehicleStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-slate-100 text-slate-700",
  MAINTENANCE: "bg-amber-100 text-amber-800",
};

const availabilityStyles: Record<VehicleAvailability, string> = {
  AVAILABLE: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-violet-100 text-violet-800",
  UNAVAILABLE: "bg-slate-100 text-slate-700",
};

function badge(style: string) {
  return `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Addis_Ababa",
  }).format(date);
}

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : "";
}

export default async function VehicleDetailsPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, query, context] = await Promise.all([
    params,
    searchParams,
    requireVehicleContext(),
  ]);
  if (!UUID_RE.test(id)) notFound();

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id,
      organizationId: context.organizationId,
      deletedAt: null,
    },
    include: {
      trips: {
        where: {
          organizationId: context.organizationId,
          deletedAt: null,
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
        orderBy: { scheduledStart: "asc" },
        take: 10,
        include: {
          driver: { select: { firstName: true, lastName: true } },
          transportationRequest: {
            select: { purpose: true, origin: true, destination: true },
          },
        },
      },
    },
  });
  if (!vehicle) notFound();

  const success = value(query.success);
  const details = [
    ["Registration number", vehicle.registrationNumber],
    ["VIN", vehicle.vin ?? "—"],
    ["Make", vehicle.make ?? "—"],
    ["Model", vehicle.model ?? "—"],
    ["Year", vehicle.year?.toString() ?? "—"],
    ["Color", vehicle.color ?? "—"],
    ["Vehicle type", vehicle.vehicleType ?? "—"],
    ["Fuel type", vehicle.fuelType ?? "—"],
    ["Seating capacity", vehicle.seatingCapacity?.toString() ?? "—"],
    ["Current odometer", vehicle.currentOdometer?.toString() ?? "Not recorded"],
    ["Created", formatDate(vehicle.createdAt)],
    ["Last updated", formatDate(vehicle.updatedAt)],
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {success === "created" && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Vehicle registered successfully.
        </p>
      )}
      {success === "updated" && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Vehicle information updated.
        </p>
      )}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/transport/vehicles"
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            ← Back to vehicles
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-950">
              {vehicle.registrationNumber}
            </h1>
            <span className={badge(statusStyles[vehicle.status])}>
              {vehicle.status.replaceAll("_", " ")}
            </span>
            <span className={badge(availabilityStyles[vehicle.availability])}>
              {vehicle.availability.replaceAll("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {[vehicle.year, vehicle.make, vehicle.model, vehicle.vehicleType]
              .filter(Boolean)
              .join(" ") || "Vehicle details"}
          </p>
        </div>
        <Link
          href={`/transport/vehicles/${vehicle.id}/edit`}
          className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Edit vehicle
        </Link>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold text-slate-950">Vehicle information</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          {details.map(([label, detail]) => (
            <div key={label}>
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-slate-900">
                {detail}
              </dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-sm text-slate-500">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
              {vehicle.notes || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-950">Active trip assignments</h2>
            <p className="mt-1 text-sm text-slate-600">
              Scheduled and in-progress trips affect vehicle availability.
            </p>
          </div>
          <span className="text-sm text-slate-600">
            {vehicle.trips.length} active{" "}
            {vehicle.trips.length === 1 ? "trip" : "trips"}
          </span>
        </div>
        {vehicle.trips.length ? (
          <div className="mt-4 divide-y divide-slate-100">
            {vehicle.trips.map((trip) => (
              <article
                key={trip.id}
                className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {trip.transportationRequest.purpose}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {trip.transportationRequest.origin} →{" "}
                    {trip.transportationRequest.destination}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Driver: {trip.driver.firstName} {trip.driver.lastName}
                  </p>
                </div>
                <div className="text-sm text-slate-600 sm:text-right">
                  <p>{trip.status.replaceAll("_", " ")}</p>
                  <p className="mt-1">{formatDate(trip.scheduledStart)}</p>
                  <p>to {formatDate(trip.scheduledEnd)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            No scheduled or in-progress trips are assigned to this vehicle.
          </p>
        )}
      </section>
    </main>
  );
}
