import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";
import type { DashboardNavItem } from "@/components/dashboard/dashboard-sidebar";

const navigation: DashboardNavItem[] = [
  { label: "Overview", href: "/department" },
  { label: "Transport Requests" },
  { label: "Assigned Vehicles" },
  { label: "Trip History" },
  { label: "Notifications" },
  { label: "Reports" },
];

export default async function DepartmentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "DEPARTMENT_USER") {
    notFound();
  }

  return (
    <ManagementDashboardShell
      brand="Department"
      brandHref="/department"
      roleLabel="Department User"
      userName={session.user.name?.trim() || "Department User"}
      navigation={navigation}
    >
      {children}
    </ManagementDashboardShell>
  );
}
