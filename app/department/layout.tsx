import type { ReactNode } from "react";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";
import { requireDepartmentUserContext } from "@/lib/department-auth";

const navigation = [
  { label: "Overview", href: "/department" },
  { label: "Transport Requests", href: "/department/requests" },
  { label: "New Request", href: "/department/requests/new" },
  { label: "Recycle Bin", href: "/department/requests/recycle-bin" },
];

export default async function DepartmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireDepartmentUserContext();

  return (
    <ManagementDashboardShell
      brand="Department"
      roleLabel={`${ctx.departmentName} • Department User`}
      userName={ctx.userName}
      navigation={navigation}
    >
      {children}
    </ManagementDashboardShell>
  );
}
