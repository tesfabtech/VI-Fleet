import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";
import type { DashboardNavItem } from "@/components/dashboard/dashboard-sidebar";

const navigation: DashboardNavItem[] = [
  { label: "Overview", href: "/driver" },
  { label: "My Assignments" },
  { label: "Assigned Vehicle" },
  { label: "Trip Schedule" },
  { label: "Trip History" },
  { label: "Vehicle Issues" },
];

export default async function DriverLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "DRIVER") {
    notFound();
  }

  return (
    <ManagementDashboardShell
      brand="Driver"
      brandHref="/driver"
      roleLabel="Driver"
      userName={session.user.name?.trim() || "Driver"}
      navigation={navigation}
    >
      {children}
    </ManagementDashboardShell>
  );
}
