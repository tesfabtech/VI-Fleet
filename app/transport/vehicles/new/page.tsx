import Link from "next/link";
import { createVehicle } from "@/app/transport/vehicles/actions";
import VehicleForm from "@/components/vehicles/vehicle-form";
import { requireVehicleContext } from "@/lib/vehicles/access";

export default async function NewVehiclePage() {
  await requireVehicleContext();

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <Link
          href="/transport/vehicles"
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Back to vehicles
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">
          Register a vehicle
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Add vehicle details for your organization’s transportation planning.
        </p>
      </header>
      <VehicleForm
        action={createVehicle}
        cancelHref="/transport/vehicles"
        submitLabel="Register vehicle"
      />
    </main>
  );
}
