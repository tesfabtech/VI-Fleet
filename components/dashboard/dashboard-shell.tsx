type DashboardCard = {
  title: string;
  description: string;
  status: string;
};

type DashboardShellProps = {
  title: string;
  description: string;
  userName: string;
  roleLabel: string;
  cards: DashboardCard[];
};

export default function DashboardShell({
  title,
  description,
  userName,
  roleLabel,
  cards,
}: DashboardShellProps) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold tracking-wide text-blue-700">
              VI-FLEET
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
              {title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              {description}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-gray-500">
              Signed in as
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {userName || "VI-Fleet user"}
            </p>
            <p className="mt-1 text-xs text-blue-700">{roleLabel}</p>
          </div>
        </header>

        <section
          aria-label="Dashboard overview"
          className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-semibold text-gray-900">
                {card.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                {card.description}
              </p>

              <span className="mt-5 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {card.status}
              </span>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
          <h2 className="font-semibold text-gray-950">
            Welcome to your workspace
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Your dashboard is ready. Operational information and
            management actions will appear here as the relevant
            VI-Fleet features are implemented.
          </p>
        </section>

        <footer className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-400">
          VI-Fleet Fleet Management System
        </footer>
      </div>
    </main>
  );
}