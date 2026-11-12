"use client";

import Link from "next/link";
import { useLoginModal } from "@/components/auth/login-modal-context";

export default function RegisterBanner() {
  const { openLogin } = useLoginModal();

  return (
    <section id="about" className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-2xl bg-slate-900 px-6 py-10 shadow-sm sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-400/20">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
              Enterprise Ready
            </span>

            <h2 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight text-white">
              Ready to modernize your fleet operations?
            </h2>

            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Empower your fleet supervisors, drivers, and department managers with a single unified platform. Register your organization to begin onboarding.
            </p>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Fast Organization Verification</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Role-Based Access Controls</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Audit-Ready Logs</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 lg:mt-0 lg:shrink-0">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-95"
            >
              <span>Register Organization</span>
              <span aria-hidden="true">→</span>
            </Link>

            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
