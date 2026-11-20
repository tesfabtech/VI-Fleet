import { redirect } from "next/navigation";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { getDriverDashboardData } from "@/lib/driver-trip/driver-trip-query-service";
import { ActiveTripCard } from "@/components/driver/active-trip-card";
import { TripCard } from "@/components/driver/trip-card";
import { decodeSpecialRequirements } from "@/lib/department-auth";
import {
  serializeActiveTripCardData,
  serializeTripListItem,
} from "@/lib/driver-trip/serializer";
import Link from "next/link";

export default async function DriverHomePage() {
  let dashboardData;
  try {
    const authContext = await resolveAuthContext();
    dashboardData = await getDriverDashboardData(authContext);
  } catch {
    redirect("/login");
  }

  const { driver, activeTrip, nextScheduledTrip, counts, scheduledTrips } = dashboardData;
  const prominentTrip = activeTrip || nextScheduledTrip;

  let contactName = "";
  let contactPhone = "";
  let isUrgent = false;

  if (prominentTrip) {
    const req = prominentTrip.transportationRequest;
    const meta = decodeSpecialRequirements(req.specialRequirements);
    contactName =
      meta.contactName ||
      [req.requestedBy?.firstName, req.requestedBy?.lastName].filter(Boolean).join(" ").trim() ||
      "Passenger Contact";
    contactPhone = meta.contactPhone || req.requestedBy?.phone || "";
    isUrgent = meta.priority === "URGENT";
  }

  const otherScheduledTrips = prominentTrip
    ? scheduledTrips.filter((t) => t.id !== prominentTrip.id)
    : scheduledTrips;

  // Explicitly serialize trip across Server/Client Component boundary
  // Converts all Prisma Decimal objects (startOdometer, distanceKm, vehicle.currentOdometer) to JS numbers
  const serializedProminentTrip = prominentTrip
    ? serializeActiveTripCardData(prominentTrip)
    : null;

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#245B85] border border-blue-200">
                License #{driver.licenseNumber}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                {driver.status}
              </span>
            </div>
            <h1 className="mt-1.5 text-xl sm:text-2xl font-black text-[#142B45] tracking-tight">
              Welcome back, {driver.firstName}!
            </h1>
            <p className="text-xs text-slate-500">
              Manage your active driving duties, record odometers, and view your schedule.
            </p>
          </div>

          {/* Quick Status Pill */}
          <div className="flex items-center gap-2 text-xs">
            <div className="rounded-xl bg-[#F4F6F8] px-3 py-2 text-center">
              <span className="text-[10px] text-slate-400 block font-medium uppercase">Active</span>
              <span className="text-base font-black text-[#142B45]">{counts.inProgress}</span>
            </div>
            <div className="rounded-xl bg-[#F4F6F8] px-3 py-2 text-center">
              <span className="text-[10px] text-slate-400 block font-medium uppercase">Upcoming</span>
              <span className="text-base font-black text-[#245B85]">{counts.scheduled}</span>
            </div>
            <div className="rounded-xl bg-[#F4F6F8] px-3 py-2 text-center">
              <span className="text-[10px] text-slate-400 block font-medium uppercase">Done</span>
              <span className="text-base font-black text-emerald-700">{counts.completed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Active or Next Trip */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {activeTrip ? "Current Active Trip" : "Next Scheduled Assignment"}
        </h2>

        {serializedProminentTrip ? (
          <ActiveTripCard
            trip={serializedProminentTrip}
            contactName={contactName}
            contactPhone={contactPhone}
            isUrgent={isUrgent}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Active or Upcoming Trips</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You currently have no scheduled driving duties. When your Transport Manager assigns you to a trip, it will appear here instantly.
            </p>
          </div>
        )}
      </section>

      {/* Upcoming Trips List */}
      {otherScheduledTrips.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Other Upcoming Trips ({otherScheduledTrips.length})
            </h2>
            <Link href="/driver/trips" className="text-xs font-bold text-[#245B85] hover:underline">
              View All →
            </Link>
          </div>

          <div className="space-y-2.5">
            {otherScheduledTrips.slice(0, 3).map((trip) => (
              <TripCard key={trip.id} trip={serializeTripListItem(trip)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
