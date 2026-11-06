import Link from "next/link";

type VehicleOption = { id: string; registrationNumber: string };

const types = ["PREVENTIVE", "CORRECTIVE", "INSPECTION", "OTHER"] as const;
const statuses = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

export default function MaintenanceFilters({
  action,
  vehicles,
  values,
  withDateRange = false,
}: {
  action: string;
  vehicles: VehicleOption[];
  values: Record<string, string>;
  withDateRange?: boolean;
}) {
  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div>
        <label htmlFor="search" className="mb-1 block text-xs font-medium text-slate-600">
          Search
        </label>
        <input
          id="search"
          name="search"
          type="search"
          defaultValue={values.search}
          placeholder="Title, vehicle, provider…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="type" className="mb-1 block text-xs font-medium text-slate-600">
          Maintenance type
        </label>
        <select
          id="type"
          name="type"
          defaultValue={values.type}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="vehicleId" className="mb-1 block text-xs font-medium text-slate-600">
          Vehicle
        </label>
        <select
          id="vehicleId"
          name="vehicleId"
          defaultValue={values.vehicleId}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All vehicles</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registrationNumber}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate-600">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={values.status}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      {withDateRange && (
        <>
          <div>
            <label htmlFor="from" className="mb-1 block text-xs font-medium text-slate-600">
              Service date from
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={values.from}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-medium text-slate-600">
              Service date to
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={values.to}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </>
      )}
      <div className="flex items-end gap-3">
        <button
          type="submit"
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Apply filters
        </button>
        <Link
          href={action}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}