const features = [
  {
    number: "01",
    title: "Vehicle Management",
    iconBg: "bg-blue-600 text-white",
    description:
      "Maintain detailed vehicle profiles, license documentation, odometer readings, and assignment availability in one centralized database.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
        <path d="M3 13l2-6h14l2 6v6h-2v-2H5v2H3v-6z" />
        <path d="M5 13h14M7 17h.01M17 17h.01" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Driver Management",
    iconBg: "bg-purple-600 text-white",
    description:
      "Keep track of driver profiles, licenses, assigned vehicles, contact details, and performance records with full regulatory compliance.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0112 0v2M16 5a3 3 0 010 6M18 14a5 5 0 013 4v2" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Transportation Requests",
    iconBg: "bg-emerald-600 text-white",
    description:
      "Empower departments to submit trip requests with approvals, route tracking, passenger capacity checks, and automated driver dispatch.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
        <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Maintenance & Fuel",
    iconBg: "bg-amber-600 text-white",
    description:
      "Log scheduled services, prevent unexpected breakdowns, and log fuel receipts to monitor cost per kilometer and fleet uptime.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
        <path d="M14 6l4-4 4 4-4 4M18 6l-8 8M5 4l5 5-6 6-3-3zM3 15l6 6" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="border-y border-slate-200/80 bg-slate-50/70 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
            Operations Engine
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Everything your organization needs to run fleet logistics.
          </h2>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.number}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg shadow-xs ${feature.iconBg}`}>
                    {feature.icon}
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-400">
                    {feature.number}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
