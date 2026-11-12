"use client";

import { useState } from "react";
import Link from "next/link";
import { useLoginModal } from "@/components/auth/login-modal-context";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("HOME");
  const [searchQuery, setSearchQuery] = useState("");
  const { openLogin } = useLoginModal();

  const primaryTabs = [
    { name: "HOMEPAGE", id: "HOME", href: "#" },
    { name: "OVERVIEW", id: "OVERVIEW", href: "#problem-value" },
    { name: "SERVICES", id: "SERVICES", href: "#features" },
    { name: "HOW IT WORKS", id: "HOW_IT_WORKS", href: "#how-it-works" },
    { name: "TESTIMONIALS", id: "TESTIMONIALS", href: "#testimonials" },
    { name: "FAQ", id: "FAQ", href: "#faq" },
  ];

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    if (query.includes("faq") || query.includes("question") || query.includes("help")) {
      window.location.hash = "faq";
    } else if (query.includes("work") || query.includes("step") || query.includes("how")) {
      window.location.hash = "how-it-works";
    } else if (query.includes("testimoni") || query.includes("review") || query.includes("trust")) {
      window.location.hash = "testimonials";
    } else if (query.includes("problem") || query.includes("value") || query.includes("why") || query.includes("fuel")) {
      window.location.hash = "problem-value";
    } else {
      window.location.hash = "features";
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full select-none shadow-xs">
      {/* ─────────────────────────────────────────────────────────────
          Top Navigation Bar (Styled with Hero Section Color Palette)
          ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-indigo-100/90 bg-[#f4f5fd]/95 shadow-2xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-1.5 sm:px-6 lg:px-8">
          {/* Brand Logo & Platform Title */}
          <Link href="/" className="group flex items-center gap-2 shrink-0 pr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs transition group-hover:bg-indigo-700">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900">
                VI-Fleet
              </span>
            </div>
          </Link>

          {/* Desktop Primary Tabs */}
          <nav className="hidden items-center md:flex self-stretch">
            {primaryTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <a
                  key={tab.id}
                  href={tab.href}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center px-3.5 py-2 text-[11px] font-bold tracking-wider transition ${
                    isActive
                      ? "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-xs"
                      : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60"
                  }`}
                >
                  <span>{tab.name}</span>
                  {/* Subtle vertical separator between non-active tabs */}
                  {!isActive && (
                    <span className="absolute right-0 top-1/2 h-3.5 w-px -translate-y-1/2 bg-indigo-100" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Right Section: Search Bar & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Integrated Search Input with Hero-Styled Indigo Button */}
            <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="TYPE YOUR SEARCH HERE"
                  aria-label="Search website"
                  className="w-48 lg:w-56 rounded-full border border-indigo-200/80 bg-white py-1 pl-3.5 pr-8 text-[10px] font-medium tracking-wide text-slate-800 placeholder:text-slate-400 placeholder:text-[9.5px] focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                />
                <button
                  type="submit"
                  aria-label="Execute search"
                  className="absolute right-0.5 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-xs transition hover:from-indigo-500 hover:to-indigo-600 active:scale-95 cursor-pointer"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Quick Sign In button (opens login popup) */}
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
            >
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>SIGN IN</span>
            </button>

            {/* Get Started Button */}
            <Link
              href="/register"
              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-95"
            >
              <span>REGISTER</span>
              <span aria-hidden="true">→</span>
            </Link>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md border border-indigo-200/80 p-1 text-slate-700 hover:bg-indigo-50 md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MOBILE EXPANDED DRAWER
          ───────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="border-b-2 border-indigo-600 bg-white shadow-xl md:hidden">
          {/* Mobile Search */}
          <div className="border-b border-indigo-50 p-3 bg-[#f8f9fe]">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="TYPE YOUR SEARCH HERE"
                className="w-full rounded-full border border-indigo-200 bg-white py-1.5 pl-3.5 pr-8 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="absolute right-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </form>
          </div>

          {/* Primary Tabs */}
          <div className="px-3 py-2">
            <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Main Menu
            </p>
            <nav className="flex flex-col gap-0.5">
              {primaryTabs.map((tab) => (
                <a
                  key={tab.id}
                  href={tab.href}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-bold ${
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                  }`}
                >
                  <span>{tab.name}</span>
                  <span className="text-[10px] opacity-70">→</span>
                </a>
              ))}
            </nav>
          </div>

          {/* Mobile Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 p-3 bg-[#f8f9fe]">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openLogin();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-indigo-50"
            >
              <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>SIGN IN</span>
            </button>

            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
            >
              REGISTER NOW
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
