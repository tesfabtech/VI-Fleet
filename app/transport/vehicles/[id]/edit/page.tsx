import Link from "next/link";
import { notFound } from "next/navigation";
import { updateVehicle } from "@/app/transport/vehicles/actions";
import VehicleForm from "@/components/vehicles/vehicle-form";
import { requireVehicleContext } from "@/lib/vehicles/access";
import { prisma } from "@/lib/prisma";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, context] = await Promise.all([
    params,
    requireVehicleContext(),
  ]);
  if (!UUID_RE.test(id)) notFound();

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id,
      organizationId: context.organizationId,
      deletedAt: null,
    },
  });
  if (!vehicle) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <Link
          href={`/transport/vehicles/${vehicle.id}`}
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Back to vehicle
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">
          Edit {vehicle.registrationNumber}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Update vehicle details and operational availability.
        </p>
      </header>
      <VehicleForm
        action={updateVehicle}
        values={{
          id: vehicle.id,
          registrationNumber: vehicle.registrationNumber,
          vin: vehicle.vin,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          vehicleType: vehicle.vehicleType,
          status: vehicle.status,
          availability: vehicle.availability,
          fuelType: vehicle.fuelType,
          seatingCapacity: vehicle.seatingCapacity,
          currentOdometer: vehicle.currentOdometer?.toString(),
          notes: vehicle.notes,
        }}
        cancelHref={`/transport/vehicles/${vehicle.id}`}
        submitLabel="Save vehicle"
      />
    </main>
  );
}
