export default function Testimonials() {
  const reviews = [
    {
      quote:
        "Before VI-Fleet, managing 65 vehicles across regional delivery routes meant endless phone calls and lost paper chits. Our dispatch turnaround dropped to 5 minutes, and fuel discrepancies dropped by 28% in the first quarter.",
      author: "Abebe Wolde",
      role: "Head of Fleet Operations",
      organization: "Horizon Logistics Group",
      metric: "28% Fuel Cost Reduction",
      initials: "AW",
      avatarBg: "bg-blue-600",
    },
    {
      quote:
        "With 40 campus shuttles and staff transport vans, double-booking was our daily headache. VI-Fleet's department approval workflow brought complete peace of mind. Every department gets fair allocation with zero conflict.",
      author: "Dr. Bethlehem Girma",
      role: "Director of General Services",
      organization: "Rift Valley Academic Center",
      metric: "Zero Booking Clashes",
      initials: "BG",
      avatarBg: "bg-emerald-600",
    },
    {
      quote:
        "The automated service alerts based on odometer tracking saved our fleet from catastrophic engine breakdowns twice this year. The audit logs made regulatory transport compliance effortless.",
      author: "Yosef Tamerat",
      role: "Senior Fleet Maintenance Supervisor",
      organization: "Addis Bulk Transporters",
      metric: "99.4% Fleet Availability",
      initials: "YT",
      avatarBg: "bg-purple-600",
    },
  ];

  return (
    <section id="testimonials" className="border-t border-slate-200/80 bg-slate-50/70 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
            Social Proof & Trust
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Trusted by organizations driving real impact
          </h2>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
            See how operations managers and transport supervisors achieve efficiency and cost discipline with VI-Fleet.
          </p>
        </div>

        {/* Testimonials Cards Grid */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {reviews.map((r, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-slate-300 hover:shadow-md"
            >
              <div>
                {/* 5-Star Rating & Metric */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>

                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    {r.metric}
                  </span>
                </div>

                {/* Quote */}
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-700 italic">
                  &ldquo;{r.quote}&rdquo;
                </p>
              </div>

              {/* Author Info */}
              <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs ${r.avatarBg}`}>
                  {r.initials}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{r.author}</h3>
                  <p className="text-[11px] text-slate-500">{r.role}</p>
                  <p className="text-[10px] font-medium text-blue-600">{r.organization}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Organizational Sector Trust Bar */}
        <div className="mt-12 rounded-xl border border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-around gap-4 text-center text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
              Public Universities & Colleges
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
              Agricultural & Logistics Transporters
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
              Government Ministries & Agencies
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
              Private Commercial Fleets
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
