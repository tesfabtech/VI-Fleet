import { redirect } from "next/navigation";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { getDriverTrips } from "@/lib/driver-trip/driver-trip-query-service";
import { TripCard } from "@/components/driver/trip-card";
import { serializeTripListItem } from "@/lib/driver-trip/serializer";

export default async function DriverHistoryPage() {
  let authContext;
  try {
    authContext = await resolveAuthContext();
  } catch {
    redirect("/login");
  }

  const { trips, total } = await getDriverTrips(authContext, {
    status: "COMPLETED",
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#142B45] tracking-tight">Trip History</h1>
          <p className="text-xs text-slate-500">Your completed trips and report review statuses.</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
          {total} Completed
        </span>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
          <p className="text-xs font-bold text-slate-800">No completed trips yet.</p>
          <p className="text-xs text-slate-500">
            Once you complete scheduled trips, they will appear here along with managerial review decisions.
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
