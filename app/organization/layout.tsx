import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";

const navigation = [
  { label: "Overview", href: "/organization" },
  { label: "Departments", href: "/organization/departments" },
  { label: "Department Users", href: "/organization/department-users" },
  {
    label: "Registration Links",
    href: "/organization/department-users/registration-links",
  },
  { label: "Transport Managers", href: "/organization/transport-managers" },
  { label: "Settings", href: "/organization/settings" },
  { label: "Fleet" },
  { label: "Reports" },
];

export default async function OrganizationLayout({
  children,
}: LayoutProps<"/organization">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const allowedRoles = [
    "ORGANIZATION_ADMINISTRATOR",
    "VICE_ORGANIZATION_ADMINISTRATOR",
  ];

  if (
    !allowedRoles.includes(session.user.role) ||
    !session.user.organizationId
  ) {
    notFound();
  }

  const currentUser = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      role: {
        in: ["ORGANIZATION_ADMINISTRATOR", "VICE_ORGANIZATION_ADMINISTRATOR"],
      },
      status: "ACTIVE",
      deletedAt: null,
      organization: {
        deletedAt: null,
      },
    },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      role: true,
    },
  });

  if (!currentUser) {
    redirect("/login");
  }

  const displayName =
    [currentUser.firstName, currentUser.middleName, currentUser.lastName]
      .filter(Boolean)
      .join(" ") ||
    session.user.name?.trim() ||
    "Administrator";

  return (
    <ManagementDashboardShell
      brand="Organization"
      roleLabel={
        currentUser.role === "VICE_ORGANIZATION_ADMINISTRATOR"
          ? "Vice Organization Administrator"
          : "Organization Administrator"
      }
      userName={displayName}
      navigation={navigation}
    >
      {children}
    </ManagementDashboardShell>
  );
}