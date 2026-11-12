"use client";

import Link from "next/link";
import { useLoginModal } from "@/components/auth/login-modal-context";

export default function Footer() {
  const { openLogin } = useLoginModal();

  return (
    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-xs">
                V
              </div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                VI-Fleet
              </span>
            </Link>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Fleet and vehicle intelligence system designed to optimize resources, maintenance, and mobility.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <a
              href="#problem-value"
              className="text-xs font-medium text-slate-600 transition hover:text-blue-600"
            >
              Overview
            </a>
            <a
              href="#features"
              className="text-xs font-medium text-slate-600 transition hover:text-blue-600"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-xs font-medium text-slate-600 transition hover:text-blue-600"
            >
              How It Works
            </a>
            <a
              href="#testimonials"
              className="text-xs font-medium text-slate-600 transition hover:text-blue-600"
            >
              Testimonials
            </a>
            <a
              href="#faq"
              className="text-xs font-medium text-slate-600 transition hover:text-blue-600"
            >
              FAQ
            </a>
            <button
              type="button"
              onClick={openLogin}
              className="text-xs font-medium text-slate-600 transition hover:text-blue-600 cursor-pointer"
            >
              Sign In
            </button>
            <Link
              href="/register"
              className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Register
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-150 pt-4 sm:flex-row">
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} VI-Fleet. All rights reserved.
          </p>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
