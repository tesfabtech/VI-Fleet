"use client";

import Image from "next/image";
import Link from "next/link";
import { useLoginModal } from "@/components/auth/login-modal-context";

export default function Hero() {
  const { openLogin } = useLoginModal();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#f4f5fd] via-[#f7f8fe] to-[#eceffd] pb-16 pt-10 sm:pb-24 sm:pt-16 lg:pb-28 lg:pt-20">
      {/* Soft Ambient Light Glows */}
      <div
        className="pointer-events-none absolute -top-24 left-1/4 -z-10 h-96 w-96 rounded-full bg-indigo-300/20 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 right-10 -z-10 h-96 w-[28rem] rounded-full bg-purple-300/25 blur-[130px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 -z-10 h-80 w-[32rem] rounded-full bg-blue-200/25 blur-[110px]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ─────────────────────────────────────────────────────────────
              LEFT COLUMN: Your Content In Modern 3D SaaS Hero Style
              ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-6 xl:col-span-6 text-left">
            {/* Pill Badge: Intelligent Fleet Logistics Platform */}
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-3.5 py-1 text-xs font-semibold text-indigo-700 shadow-2xs backdrop-blur-xs">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white font-bold">
                ✓
              </span>
              <span>Intelligent Fleet Logistics Platform</span>
            </div>

            {/* Main Headline: A better way to manage your fleet */}
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] xl:text-[3.6rem] lg:leading-[1.14]">
              A better way to{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 bg-clip-text text-transparent">
                manage your fleet
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-5 text-sm sm:text-base leading-relaxed text-slate-600 max-w-lg">
              Centralize vehicles, drivers, trip requests, and maintenance schedules
              into one connected workspace built for organizations.
            </p>

            {/* CTA Buttons Row */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-95"
              >
                <span>Get Started</span>
                <span aria-hidden="true">→</span>
              </Link>

              <button
                type="button"
                onClick={openLogin}
                className="group inline-flex items-center gap-3 rounded-xl py-2 px-1 text-xs sm:text-sm font-semibold text-slate-700 hover:text-indigo-600 transition cursor-pointer"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md text-indigo-600 transition group-hover:scale-105 group-hover:shadow-lg">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </span>
                <span>Sign In</span>
              </button>
            </div>

            {/* Trust Highlights Strip */}
            <div className="mt-10 pt-6 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                    ✓
                  </span>
                  <span>Multi-Tenant Access</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                    ✓
                  </span>
                  <span>Automated Maintenance Alerts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                    ✓
                  </span>
                  <span>Role-Based Permissions</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              RIGHT COLUMN: 3D Floating Mockup Device & Layered Cards
              ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-6 xl:col-span-6 relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-lg lg:max-w-xl">
              {/* 3D Floating Tablet Device */}
              <div className="relative rounded-[2.25rem] border border-white/90 bg-white/95 p-3.5 sm:p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)] ring-1 ring-slate-900/5 backdrop-blur-sm transition-transform hover:-translate-y-1 duration-300">
                {/* Tablet Top Navigation Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white text-[10px] font-bold">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-900">VI-Fleet</span>
                  </div>
                </div>

                {/* Tablet Internal Screen Content */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Internal Left: Content */}
                  <div className="sm:col-span-6 text-left">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-700 border border-indigo-200">
                      Fleet Logistics
                    </span>
                    <h3 className="mt-2 text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                      Intelligent fleet control in the{" "}
                      <span className="text-indigo-600">digital age.</span>
                    </h3>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                      Real-time telematics, automated requisition approvals, and preventive maintenance.
                    </p>
                    <button
                      type="button"
                      onClick={openLogin}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                    >
                      <span>Operations Center</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>

                  {/* Internal Right: Fleet Connected Vehicles Visual */}
                  <div className="sm:col-span-6 relative overflow-hidden rounded-2xl shadow-md border border-slate-200/80 bg-slate-900 aspect-[16/10] flex items-center justify-center group">
                    <Image
                      src="/hero-buses.jpg"
                      alt="VI-Fleet Connected Fleet Vehicles"
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 320px"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
