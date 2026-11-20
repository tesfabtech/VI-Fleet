import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DriverHeader } from "@/components/driver/driver-header";
import { DriverBottomNav } from "@/components/driver/driver-bottom-nav";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "DRIVER") notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const driver = await prisma.driver.findFirst({
    where: {
      organizationId,
      userId: session.user.id,
      deletedAt: null,
    },
    include: {
      organization: { select: { name: true } },
    },
  });

  if (!driver) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-md text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-xl">
            !
          </div>
          <h1 className="text-lg font-bold text-slate-900">Driver Profile Not Linked</h1>
          <p className="text-xs text-slate-600">
            Your user account is not yet linked to an active driver profile in your organization. Please contact your Transport Manager.
          </p>
        </div>
      </div>
    );
  }

  const driverName = `${driver.firstName} ${driver.lastName}`;

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-900 flex flex-col selection:bg-[#E6A23C]/30">
      <DriverHeader
        driverName={driverName}
        organizationName={driver.organization.name}
        licenseNumber={driver.licenseNumber}
      />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 sm:px-6 sm:py-6 pb-24 md:pb-16">
        {children}
      </main>

      <DriverBottomNav />
    </div>
  );
}
