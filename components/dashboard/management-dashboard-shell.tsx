"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import DashboardSidebar, {
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-sidebar";

type ManagementDashboardShellProps = {
  brand: string;
  brandHref?: string;
  roleLabel: string;
  userName: string;
  navigation: DashboardNavItem[];
  children: ReactNode;
};

export default function ManagementDashboardShell({
  brand,
  brandHref,
  roleLabel,
  userName,
  navigation,
  children,
}: ManagementDashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  const rootHref =
    brandHref ??
    (brand.toLowerCase().includes("org")
      ? "/organization"
      : brand.toLowerCase().includes("transport")
        ? "/transport"
        : brand.toLowerCase().includes("dept")
          ? "/department"
          : brand.toLowerCase().includes("driver")
            ? "/driver"
            : "/dashboard");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      {/* Sidebar (Desktop permanent, Mobile slide-over drawer) */}
      <DashboardSidebar
        brand={brand}
        brandHref={rootHref}
        navigation={navigation}
        userName={userName}
        roleLabel={roleLabel}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2.5 sm:min-h-20 sm:px-6 lg:px-8">
            {/* Left: Hamburger button (mobile) and Workspace indicator */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  ☰
                </span>
              </button>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {brand} dashboard
                </p>
                <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                  Welcome back
                </h1>
              </div>
            </div>

            {/* Right: Quick actions, User status, Sign out */}
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/"
                className="hidden rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 sm:inline-block"
              >
                View website
              </Link>

              <div className="hidden text-right sm:block">
                <p className="max-w-44 truncate text-sm font-semibold text-slate-900">
                  {userName}
                </p>
                <p className="text-xs text-slate-500">{roleLabel}</p>
              </div>

              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"
                aria-hidden="true"
                title={`${userName} (${roleLabel})`}
              >
                {userName.trim().charAt(0).toUpperCase() || "U"}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                title="Sign out"
                className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60 md:inline-flex"
              >
                <span aria-hidden="true">↪</span>
                <span>{signingOut ? "Signing out..." : "Sign out"}</span>
              </button>
            </div>
          </div>

          {/* Mobile subheader displaying user info */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 sm:hidden">
            <p className="truncate text-xs text-slate-600">
              {userName} · <span className="text-blue-700">{roleLabel}</span>
            </p>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="text-xs font-medium text-slate-600 hover:text-red-700 disabled:opacity-60"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
