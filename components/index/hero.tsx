"use client";

import Image from "next/image";
import Link from "next/link";
import { useLoginModal } from "@/components/auth/login-modal-context";

export default function Hero() {
  const { openLogin } = useLoginModal();

  return (
    <section id="hero" className="scroll-mt-20 relative overflow-hidden bg-[#142B45] text-white">
      {/* Background Graphic & Highway Imagery */}
      <div className="absolute inset-0 z-0">
        {/* Subtle highway glow gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#142B45] via-[#142B45]/90 to-transparent lg:w-3/5 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#142B45] via-transparent to-transparent z-10" />
        <div className="relative h-full w-full">
          <Image
            src="/hero-image.jpg"
            alt="VI-Fleet Commercial Fleet Operations"
            fill
            className="object-cover object-right-top lg:object-center opacity-75 lg:opacity-90"
            priority
          />
        </div>
      </div>

      {/* Decorative highway curve vector lines */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full overflow-hidden opacity-15 z-10">
        <svg
          className="absolute -left-1/4 top-0 h-full w-[150%] text-white"
          viewBox="0 0 1000 600"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M-50,600 C300,550 500,300 700,0"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
          <path
            d="M-20,600 C330,550 530,300 730,0"
            stroke="#E6A23C"
            strokeWidth="4"
          />
          <path
            d="M10,600 C360,550 560,300 760,0"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Content Container */}
      <div className="relative z-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="max-w-2xl lg:max-w-xl">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 rounded-full bg-[#142B45]/80 border border-[#E6A23C]/40 px-3.5 py-1 text-xs font-bold tracking-widest text-[#E6A23C] backdrop-blur-md shadow-xs">
            <span>SMARTER FLEET. GREATER EFFICIENCY.</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
            VI-Fleet
            <br />
            Fleet Management
            <br />
            <span className="text-[#E6A23C]">Made Simple</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-200 font-normal">
            Manage your vehicles, drivers, and transportation operations with confidence.
          </p>

          {/* Calls to Action */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#platform"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E6A23C] hover:bg-[#d9942d] px-6 py-3.5 text-sm font-bold text-[#142B45] shadow-lg shadow-[#E6A23C]/20 transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E6A23C]"
            >
              <span>Explore the Platform</span>
              <span aria-hidden="true">→</span>
            </a>

            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 hover:bg-white/20 backdrop-blur-xs px-5 py-3.5 text-sm font-semibold text-white transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              <span>Sign In</span>
            </button>
          </div>

          {/* Key Metrics / Highlights Strip */}
          <div className="mt-12 pt-6 border-t border-white/15 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xl sm:text-2xl font-black text-[#E6A23C]">100%</p>
              <p className="text-xs text-slate-300 font-medium">Digital Dispatch</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-white">Real-Time</p>
              <p className="text-xs text-slate-300 font-medium">Trip Tracking</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-white">Zero</p>
              <p className="text-xs text-slate-300 font-medium">Booking Conflicts</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
