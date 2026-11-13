"use client";

import Link from "next/link";

export default function RegisterBanner() {
  return (
    <section className="bg-white dark:bg-[#0b1120] py-16 sm:py-24 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-3xl bg-[#142B45] px-8 py-14 sm:px-16 sm:py-20 shadow-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
          {/* Subtle Road-Inspired Decorative Graphics */}
          <div className="pointer-events-none absolute -left-12 -bottom-10 -top-10 w-96 opacity-30 overflow-hidden">
            <svg
              className="h-full w-full"
              viewBox="0 0 350 250"
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                d="M-30,250 C90,220 160,100 230,0"
                stroke="white"
                strokeWidth="2.5"
                strokeDasharray="8 8"
              />
              <path
                d="M-10,250 C110,220 180,100 250,0"
                stroke="#E6A23C"
                strokeWidth="4"
              />
              <path
                d="M10,250 C130,220 200,100 270,0"
                stroke="white"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* Banner Text Content */}
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#E6A23C] border border-white/15">
              TRANSFORM YOUR OPERATIONS
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Ready to Transform Your Fleet Operations?
            </h2>

            <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              Join organizations that trust VI-Fleet for reliable, auditable, and efficient transportation management.
            </p>
          </div>

          {/* Prominent Amber Primary Button */}
          <div className="relative z-10 shrink-0">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E6A23C] hover:bg-[#d9942d] px-8 py-4 text-base font-bold text-[#142B45] shadow-xl shadow-[#E6A23C]/25 transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>Get Started Today</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
