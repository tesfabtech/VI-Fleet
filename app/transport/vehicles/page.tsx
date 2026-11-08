import Link from "next/link";
import {
  VehicleAvailability,
  VehicleStatus,
  Prisma,
} from "@prisma/client";
import VehicleTable from "@/components/vehicles/vehicle-table";
import VehicleOrganizationPicker from "@/components/vehicles/vehicle-organization-picker";
import { getVehiclePageState } from "@/lib/vehicles/access";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const pageSize = 15;
const vehicleStatuses = [
  "ACTIVE",
  "INACTIVE",
  "MAINTENANCE",
] as const satisfies readonly VehicleStatus[];
const availabilities = [
  "AVAILABLE",
  "ASSIGNED",
  "UNAVAILABLE",
] as const satisfies readonly VehicleAvailability[];

function value(input: string | string[] | undefined): string {
  return typeof input === "string" ? input : "";
}

function searchHref(page: number, search: string, status: string, availability: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (availability) params.set("availability", availability);
  return `/transport/vehicles?${params.toString()}`;
}

function Notice({
  type,
  children,
}: {
  type: "success" | "error";
  children: string;
}) {
  return (
    <p
      role={type === "error" ? "alert" : "status"}
      className={
        type === "success"
          ? "rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          : "rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
      }
    >
      {children}
    </p>
  );
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [params, pageState] = await Promise.all([
    searchParams,
    getVehiclePageState(),
  ]);
  if (pageState.access.status === "select-organization") {
    return (
      <main className="space-y-6 p-4 sm:p-6">
        <header>
          <p className="text-sm font-medium text-blue-700">Fleet operations</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Vehicles</h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose an organization to review and manage its vehicles.
          </p>
        </header>
        <VehicleOrganizationPicker organizations={pageState.organizations} />
      </main>
    );
  }
  const context = pageState.access.context;
  const search = value(params.q).trim().slice(0, 100);
  const statusInput = value(params.status);
  const availabilityInput = value(params.availability);
  const status = vehicleStatuses.find((item) => item === statusInput);
  const availability = availabilities.find(
    (item) => item === availabilityInput,
  );
  const pageInput = Number(value(params.page) || "1");
  const requestedPage = Number.isSafeInteger(pageInput)
    ? Math.max(1, pageInput)
    : 1;
  const where: Prisma.VehicleWhereInput = {
    organizationId: context.organizationId,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(availability ? { availability } : {}),
    ...(search
      ? {
          OR: [
            {
              registrationNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
            { vin: { contains: search, mode: "insensitive" } },
            { make: { contains: search, mode: "insensitive" } },
            { model: { contains: search, mode: "insensitive" } },
            { vehicleType: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, active, available, assigned, unavailable] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.count({
      where: { organizationId: context.organizationId, deletedAt: null, status: "ACTIVE" },
    }),
    prisma.vehicle.count({
      where: {
        organizationId: context.organizationId,
        deletedAt: null,
        availability: "AVAILABLE",
      },
    }),
    prisma.vehicle.count({
      where: {
        organizationId: context.organizationId,
        deletedAt: null,
        availability: "ASSIGNED",
      },
    }),
    prisma.vehicle.count({
      where: {
        organizationId: context.organizationId,
        deletedAt: null,
        availability: "UNAVAILABLE",
      },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: [{ registrationNumber: "asc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      registrationNumber: true,
      make: true,
      model: true,
      year: true,
      vehicleType: true,
      status: true,
      availability: true,
      currentOdometer: true,
      seatingCapacity: true,
    },
  });
  const notice = value(params.success);
  const error = value(params.error);

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Fleet operations</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Vehicles</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage the vehicles available for your organization’s transport.
          </p>
        </div>
        <Link
          href="/transport/vehicles/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Register vehicle
        </Link>
      </header>

      {context.isSystemAdministrator && (
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Managing organization: <strong>{context.organizationName}</strong>
        </p>
      )}

      {notice === "created" && (
        <Notice type="success">Vehicle registered successfully.</Notice>
      )}
      {notice === "updated" && (
        <Notice type="success">Vehicle information updated.</Notice>
      )}
      {error === "vehicle-not-found" && (
        <Notice type="error">That vehicle could not be found.</Notice>
      )}

      <section
        aria-label="Fleet summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          ["Active vehicles", active],
          ["Available", available],
          ["Assigned", assigned],
          ["Unavailable", unavailable],
        ].map(([label, count]) => (
          <article
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {count}
            </p>
          </article>
        ))}
      </section>

      <form
        action="/transport/vehicles"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_12rem_12rem_auto_auto]"
      >
        <div>
          <label htmlFor="q" className="sr-only">
            Search vehicles
          </label>
          <input
            id="q"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={search}
            placeholder="Registration, VIN, make, or model"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Vehicle status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
        <div>
          <label htmlFor="availability" className="sr-only">
            Availability
          </label>
          <select
            id="availability"
            name="availability"
            defaultValue={availability ?? ""}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">All availability</option>
            <option value="AVAILABLE">Available</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Apply filters
        </button>
        <Link
          href="/transport/vehicles"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear
        </Link>
      </form>

      <section className="space-y-3">
        <p className="text-sm text-slate-600">
          {total} {total === 1 ? "vehicle" : "vehicles"}
        </p>
        <VehicleTable vehicles={vehicles} />
      </section>

      {pageCount > 1 && (
        <nav
          aria-label="Vehicle pages"
          className="flex items-center justify-between"
        >
          <p className="text-sm text-slate-600">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={searchHref(page - 1, search, status ?? "", availability ?? "")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={searchHref(page + 1, search, status ?? "", availability ?? "")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}
