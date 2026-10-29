"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type DashboardNavItem = {
  label: string;
  href?: string;
  icon?: string;
};

export type DashboardSidebarProps = {
  brand: string;
  brandHref?: string;
  navigation: DashboardNavItem[];
  userName?: string;
  roleLabel?: string;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onSignOut?: () => void;
  signingOut?: boolean;
};

function getWorkspaceRoot(brand: string, brandHref?: string): string {
  if (brandHref) return brandHref;
  const lower = brand.toLowerCase();
  if (lower.includes("org")) return "/organization";
  if (lower.includes("transport")) return "/transport";
  if (lower.includes("dept") || lower.includes("department")) return "/department";
  if (lower.includes("driver")) return "/driver";
  if (lower.includes("admin")) return "/admin";
  return "/dashboard";
}

function isItemActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  // Top-level workspace landing paths match exactly
  if (["/admin", "/organization", "/transport", "/department", "/driver"].includes(href)) {
    return pathname === href;
  }
  // Sub-routes match exact or prefix
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardSidebar({
  brand,
  brandHref,
  navigation,
  userName = "User",
  roleLabel,
  mobileOpen = false,
  onCloseMobile,
  onSignOut,
  signingOut = false,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [internalSigningOut, setInternalSigningOut] = useState(false);

  const rootHref = getWorkspaceRoot(brand, brandHref);
  const isSignOutPending = signingOut || internalSigningOut;

  async function handleSignOut() {
    if (onSignOut) {
      onSignOut();
      return;
    }
    setInternalSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  const renderNavItems = (onItemClick?: () => void) => (
    <nav className="space-y-1" aria-label={`${brand} workspace navigation`}>
      {navigation.map((item) => {
        const active = isItemActive(pathname, item.href);

        const className = `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition min-h-[40px] ${
          active
            ? "bg-blue-50 text-blue-700 font-semibold"
            : item.href
              ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              : "cursor-not-allowed text-slate-400"
        }`;

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            onClick={onItemClick}
            className={className}
            aria-current={active ? "page" : undefined}
          >
            <span className="truncate">{item.label}</span>
            {active && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
                aria-hidden="true"
              />
            )}
          </Link>
        ) : (
          <div
            key={item.label}
            className={className}
            title="This section is coming soon"
          >
            <span className="truncate">{item.label}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Soon
            </span>
          </div>
        );
      })}
    </nav>
  );

  const renderUserSection = () => (
    <div className="border-t border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"
          aria-hidden="true"
        >
          {userName.trim().charAt(0).toUpperCase() || "U"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-900">
            {userName}
          </p>
          {roleLabel && (
            <p className="truncate text-[11px] text-slate-500">{roleLabel}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSignOutPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60 min-h-[36px]"
      >
        <span aria-hidden="true">↪</span>
        <span>{isSignOutPending ? "Signing out..." : "Sign out"}</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (visible on md and up) */}
      <aside
        className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex"
        aria-label={`${brand} workspace sidebar`}
      >
        <div className="flex h-20 items-center border-b border-slate-200 px-6">
          <Link
            href={rootHref}
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-900 transition hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              V
            </div>
            <span>
              VI-<span className="text-blue-600">Fleet</span>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {brand} workspace
          </p>
          {renderNavItems()}
        </div>

        {renderUserSection()}
      </aside>

      {/* Mobile Slide-Over Drawer (visible on < md when mobileOpen is true) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`${brand} mobile navigation`}
        >
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <Link
                href={rootHref}
                onClick={onCloseMobile}
                className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
                  V
                </div>
                <span>
                  VI-<span className="text-blue-600">Fleet</span>
                </span>
              </Link>

              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  ✕
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {brand} workspace
              </p>
              {renderNavItems(onCloseMobile)}
            </div>

            {renderUserSection()}
          </aside>
        </div>
      )}
    </>
  );
}
