import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const overviewCards = [
  {
    title: "Organization Settings",
    description:
      "View your organization profile, status, and update institutional contact details.",
    status: "Available",
    href: "/organization/settings",
  },
  {
    title: "Departments",
    description: "Create and manage departments within your organization.",
    status: "Available",
    href: "/organization/departments",
  },
  {
    title: "Department Users",
    description:
      "Review applications, manage registration links, reassign departments, and manage user status.",
    status: "Available",
    href: "/organization/department-users",
  },
  {
    title: "Transport Managers",
    description:
      "Create and manage Transport Manager and Vice Transport Manager accounts.",
    status: "Available",
    href: "/organization/transport-managers",
  },
  {
    title: "Fleet",
    description: "View and manage your organization's fleet.",
    status: "Coming soon",
  },
  {
    title: "Reports",
    description: "Review fleet activity and organization reports.",
    status: "Coming soon",
  },
];

export default async function OrganizationDashboardPage() {
  const session = await auth();

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;

  const [
    organization,
    activeDepartmentsCount,
    departmentUsersCount,
    pendingApplicationsCount,
    transportManagersCount,
  ] = await Promise.all([
    prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      select: {
        name: true,
        code: true,
        status: true,
        contactEmail: true,
        phone: true,
        description: true,
      },
    }),
    prisma.department.count({
      where: {
        organizationId,
        deletedAt: null,
        status: "ACTIVE",
      },
    }),
    prisma.user.count({
      where: {
        organizationId,
        deletedAt: null,
        role: "DEPARTMENT_USER",
      },
    }),
    prisma.departmentUserApplication.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "UNDER_REVIEW"] },
      },
    }),
    prisma.user.count({
      where: {
        organizationId,
        deletedAt: null,
        role: { in: ["TRANSPORT_MANAGER", "VICE_TRANSPORT_MANAGER"] },
      },
    }),
  ]);

  if (!organization) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Organization workspace
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {organization.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {organization.description ||
              "Manage your organization profile, departments, department users, and transport managers from one place."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {organization.code && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Code: {organization.code}
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              organization.status === "ACTIVE"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {organization.status === "ACTIVE" ? "Active" : "Inactive"}
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active departments</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {activeDepartmentsCount}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Department users</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {departmentUsersCount}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending applications</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-amber-600">
            {pendingApplicationsCount}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Transport managers</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {transportManagersCount}
          </p>
        </article>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Management tools
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Your organization administration features.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {overviewCards.map((card) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-base font-semibold text-slate-900">
                    {card.title}
                  </h4>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      card.href
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {card.status}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {card.description}
                </p>
              </>
            );

            return card.href ? (
              <Link
                key={card.title}
                href={card.href}
                className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {content}
              </Link>
            ) : (
              <article
                key={card.title}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                {content}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}