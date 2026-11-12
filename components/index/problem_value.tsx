export default function ProblemValue() {
  const problems = [
    {
      title: "Paper Logs & Lost Vouchers",
      desc: "Manual trip records and paper fuel chits get lost, making budget audits stressful and imprecise.",
    },
    {
      title: "Vehicle Double-Booking",
      desc: "Departments clash over transport availability without central visibility into active and idle cars.",
    },
    {
      title: "Ghost Fuel & Mileage Gaps",
      desc: "Untracked detours and unverified fuel receipts cause up to 25% annual fleet budget leakage.",
    },
    {
      title: "Costly Emergency Breakdowns",
      desc: "Missed oil changes, tire rotations, and scheduled servicing lead to premature vehicle retirement.",
    },
  ];

  const solutions = [
    {
      title: "1-Click Digital Dispatch",
      desc: "Role-tailored approval pipelines ensure transparent vehicle allocation with zero departmental conflict.",
    },
    {
      title: "Automated Fuel & km/L Tracking",
      desc: "Odometer-verified fuel logging flags anomalies instantly, keeping cost-per-kilometer in check.",
    },
    {
      title: "Predictive Service Schedules",
      desc: "Automated alerts based on mileage thresholds and dates prevent unexpected off-road breakdowns.",
    },
    {
      title: "Audit-Ready Fleet Intelligence",
      desc: "Exportable compliance reports on vehicle usage, driver assignments, and fuel expenditure in seconds.",
    },
  ];

  return (
    <section id="problem-value" className="relative border-t border-slate-200/80 bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
            Problem & Value Proposition
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Traditional fleet management is costing you time, fuel, and control.
          </h2>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
            Spreadsheets and phone calls create operational blind spots. VI-Fleet unifies your entire fleet lifecycle into an automated, transparent, and auditable system.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Problem Card (Without VI-Fleet) */}
          <div className="rounded-2xl border border-red-100 bg-red-50/30 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Without VI-Fleet</h3>
                <p className="text-[11px] font-medium text-red-600">Fragmented, manual, and reactive operations</p>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              {problems.map((p, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border border-red-100 bg-white p-3.5 shadow-2xs">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">
                    ✕
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{p.title}</h4>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Solution Card (With VI-Fleet) */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">With VI-Fleet</h3>
                <p className="text-[11px] font-medium text-blue-600">Automated, transparent, and proactive intelligence</p>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              {solutions.map((s, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border border-blue-100 bg-white p-3.5 shadow-2xs">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{s.title}</h4>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
