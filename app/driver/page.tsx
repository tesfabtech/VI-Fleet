import { auth } from "@/auth";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { notFound, redirect } from "next/navigation";

export default async function DriverDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "DRIVER") {
    notFound();
  }

  return (
    <DashboardShell
      title="Driver Dashboard"
      description="View your driving assignments and fleet-related tasks."
      userName={session.user.name ?? "Driver"}
      roleLabel="Driver"
      cards={[
        {
          title: "My Assignments",
          description:
            "View your assigned trips and upcoming driving duties.",
          status: "Coming soon",
        },
        {
          title: "Assigned Vehicle",
          description:
            "View details of the vehicle assigned to you.",
          status: "Coming soon",
        },
        {
          title: "Trip Schedule",
          description:
            "Review scheduled trips and their current status.",
          status: "Coming soon",
        },
        {
          title: "Trip History",
          description:
            "Review your previous trip records.",
          status: "Coming soon",
        },
        {
          title: "Vehicle Issues",
          description:
            "Report vehicle problems and maintenance concerns.",
          status: "Coming soon",
        },
        {
          title: "Notifications",
          description:
            "View updates about assignments and transport activities.",
          status: "Coming soon",
        },
      ]}
    />
  );
}