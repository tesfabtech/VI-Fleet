export default function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Register & Onboard Fleet",
      badge: "Setup",
      desc: "Create your organization workspace, import company vehicles with license and spec details, and invite drivers and managers with role-based access.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      step: "02",
      title: "Submit Trip Requests",
      badge: "Requisition",
      desc: "Department staff submit transport requests online with departure times, passenger count, and destinations—replacing slow paper sign-off sheets.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      step: "03",
      title: "Review & Dispatch",
      badge: "Operations",
      desc: "Transport managers approve pending requisitions, match available vehicles with certified drivers, and dispatch with instant schedule updates.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      step: "04",
      title: "Log Fuel & Maintain",
      badge: "Intelligence",
      desc: "Drivers record odometer and fuel chits upon arrival. The system calculates km/L efficiency and triggers predictive maintenance alerts.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="border-t border-slate-200/80 bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
            Workflow
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            How VI-Fleet streamlines your operations
          </h2>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
            Four straightforward steps that turn complex logistics into an automated, error-free workflow.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => (
            <div
              key={item.step}
              className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300 hover:shadow-md"
            >
              <div>
                {/* Step Top Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    {item.icon}
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-400">
                    STEP {item.step}
                  </span>
                </div>

                <div className="mt-4">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                    {item.badge}
                  </span>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {item.desc}
                  </p>
                </div>
              </div>

              {/* Progress indicator bottom bar */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${(index + 1) * 25}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-400">
                  {index + 1}/4
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
