import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ManagementDashboardShell from "@/components/dashboard/management-dashboard-shell";

const navigation = [
  { label: "Overview", href: "/transport" },
  { label: "Vehicles" },
  { label: "Drivers", href: "/transport/drivers" },
  { label: "Trips" },
  { label: "Maintenance" },
  { label: "Fuel Records" },
  { label: "Reports" },
];

export default async function TransportLayout({
  children,
}: LayoutProps<"/transport">) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const allowedRoles = [
    "TRANSPORT_MANAGER",
    "VICE_TRANSPORT_MANAGER",
  ];

  if (!allowedRoles.includes(session.user.role)) {
    notFound();
  }

  return (
    <ManagementDashboardShell
      brand="Transport"
      roleLabel={
        session.user.role === "VICE_TRANSPORT_MANAGER"
          ? "Vice Transport Manager"
          : "Transport Manager"
      }
      userName={session.user.name?.trim() || "User"}
      navigation={navigation}
    >
      {children}
    </ManagementDashboardShell>
  );
}