import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";

const navigation = [
  { label: "Overview", href: "/organization" },
  { label: "Departments", href: "/organization/departments" },
  { label: "Department Users", href: "/organization/department-users" },
  {label:"Transport Managers", href: "/organization/transport-managers"},
  { label: "Users" },
  { label: "Fleet" },
  { label: "Reports" },
  { label: "Settings" },
];

export default async function OrganizationLayout({
  children,
}: LayoutProps<"/organization">) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const allowedRoles = [
    "ORGANIZATION_ADMINISTRATOR",
    "VICE_ORGANIZATION_ADMINISTRATOR",
  ];

  if (!allowedRoles.includes(session.user.role)) {
    notFound();
  }

  return (
    <ManagementDashboardShell
      brand="Organization"
      roleLabel={
        session.user.role === "VICE_ORGANIZATION_ADMINISTRATOR"
          ? "Vice Organization Administrator"
          : "Organization Administrator"
      }
      userName={session.user.name?.trim() || "User"}
      navigation={navigation}
    >
      {children}
    </ManagementDashboardShell>
  );
}