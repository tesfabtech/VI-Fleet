import { redirect } from "next/navigation";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { prisma } from "@/lib/prisma";
import { formatAddisDateTime } from "@/lib/department-auth";

export default async function DriverProfilePage() {
  let authContext;
  try {
    authContext = await resolveAuthContext();
  } catch {
    redirect("/login");
  }

  if (!authContext.driver) {
    redirect("/driver");
  }

  const driver = await prisma.driver.findUnique({
    where: { id: authContext.driver.id },
    include: {
      organization: { select: { name: true, contactEmail: true, phone: true } },
      preferredVehicle: {
        select: {
          registrationNumber: true,
          make: true,
          model: true,
          vehicleType: true,
          currentOdometer: true,
        },
      },
    },
  });

  if (!driver) redirect("/driver");

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-black text-[#142B45] tracking-tight">Driver Profile</h1>
        <p className="text-xs text-slate-500">Your fleet identification and credentials.</p>
      </div>

      {/* Driver Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#142B45] text-white font-black text-lg">
            {driver.firstName[0]}
            {driver.lastName[0]}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {driver.firstName} {driver.lastName}
            </h2>
            <p className="text-xs text-slate-500">{driver.organization.name}</p>
          </div>
          <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
            {driver.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">License Number</span>
            <span className="font-bold text-slate-900 block mt-0.5">{driver.licenseNumber}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">License Expiry</span>
            <span className="font-bold text-slate-900 block mt-0.5">
              {driver.licenseExpiryDate
                ? formatAddisDateTime(driver.licenseExpiryDate).split(" at ")[0]
                : "No expiry recorded"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">Phone Number</span>
            <span className="font-bold text-slate-900 block mt-0.5">
              {driver.phone || "Not recorded"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">Account Email</span>
            <span className="font-bold text-slate-900 block mt-0.5 truncate">
              {authContext.userEmail || "No email"}
            </span>
          </div>
        </div>
      </div>

      {/* Preferred Vehicle */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Preferred Vehicle Assignment
        </h3>

        {driver.preferredVehicle ? (
          <div className="flex items-center justify-between rounded-xl bg-[#F4F6F8] p-3 text-xs">
            <div>
              <p className="font-bold text-slate-900 text-sm">
                {driver.preferredVehicle.registrationNumber}
              </p>
              <p className="text-slate-600">
                {[driver.preferredVehicle.make, driver.preferredVehicle.model].filter(Boolean).join(" ") || "Vehicle"}
              </p>
            </div>
            {driver.preferredVehicle.currentOdometer && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Odometer</span>
                <span className="font-bold text-[#245B85]">
                  {Number(driver.preferredVehicle.currentOdometer)} km
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No preferred vehicle configured. Your transport manager assigns vehicles dynamically per trip.
          </p>
        )}
      </div>

      {/* Organization Support */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs text-xs space-y-2">
        <h3 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
          Transport Office Contact
        </h3>
        <p className="font-semibold text-slate-800">{driver.organization.name}</p>
        {driver.organization.phone && (
          <p className="text-slate-600">Tel: {driver.organization.phone}</p>
        )}
        {driver.organization.contactEmail && (
          <p className="text-slate-600">Email: {driver.organization.contactEmail}</p>
        )}
      </div>
    </div>
  );
}
