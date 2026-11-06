import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const allowedRoles = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];

export default async function OrganizationDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!allowedRoles.includes(session.user.role)) notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const [pendingRequests, approvedAwaitingDispatch, activeDepartments, deptUsers] =
    await Promise.all([
      prisma.transportationRequest.count({
        where: { organizationId, status: "PENDING", deletedAt: null },
      }),
      prisma.transportationRequest.count({
        where: {
          organizationId,
          status: "APPROVED",
          deletedAt: null,
          trip: { is: null },
        },
      }),
      prisma.department.count({
        where: { organizationId, status: "ACTIVE", deletedAt: null },
      }),
      prisma.user.count({
        where: {
          organizationId,
          role: "DEPARTMENT_USER",
          deletedAt: null,
        },
      }),
    ]);

  const overviewCards = [
    {
      title: "Transport Requests Review",
      description:
        "Review, approve, or reject transportation requests submitted by departments before dispatch.",
      status:
        pendingRequests > 0 ? `${pendingRequests} Pending` : "Available",
      href: "/organization/requests",
      highlight: pendingRequests > 0,
    },
    {
      title: "Departments",
      description: "Create and manage departments within your organization.",
      status: `${activeDepartments} Active`,
      href: "/organization/departments",
    },
    {
      title: "Department Users",
      description:
        "Manage department staff accounts, applications, and registration links.",
      status: `${deptUsers} Users`,
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
      title: "Organization Settings",
      description:
        "Manage organization profile, plan usage, theme preferences, and password security.",
      status: "Available",
      href: "/organization/settings",
    },
    {
      title: "Fleet & Reports",
      description: "View organization fleet analytics and operational summaries.",
      status: "Coming soon",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
            Organization Administration
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Workspace Overview
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Review department transportation requests, oversee departments and staff, and coordinate with Transport Managers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/organization/requests?status=PENDING"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            Review Pending Requests ({pendingRequests})
          </Link>
        </div>
      </section>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/organization/requests?status=PENDING"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-amber-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Pending Request Reviews
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-600">
            {pendingRequests}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Awaiting Organization Admin decision →
          </p>
        </Link>

        <Link
          href="/organization/requests?status=APPROVED"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Approved (Awaiting Dispatch)
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {approvedAwaitingDispatch}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sent to Transport Manager →
          </p>
        </Link>

        <Link
          href="/organization/departments"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Active Departments
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {activeDepartments}
          </p>
          <p className="mt-1 text-xs text-slate-500">Manage departments →</p>
        </Link>

        <Link
          href="/organization/department-users"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Department Users
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{deptUsers}</p>
          <p className="mt-1 text-xs text-slate-500">Manage staff →</p>
        </Link>
      </div>

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Management Tools
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Access your organization administration modules.
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
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      card.highlight
                        ? "bg-amber-100 text-amber-800"
                        : card.href
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
                className="block rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-blue-300 hover:shadow-md"
              >
                {content}
              </Link>
            ) : (
              <article
                key={card.title}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
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
