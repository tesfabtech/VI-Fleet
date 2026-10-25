import Link from "next/link";
import { prisma } from "@/lib/prisma";

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  UNDER_REVIEW: "bg-blue-50 text-blue-800",
  APPROVED: "bg-green-50 text-green-800",
  REJECTED: "bg-red-50 text-red-800",
};

export default async function AdminDashboardPage() {
  const [
    pending,
    underReview,
    approved,
    organizations,
    users,
    recentApplications,
  ] = await Promise.all([
    prisma.organizationApplication.count({
      where: { status: "PENDING" },
    }),
    prisma.organizationApplication.count({
      where: { status: "UNDER_REVIEW" },
    }),
    prisma.organizationApplication.count({
      where: { status: "APPROVED" },
    }),
    prisma.organization.count({
      where: { deletedAt: null },
    }),
    prisma.user.count({
      where: { deletedAt: null },
    }),
    prisma.organizationApplication.findMany({
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        organizationName: true,
        contactEmail: true,
        status: true,
        submittedAt: true,
      },
    }),
  ]);

  const stats = [
    {
      label: "Organizations",
      value: organizations,
      detail: "Registered on the platform",
    },
    {
      label: "Platform users",
      value: users,
      detail: "Non-deleted user accounts",
    },
    {
      label: "Pending applications",
      value: pending,
      detail: "Awaiting an initial review",
    },
    {
      label: "Under review",
      value: underReview,
      detail: "Currently being assessed",
    },
    {
      label: "Approved applications",
      value: approved,
      detail: "Successfully approved",
    },
  ];

  return (
    <main>
      {/* Page introduction */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">
            Platform overview
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">
            Welcome to VI-Fleet
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Monitor onboarding and manage your fleet management platform.
          </p>
        </div>

        <Link
          href="/admin/applications"
          className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
        >
          Review applications
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* Platform statistics */}
      <section
        aria-label="Platform statistics"
        className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">
              {stat.label}
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950">
              {stat.value.toLocaleString()}
            </p>

            <p className="mt-2 text-xs text-gray-500">
              {stat.detail}
            </p>
          </div>
        ))}
      </section>

      {/* Recent applications */}
      <section className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-semibold text-gray-950">
              Recent organization applications
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              The latest requests submitted to VI-Fleet.
            </p>
          </div>

          <Link
            href="/admin/applications"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            View all applications →
          </Link>
        </div>

        {recentApplications.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500">
              ▤
            </div>

            <h3 className="mt-4 text-sm font-semibold text-gray-900">
              No applications yet
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              New submissions will appear here.
            </p>

            <Link
              href="/register"
              className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              Open public registration page
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentApplications.map((application) => (
              <div
                key={application.id}
                className="flex flex-col justify-between gap-3 px-5 py-4 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:px-6"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {application.organizationName}
                  </p>

                  <p className="mt-1 truncate text-sm text-gray-500">
                    {application.contactEmail}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Submitted{" "}
                    {application.submittedAt.toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      statusStyles[application.status] ??
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {application.status.replaceAll("_", " ")}
                  </span>

                  <Link
                    href={`/admin/applications/${application.id}`}
                    className="whitespace-nowrap text-sm font-semibold text-blue-700 hover:text-blue-800"
                  >
                    Review →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Onboarding quick action */}
      <section className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-gray-950">
              Organization onboarding
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-600">
              Review each request before activating an organization
              and inviting its first administrator.
            </p>
          </div>

          <Link
            href="/admin/applications"
            className="inline-flex w-fit shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-blue-300 hover:text-blue-700"
          >
            Manage applications
          </Link>
        </div>
      </section>
    </main>
  );
}