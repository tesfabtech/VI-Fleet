import { redirect } from "next/navigation";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { getDriverTrips } from "@/lib/driver-trip/driver-trip-query-service";
import { TripCard } from "@/components/driver/trip-card";
import { serializeTripListItem } from "@/lib/driver-trip/serializer";
import Link from "next/link";
import type { TripStatus } from "@prisma/client";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function DriverMyTripsPage({ searchParams }: PageProps) {
  let authContext;
  try {
    authContext = await resolveAuthContext();
  } catch {
    redirect("/login");
  }

  const { status: statusFilter } = await searchParams;
  const status =
    statusFilter === "SCHEDULED" || statusFilter === "IN_PROGRESS"
      ? (statusFilter as TripStatus)
      : undefined;

  const { trips, total } = await getDriverTrips(authContext, { status, limit: 50 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#142B45] tracking-tight">My Assignments</h1>
          <p className="text-xs text-slate-500">Your assigned scheduled and active trips.</p>
        </div>
        <span className="rounded-full bg-[#142B45]/10 px-2.5 py-0.5 text-xs font-bold text-[#142B45]">
          {total} {total === 1 ? "Trip" : "Trips"}
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 text-xs font-semibold">
        <Link
          href="/driver/trips"
          className={`rounded-lg px-3 py-1.5 transition-colors ${
            !status ? "bg-[#142B45] text-white font-bold" : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          All Active & Scheduled
        </Link>
        <Link
          href="/driver/trips?status=IN_PROGRESS"
          className={`rounded-lg px-3 py-1.5 transition-colors ${
            status === "IN_PROGRESS"
              ? "bg-[#142B45] text-white font-bold"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          In Progress
        </Link>
        <Link
          href="/driver/trips?status=SCHEDULED"
          className={`rounded-lg px-3 py-1.5 transition-colors ${
            status === "SCHEDULED"
              ? "bg-[#142B45] text-white font-bold"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          Scheduled
        </Link>
      </div>

      {/* Trips List */}
      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
          <p className="text-xs font-bold text-slate-800">No trips found matching filter.</p>
          <p className="text-xs text-slate-500">
            Check back when a new trip assignment is created by your transport manager.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={serializeTripListItem(trip)} />
          ))}
        </div>
      )}
    </div>
  );
}
