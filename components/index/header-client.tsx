"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

type HeaderUser = {
  name?: string | null;
  role?: string;
};

export default function HeaderClient({ user }: { user?: HeaderUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/" });
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white shadow-xs">
            V
          </div>
          <div>
            <span className="block text-xl font-bold tracking-tight text-gray-900">
              VI-Fleet
            </span>
            <span className="text-xs text-gray-500">
              Vehicle Management System
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Main navigation"
        >
          <a
            href="#features"
            className="text-sm font-medium text-gray-600 transition hover:text-blue-700"
          >
            Features
          </a>
          <a
            href="#about"
            className="text-sm font-medium text-gray-600 transition hover:text-blue-700"
          >
            About
          </a>
        </nav>

        {/* Desktop Auth CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800">
                <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                <span>{user.name || "Signed in"}</span>
              </div>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                <span>Dashboard</span>
                <span aria-hidden="true">→</span>
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                <span>Get Started</span>
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex items-center gap-2 md:hidden">
          {user && (
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Dashboard
            </Link>
          )}

          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <span className="text-xl leading-none" aria-hidden="true">
              ☰
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs transition-opacity"
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-gray-100 px-5">
              <span className="text-base font-bold text-gray-900">
                Menu
              </span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={closeMobile}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  ✕
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              <nav className="space-y-3" aria-label="Mobile navigation links">
                <a
                  href="#features"
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                >
                  Features
                </a>
                <a
                  href="#about"
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                >
                  About
                </a>
              </nav>

              <div className="mt-8 border-t border-gray-100 pt-6">
                {user ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-xs font-semibold text-blue-700">
                        Signed in
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                        {user.name || "VI-Fleet user"}
                      </p>
                      {user.role && (
                        <p className="text-xs text-gray-500">
                          {user.role.replaceAll("_", " ")}
                        </p>
                      )}
                    </div>

                    <Link
                      href="/dashboard"
                      onClick={closeMobile}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-blue-800"
                    >
                      <span>Go to Dashboard</span>
                      <span aria-hidden="true">→</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        closeMobile();
                        handleSignOut();
                      }}
                      disabled={signingOut}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                    >
                      <span>↪</span>
                      <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Link
                      href="/login"
                      onClick={closeMobile}
                      className="block w-full rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/register"
                      onClick={closeMobile}
                      className="block w-full rounded-lg bg-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Get Started →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
