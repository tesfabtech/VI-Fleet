import Link from "next/link";

const overviewCards = [
  {
    title: "Departments",
    description: "Create and manage departments within your organization.",
    status: "Available",
    href: "/organization/departments",
  },
  {
  title: "Transport Managers",
  description: "Create and manage Transport Manager and Vice Transport Manager accounts.",
  status: "Available",
  href: "/organization/transport-managers",
},
  {
    title: "Users",
    description: "Manage organization members, roles, and access.",
    status: "Coming soon",
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
  {
    title: "Settings",
    description: "Manage your organization profile and preferences.",
    status: "Coming soon",
  },
];

export default function OrganizationDashboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-blue-600">
          Organization workspace
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Overview
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Manage your organization, departments, users, and fleet operations
          from one place.
        </p>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Management tools
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Your organization management features.
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