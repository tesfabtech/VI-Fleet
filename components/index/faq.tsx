
"use client";

import { useState } from "react";
import Image from "next/image";
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
      a: "Absolutely. All trip histories, driver assignments, fuel purchases, and maintenance logs are exportable in standard formats. They are pre-formatted to meet stringent governmental and financial compliance standards.",
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
    <section
      id="faq"
      className="scroll-mt-20 border-b border-slate-200/80 bg-white py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-20">

       {/* Left: Sticky Image — Desktop Only */}
<div className="relative hidden lg:block lg:self-stretch">
  <div className="sticky top-[11vh] h-[87vh] min-h-[400px] max-h-[760px] overflow-hidden rounded-2xl">
    <Image
      src="/faq-fleet.jpg"
      alt="Organizational fleet vehicles"
      fill
      sizes="(max-width: 1024px) 100vw, 50vw"
      className="object-cover"
    />

    {/* Image Overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-[#142B45]/90 via-[#142B45]/25 to-transparent" />

    {/* VI-Fleet Logo — Top Right */}
    <div className="absolute right-5 top-5 z-10 flex items-center gap-2 rounded-lg  px-1 py-1 shadow-lg backdrop-blur-sm">
      <div className="relative flex h-8 w-10 items-center justify-center overflow-hidden rounded-md">
        <Image
          src="/logo_no_bg.jfif"
          alt="VI-Fleet Logo"
          width={46}
          height={30}
          className="h-8 w-auto object-contain"
          priority
        />
      </div>

      <span className="text-xl font-black tracking-tight text-[#142B45]">
        VI-Fleet
      </span>
    </div>
  </div>
</div>

          {/* Right: FAQ Content — Natural Page Scrolling */}
          <div className="min-w-0">

            {/* Section Heading */}
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#F4F6F8] px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#245B85]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E6A23C]" />
                FAQ
              </span>

              <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight text-[#142B45] sm:text-3xl">
                Clear Answers. Better Fleet Management.
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Explore common questions about implementing and running
                VI-Fleet across your organization.
              </p>
            </div>

            {/* FAQ Accordion */}
            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openIndex === idx;

                return (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 hover:border-[#245B85]/40"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(idx)}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50/70 sm:px-6"
                      aria-expanded={isOpen}
                    >
                      <span className="pr-2 text-sm font-bold leading-relaxed text-[#142B45] sm:text-base">
                        {faq.q}
                      </span>

                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F6F8] text-[#245B85]">
                        <svg
                          className={`h-4 w-4 transition-transform duration-200 ${
                            isOpen ? "rotate-180 text-[#E6A23C]" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-[#F4F6F8]/60 px-5 pb-5 pt-4 text-sm leading-relaxed text-slate-600 sm:px-6 sm:text-[15px]">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Enterprise Support */}
            <div className="mt-8 rounded-xl border border-slate-200 bg-[#F4F6F8] p-5 sm:p-6">
              <h3 className="text-base font-bold text-[#142B45]">
                Have a custom enterprise deployment requirement?
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Our solutions team assists with enterprise onboarding, driver
                training, and customized fleet configurations.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={openLogin}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#142B45] shadow-sm transition hover:bg-slate-50"
                >
                  Sign In
                </button>

                <Link
                  href="/register"
                  className="rounded-lg bg-[#E6A23C] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d9942d]"
                >
                  Get Started
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
