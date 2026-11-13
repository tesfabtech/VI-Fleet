"use client";

const benefits = [
  {
    title: "Fleet Visibility",
    tagline: "Total Operational Transparency",
    desc: "Gain immediate visibility into vehicle availability, active driver assignments, and trip routes. Maintain complete oversight of every asset across your organization.",
    points: [
      "Live vehicle and trip status tracking",
      "Odometer and mileage monitoring",
      "Real-time driver assignment records",
    ],
    icon: (
      <svg className="h-6 w-6 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    title: "Organized Operations",
    tagline: "Frictionless Requisition",
    desc: "Replace chaotic paperwork, lost receipts, and endless phone calls with a structured digital requisition and dispatch pipeline that keeps departments aligned.",
    points: [
      "Structured departmental request submissions",
      "Transparent approval hierarchies",
      "Elimination of double-booking clashes",
    ],
    icon: (
      <svg className="h-6 w-6 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Resource Utilization",
    tagline: "Cost and Asset Discipline",
    desc: "Prolong vehicle lifespans and curtail operational waste through preventive maintenance schedules, verified fuel logging, and mileage reconciliation.",
    points: [
      "Odometer-triggered service reminders",
      "Cost-per-kilometer fuel auditing",
      "Minimized idle downtime and wear",
    ],
    icon: (
      <svg className="h-6 w-6 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    title: "Centralized Management",
    tagline: "Unified Multi-Role Control",
    desc: "Bring administration, transport directors, departmental coordinators, and drivers into one secure, multi-tenant workspace with strict access controls.",
    points: [
      "Granular role-based access permissions",
      "Multi-tenant organization architecture",
      "Exportable compliance and audit trails",
    ],
    icon: (
      <svg className="h-6 w-6 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
];

export default function Benefits() {
  return (
    <section id="benefits" className="scroll-mt-20 bg-[#F4F6F8] py-20 sm:py-28 border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#245B85] border border-slate-200 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E6A23C]" />
            WHY ORGANIZATIONS CHOOSE VI-FLEET
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#142B45] leading-tight">
            Built for Operational Efficiency & Trust
          </h2>
          <p className="mt-3.5 text-base sm:text-lg leading-relaxed text-slate-600 font-normal">
            Engineered specifically to solve the core bottlenecks of organizational logistics with reliable, verifiable outcomes.
          </p>
        </div>

        {/* Benefits Cards Grid */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-7 shadow-xs transition-all duration-300 hover:border-[#245B85]/40 hover:shadow-xl hover:-translate-y-1"
            >
              <div>
                {/* Blue Icon Container with Amber Subtle Accent */}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F6F8] border border-slate-200 group-hover:bg-[#245B85]/10 group-hover:border-[#245B85]/30 transition-colors">
                  {b.icon}
                </div>

                <div className="mt-6">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#E6A23C]">
                    {b.tagline}
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-[#142B45] group-hover:text-[#245B85] transition-colors">
                    {b.title}
                  </h3>
                  <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600">
                    {b.desc}
                  </p>
                </div>
              </div>

              {/* Bullet list of proofs */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <ul className="space-y-2.5">
                  {b.points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#245B85]/10 text-[#245B85] text-[10px] font-bold">
                        ✓
                      </span>
                      <span className="leading-snug">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
