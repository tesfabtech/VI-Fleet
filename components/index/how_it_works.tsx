"use client";

const workflowSteps = [
  {
    step: 1,
    title: "Submit a Request",
    desc: "Department staff submit transport requisitions online with passenger counts, itineraries, departure times, and cargo needs.",
    icon: (
      <svg className="h-6 w-6 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    step: 2,
    title: "Plan and Assign",
    desc: "Transport managers approve pending requisitions, schedule trips, and assign certified drivers and appropriate vehicles with zero conflicts.",
    icon: (
      <svg className="h-6 w-6 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    step: 3,
    title: "Track and Complete",
    desc: "Monitor live trip progress, record completion checkpoints, log odometer readings, and reconcile fuel records seamlessly.",
    icon: (
      <svg className="h-6 w-6 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 relative bg-[#142B45] py-20 sm:py-28 overflow-hidden text-white border-b border-slate-800">
      {/* Subtle road background curves */}
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <svg className="h-full w-full" viewBox="0 0 1200 600" fill="none" preserveAspectRatio="none">
          <path d="M0 300 Q 300 150, 600 300 T 1200 300" stroke="#E6A23C" strokeWidth="3" strokeDasharray="10 10" />
          <path d="M0 340 Q 300 190, 600 340 T 1200 340" stroke="white" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-[#E6A23C] border border-white/15 backdrop-blur-xs">
            HOW VI-FLEET WORKS
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            From Request to Delivery — Seamlessly
          </h2>
          <p className="mt-3.5 text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            A cohesive three-step operating workflow designed to replace fragmented logs with automated logistics excellence.
          </p>
        </div>

        {/* 3 Connected Steps Grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3 relative">
          {workflowSteps.map((step, idx) => (
            <div key={step.step} className="relative flex flex-col">
              {/* White Card */}
              <div className="relative z-10 flex flex-1 flex-col justify-between rounded-2xl bg-white p-8 text-[#142B45] shadow-2xl transition-transform duration-300 hover:-translate-y-1">
                <div>
                  {/* Step Header with Amber Badge & Blue Icon */}
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F6F8] border border-slate-200">
                      {step.icon}
                    </div>

                    {/* Amber Numbered Indicator */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E6A23C] text-sm font-black text-[#142B45] shadow-md">
                      0{step.step}
                    </div>
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-[#142B45]">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-[#245B85]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E6A23C]" />
                  <span>Step {step.step} of 3</span>
                </div>
              </div>

              {/* Horizontal Connecting Arrow/Line for Desktop (between cards 1-2 and 2-3) */}
              {idx < 2 && (
                <div
                  aria-hidden="true"
                  className="hidden md:flex absolute top-1/2 -right-4 z-20 -translate-y-1/2 items-center justify-center h-8 w-8 rounded-full bg-[#E6A23C] text-[#142B45] shadow-md"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
