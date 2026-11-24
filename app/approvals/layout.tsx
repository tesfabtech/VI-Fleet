import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";

export default async function ApprovalsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      status: "ACTIVE",
      deletedAt: null,
      organization: { deletedAt: null, status: "ACTIVE" },
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      role: true,
      organizationId: true,
      department: { select: { name: true } },
    },
  });

  if (!user || !user.organizationId) {
    notFound();
  }

  const userName =
    [user.firstName, user.middleName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "User";

  let homeHref = "/organization";
  let brand = "Approvals";
  let roleLabel = "Approver";

  if (
    user.role === "ORGANIZATION_ADMINISTRATOR" ||
    user.role === "VICE_ORGANIZATION_ADMINISTRATOR"
  ) {
    homeHref = "/organization";
    brand = "Organization";
    roleLabel = "Organization Administrator";
  } else if (user.role === "DEPARTMENT_USER") {
    homeHref = "/department";
    brand = "Department";
    roleLabel = `${user.department?.name ?? "Department"} • Approver`;
  } else if (
    user.role === "TRANSPORT_MANAGER" ||
    user.role === "VICE_TRANSPORT_MANAGER"
  ) {
    homeHref = "/transport";
    brand = "Transport";
    roleLabel = "Transport Manager";
  }

  const navigation = [
    { label: "Approvals Inbox", href: "/approvals" },
    { label: "Back to Dashboard", href: homeHref },
  ];

  return (
    <ManagementDashboardShell
      brand={brand}
      roleLabel={roleLabel}
      userName={userName}
      navigation={navigation}
      homeHref="/approvals"
    >
      {children}
    </ManagementDashboardShell>
  );
}
