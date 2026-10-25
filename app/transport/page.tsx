const overviewCards = [
  {
    title: "Vehicles",
    description: "Manage vehicle records and fleet information.",
    status: "Coming soon",
  },
  {
    title: "Drivers",
    description: "Manage driver profiles and assignments.",
    status: "Coming soon",
  },
  {
    title: "Trips",
    description: "Monitor trips, routes, and vehicle assignments.",
    status: "Coming soon",
  },
  {
    title: "Maintenance",
    description: "Track vehicle servicing and maintenance schedules.",
    status: "Coming soon",
  },
  {
    title: "Fuel Records",
    description: "Review fuel usage and related fleet expenses.",
    status: "Coming soon",
  },
  {
    title: "Reports",
    description: "Review transport activity and fleet performance.",
    status: "Coming soon",
  },
];

export default function TransportDashboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-blue-600">
          Transport workspace
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Overview
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Coordinate vehicles, drivers, trips, maintenance, and fuel records
          from your transport management workspace.
        </p>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Transport operations
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Tools for managing daily transport operations.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {overviewCards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-base font-semibold text-slate-900">
                  {card.title}
                </h4>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {card.status}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}