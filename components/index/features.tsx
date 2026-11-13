"use client";

const coreFeatures = [
  {
    number: "01",
    category: "FLEET ASSETS",
    title: "Vehicle Management",
    desc: "Maintain complete asset profiles, license documentation, odometer histories, and real-time assignment availability in a single secure registry.",
    highlight: "Full Lifecycle Visibility",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
  },
  {
    number: "02",
    category: "PERSONNEL",
    title: "Driver Management",
    desc: "Track certified driver profiles, commercial license categories, assigned vehicles, contact details, and duty availability with automated compliance.",
    highlight: "Driver Accountability",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    number: "03",
    category: "OPERATIONS",
    title: "Trip Scheduling",
    desc: "Plan and coordinate transport schedules, passenger manifests, departure timetables, and multi-point stops without double-booking or confusion.",
    highlight: "Automated Coordination",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    number: "04",
    category: "TELEMATICS",
    title: "Live Vehicle Tracking",
    desc: "Gain real-time visibility into active trips, route milestones, checkpoint timestamps, and return confirmations for uninterrupted operational awareness.",
    highlight: "Real-Time Telematics",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    number: "05",
    category: "PREVENTIVE CARE",
    title: "Maintenance Management",
    desc: "Log servicing events, configure odometer-based maintenance thresholds, track workshop repairs, and prevent costly roadside breakdowns.",
    highlight: "Preventive Care",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    number: "06",
    category: "REQUISITIONS",
    title: "Transportation Request Management",
    desc: "Empower departmental staff to submit trip requests digitally with approval workflows, vehicle matching, passenger limits, and instant status updates.",
    highlight: "Paperless Approvals",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-16 sm:py-24 border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#F4F6F8] px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#245B85] border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E6A23C]" />
            Core Enterprise Features
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#142B45]">
            Built for Modern Transportation Fleets
          </h2>
          <p className="mt-3.5 text-base sm:text-lg leading-relaxed text-slate-600">
            Engineered to streamline end-to-end transport operations, eliminate administrative friction,
            and ensure total operational transparency.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((item) => (
            <article
              key={item.number}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-[#F4F6F8]/60 p-7 transition-all duration-300 hover:border-[#245B85]/50 hover:bg-white hover:shadow-xl hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between">
                  {/* Blue Icon Container */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#245B85] shadow-md shadow-[#245B85]/20 group-hover:scale-105 transition-transform">
                    {item.icon}
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-400">
                    {item.number}
                  </span>
                </div>

                <div className="mt-6">
                  {/* Small Amber Category Label */}
                  <span className="inline-block text-[11px] font-bold text-[#E6A23C] uppercase tracking-wider">
                    {item.category}
                  </span>
                  {/* Navy Heading */}
                  <h3 className="mt-1 text-xl font-bold text-[#142B45] group-hover:text-[#245B85] transition-colors">
                    {item.title}
                  </h3>
                  {/* Clear Description */}
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {item.desc}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-[#245B85]">
                <span>{item.highlight}</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
