"use client";

import { useState } from "react";
import Link from "next/link";
import { useLoginModal } from "@/components/auth/login-modal-context";

export default function Faq() {
  const { openLogin } = useLoginModal();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "What is VI-Fleet and which organizations can use it?",
      a: "VI-Fleet is an intelligent fleet logistics and management platform engineered for public agencies, universities, agricultural enterprises, and commercial logistics operators running fleets of 5 to 500+ vehicles. It unifies asset tracking, driver dispatch, fuel reconciliation, and preventive maintenance.",
    },
    {
      q: "How does the multi-role access control system work?",
      a: "VI-Fleet provides dedicated, secure interfaces for System Administrators, Organization Admins, Transport Managers, Department Staff, and Drivers. Each role only sees the features and data they have permission to access, maintaining complete organizational hierarchy and data privacy.",
    },
    {
      q: "Can our departments submit trip requisitions digitally without paper?",
      a: "Yes! Department users can submit online transport requests specifying departure dates, passenger lists, cargo details, and destinations. Transport managers receive instant notifications to review, approve, and assign an available vehicle and driver with a single click.",
    },
    {
      q: "How does VI-Fleet monitor fuel consumption and prevent leakage?",
      a: "Every trip records departure and return odometer readings alongside fuel expense receipts. The system automatically computes fuel efficiency (km/L) across trips and flags unusual consumption patterns, eliminating ghost fuel chits and unverified mileage.",
    },
    {
      q: "Can fleet records be exported for internal and regulatory audits?",
      a: "Absolutely. All trip histories, driver assignments, fuel purchases, and maintenance logs are exportable in CSV and PDF formats. They are pre-formatted to meet stringent governmental and financial compliance standards.",
    },
    {
      q: "How quickly can our organization get onboarded?",
      a: "Onboarding takes less than an hour. Once you register your organization, you can bulk import vehicle profiles, add certified drivers, set up department accounts, and begin digital trip dispatch immediately.",
    },
  ];

  function toggle(idx: number) {
    setOpenIndex(openIndex === idx ? null : idx);
  }

  return (
    <section id="faq" className="border-t border-slate-200/80 bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
            Got Questions?
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
            Find answers to common questions about implementing and using VI-Fleet across your fleet operations.
          </p>
        </div>

        {/* Accordion List */}
        <div className="mt-10 space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left cursor-pointer transition hover:bg-slate-50/50"
                  aria-expanded={isOpen}
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-900 pr-4">
                    {faq.q}
                  </span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-blue-50 group-hover:text-blue-600">
                    <svg
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-blue-600" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 pb-4 pt-3 text-xs sm:text-sm leading-relaxed text-slate-600 bg-slate-50/30">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Help CTA Box */}
        <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50/50 p-5 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Have a custom enterprise or ministry requirement?
            </h3>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">
              Our fleet solutions team can assist with on-premise deployments or custom integrations.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 sm:mt-0 sm:shrink-0">
            <button
              type="button"
              onClick={openLogin}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
            >
              Sign In
            </button>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
