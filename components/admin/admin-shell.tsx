"use client";

import type { ReactNode } from "react";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";
import type { DashboardNavItem } from "@/components/dashboard/dashboard-sidebar";

const adminNavigation: DashboardNavItem[] = [
  {
    label: "Overview",
    href: "/admin",
  },
  {
    label: "Organization applications",
    href: "/admin/applications",
  },
  {
    label: "Organizations",
  },
  {
    label: "User management",
  },
  {
    label: "Settings",
  },
];

type AdminShellProps = {
  userName?: string;
  children: ReactNode;
};

export default function AdminShell({
  userName = "System Administrator",
  children,
}: AdminShellProps) {
  return (
    <ManagementDashboardShell
      brand="Administration"
      roleLabel="System Administrator"
      userName={userName}
      navigation={adminNavigation}
      homeHref="/admin"
      subtitle="VI-Fleet / Administration"
    >
      {children}
    </ManagementDashboardShell>
  );
}
