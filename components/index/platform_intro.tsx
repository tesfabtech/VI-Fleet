
"use client";

import Image from "next/image";

const showcaseFeatures = [
  {
    title: "Vehicle Management",
    icon: (
      <svg className="h-5 w-5 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
  },
  {
    title: "Driver Management",
    icon: (
      <svg className="h-5 w-5 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "Trip Scheduling",
    icon: (
      <svg className="h-5 w-5 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Live Vehicle Tracking",
    icon: (
      <svg className="h-5 w-5 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Maintenance Management",
    icon: (
      <svg className="h-5 w-5 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Transportation Requests",
    icon: (
      <svg className="h-5 w-5 text-[#245B85]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function PlatformIntro() {
  return (
    <section
      id="platform"
      className="scroll-mt-20 relative overflow-hidden border-b border-slate-200/80 bg-[#F4F6F8] py-16 sm:py-24"
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">

        {/* Large Dashboard Image */}
        <div className="mt-4 flex w-full justify-center">
          <div className="w-full max-w-[1440px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-[#142B45]/10 sm:p-3">
            <Image
              src="/dashboard.jpg"
              alt="VI-Fleet Centralized Fleet Management Dashboard"
              width={2140}
              height={938}
              priority
              sizes="(max-width: 768px) 100vw, 1440px"
              className="block h-auto w-full object-contain"
            />
          </div>
        </div>

{/* Six Compact Feature Cards */}
<div className="mx-auto mt-10 grid w-full max-w-[1500px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
  {showcaseFeatures.map((item) => (
    <div
      key={item.title}
      className="group flex min-h-[68px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm transition-all duration-200 hover:border-[#245B85]/40 hover:shadow-md"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F6F8] transition-colors group-hover:bg-[#245B85]/10">
        {item.icon}
      </div>

      <h3 className="text-left text-xs font-semibold leading-tight text-[#142B45] transition-colors group-hover:text-[#245B85]">
        {item.title}
      </h3>
    </div>
  ))}
</div>

        {/* Discover Features Button */}
        <div className="mt-12 text-center">
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl bg-[#142B45] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-[#142B45]/15 transition-all hover:bg-[#245B85] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245B85]"
          >
            <span>Discover Features</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>

      </div>
    </section>
  );
}
