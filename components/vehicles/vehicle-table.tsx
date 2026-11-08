import Link from "next/link";
import type {
  VehicleAvailability,
  VehicleStatus,
} from "@prisma/client";

export type VehicleListItem = {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicleType: string | null;
  status: VehicleStatus;
  availability: VehicleAvailability;
  currentOdometer: { toString(): string } | null;
  seatingCapacity: number | null;
};

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

function badgeStyle(style: string) {
  return `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`;
}

function title(vehicle: VehicleListItem) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    vehicle.vehicleType ||
    "Vehicle details not provided";
}

export default function VehicleTable({
  vehicles,
}: {
  vehicles: VehicleListItem[];
}) {
  if (!vehicles.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
        <h2 className="font-semibold text-slate-900">No vehicles found</h2>
        <p className="mt-1 text-sm text-slate-500">
          Try another search or filter, or register a vehicle.
        </p>
        <Link
          href="/transport/vehicles/new"
          className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Register vehicle
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {vehicles.map((vehicle) => (
          <article
            key={vehicle.id}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/transport/vehicles/${vehicle.id}`}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  {vehicle.registrationNumber}
                </Link>
                <p className="mt-1 text-sm text-slate-600">{title(vehicle)}</p>
              </div>
              <span className={badgeStyle(statusStyles[vehicle.status])}>
                {vehicle.status.replaceAll("_", " ")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={badgeStyle(availabilityStyles[vehicle.availability])}
              >
                {vehicle.availability.replaceAll("_", " ")}
              </span>
              {vehicle.seatingCapacity && (
                <span className="text-sm text-slate-600">
                  {vehicle.seatingCapacity} seats
                </span>
              )}
              {vehicle.currentOdometer && (
                <span className="text-sm text-slate-600">
                  {vehicle.currentOdometer.toString()} km
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Seats</th>
              <th className="px-4 py-3">Odometer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Availability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">
                  <Link
                    href={`/transport/vehicles/${vehicle.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {vehicle.registrationNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{title(vehicle)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {vehicle.vehicleType ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {vehicle.seatingCapacity ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {vehicle.currentOdometer?.toString() ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={badgeStyle(statusStyles[vehicle.status])}>
                    {vehicle.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={badgeStyle(
                      availabilityStyles[vehicle.availability],
                    )}
                  >
                    {vehicle.availability.replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
