import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAuthorizationContext, PERMISSIONS } from "@/lib/rbac";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";

const navigation = [
  { label: "Overview", href: "/organization" },
  { label: "Transport Requests", href: "/organization/requests" },
  { label: "Departments", href: "/organization/departments" },
  { label: "Department Users", href: "/organization/department-users" },
  {
    label: "Registration Links",
    href: "/organization/department-users/registration-links",
  },
  { label: "Transport Managers", href: "/organization/transport-managers" },
  { label: "Roles & Permissions", href: "/organization/roles" },
  { label: "Role Assignments", href: "/organization/assignments" },
  { label: "Approval Workflows", href: "/organization/workflows" },
  { label: "Approvals Inbox", href: "/approvals" },
  { label: "Fleet" },
  { label: "Reports" },
  { label: "Settings", href: "/organization/settings" },
];

const ALLOWED_ROLES = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
] as const;

type AllowedRole = (typeof ALLOWED_ROLES)[number];

const ROLE_LABELS: Record<AllowedRole, string> = {
  ORGANIZATION_ADMINISTRATOR: "Organization Administrator",
  VICE_ORGANIZATION_ADMINISTRATOR: "Vice Organization Administrator",
};

function isAllowedRole(role: unknown): role is AllowedRole {
  return ALLOWED_ROLES.includes(role as AllowedRole);
}

export default async function OrganizationLayout({
  children,
}: LayoutProps<"/organization">) {
  const session = await auth();

  // 1. Must be signed in
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 2. Cheap early exit from the session (no DB hit for wrong roles)
  if (!isAllowedRole(session.user.role) || !session.user.organizationId) {
    notFound();
  }

  // 3. Re-validate against the database so deactivated or deleted
  //    users/organizations lose access immediately, not at session expiry
  const currentUser = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      role: { in: [...ALLOWED_ROLES] },
      status: "ACTIVE",
      deletedAt: null,
      organization: { deletedAt: null },
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

  const authContext = await getAuthorizationContext();
  const canManageRoles =
    authContext?.hasPermission(PERMISSIONS.ORG_ROLES_MANAGE) ??
    (currentUser.role === "ORGANIZATION_ADMINISTRATOR");
  const canAssignRoles =
    authContext?.hasPermission(PERMISSIONS.ORG_ROLES_ASSIGN) ??
    (currentUser.role === "ORGANIZATION_ADMINISTRATOR" ||
      currentUser.role === "VICE_ORGANIZATION_ADMINISTRATOR");
  const canManageWorkflows =
    authContext?.hasPermission(PERMISSIONS.ORG_ROLES_MANAGE) ??
    (currentUser.role === "ORGANIZATION_ADMINISTRATOR");

  const visibleNavigation = navigation.filter((item) => {
    if (item.href === "/organization/roles") {
      return canManageRoles;
    }
    if (item.href === "/organization/assignments") {
      return canAssignRoles;
    }
    if (item.href === "/organization/workflows") {
      return canManageWorkflows;
    }
    return true;
  });

  return (
    <ManagementDashboardShell
      brand="Organization"
      roleLabel={ROLE_LABELS[currentUser.role as AllowedRole]}
      userName={displayName}
      navigation={visibleNavigation}
      homeHref="/organization"
    >
      {children}
    </ManagementDashboardShell>
  );
}