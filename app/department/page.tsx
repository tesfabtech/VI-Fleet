import { auth } from "@/auth";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { notFound, redirect } from "next/navigation";

export default async function DepartmentDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "DEPARTMENT_USER") {
    notFound();
  }

  return (
    <DashboardShell
      title="Department Dashboard"
      description="Access your department's information and transport services."
      userName={session.user.name ?? "Department user"}
      roleLabel="Department User"
      cards={[
        {
          title: "Department Information",
          description:
            "View your department's information and assigned organization.",
          status: "Coming soon",
        },
        {
          title: "Transport Requests",
          description:
            "Create and track requests for transport services.",
          status: "Coming soon",
        },
        {
          title: "Assigned Vehicles",
          description:
            "View vehicle assignments relevant to your department.",
          status: "Coming soon",
        },
        {
          title: "Trip History",
          description:
            "Review relevant completed and ongoing trips.",
          status: "Coming soon",
        },
        {
          title: "Notifications",
          description:
            "View updates about requests and transport activities.",
          status: "Coming soon",
        },
        {
          title: "Reports",
          description:
            "Access department-level transport summaries.",
          status: "Coming soon",
        },
      ]}
    />
  );
}