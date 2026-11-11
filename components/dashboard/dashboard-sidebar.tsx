"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export type DashboardNavItem = {
  label: string;
  href?: string;
  icon?: ReactNode;
};

type DashboardSidebarProps = {
  brand: string;
  userName?: string;
  roleLabel?: string;
  navigation: DashboardNavItem[];
};

function getDefaultNavIcon(label: string): ReactNode {
  const normalized = label.trim().toLowerCase();

  switch (normalized) {
    case "overview":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );

    case "departments":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M2 21h20M9 7h2M9 11h2M9 15h2M16 11h2M16 15h2" />
        </svg>
      );

    case "department users":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 20v-1.5a5.5 5.5 0 0111 0V20M16 6.5a3 3 0 010 6M18 15a4.5 4.5 0 013 3.5V20" />
        </svg>
      );

    case "registration links":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      );

    case "transport managers":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );

    case "settings":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      );

    case "fleet":
    case "vehicles":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M3 13l2-6h14l2 6v6h-2v-2H5v2H3v-6z" />
          <path d="M5 13h14M7 17h.01M17 17h.01" />
        </svg>
      );

    case "drivers":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 3v6.5M12 14.5V21M3.5 10l6.5 2M14 12l6.5-2" />
        </svg>
      );

    case "trips":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );

    case "maintenance":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.9 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      );

    case "fuel records":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M3 22h12M4 9h10M4 5a2 2 0 012-2h6a2 2 0 012 2v17H4V5zM14 8h2a2 2 0 012 2v3a2 2 0 002 2h1a1 1 0 001-1V9a2 2 0 00-2-2h-1M9 13v3" />
        </svg>
      );

    case "reports":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M18 20V10M12 20V4M6 20v-6M4 20h16" />
        </svg>
      );

    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
  }
}

export default function DashboardSidebar({
  brand,
  userName = "User",
  roleLabel = "Workspace member",
  navigation,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const rootHref = brand === "Organization" ? "/organization" : "/transport";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  return (
    <>
      <aside className="hidden md:flex md:h-full md:w-64 md:shrink-0 md:flex-col md:overflow-hidden border-r border-slate-200 bg-white">
        {/* Stationary Top Brand Header */}
        <div className="flex h-20 shrink-0 items-center gap-3 border-b border-slate-200 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-base font-bold text-white">
            V
          </div>
          <Link
            href={rootHref}
            className="text-xl font-bold tracking-tight text-slate-900"
          >
            VI-<span className="text-blue-600">Fleet</span>
          </Link>
        </div>

        {/* Independently Scrollable Navigation Section */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {brand} workspace
          </p>

          <nav
            aria-label={`${brand} workspace navigation`}
            className="space-y-1"
          >
            {navigation.map((item) => {
              const icon = item.icon ?? getDefaultNavIcon(item.label);
              const active =
                item.href !== undefined &&
                (pathname === item.href ||
                  (item.href !== "/organization" &&
                    item.href !== "/transport" &&
                    pathname.startsWith(`${item.href}/`)));

              const className = `group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : item.href
                    ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    : "cursor-not-allowed text-slate-400"
              }`;

              return item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className={className}
                  aria-current={active ? "page" : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 transition ${
                        active
                          ? "text-blue-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }`}
                      aria-hidden="true"
                    >
                      {icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {active && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  )}
                </Link>
              ) : (
                <div
                  key={item.label}
                  className={className}
                  title="This section is not available yet"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="shrink-0 text-slate-300"
                      aria-hidden="true"
                    >
                      {icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                    Soon
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Stationary Sidebar Bottom Account & Sign-Out Box */}
        <div className="mt-auto shrink-0 border-t border-slate-200 p-4 space-y-2 bg-white">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="truncate text-xs font-semibold text-slate-900">
              {userName}
            </p>
            <p className="truncate text-[11px] text-slate-500">{roleLabel}</p>
          </div>

          <button
            type="button"
            disabled={signingOut}
            onClick={handleSignOut}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            <span aria-hidden="true">↪</span>
          </button>
        </div>
      </aside>

      {/* Mobile Horizontal Navigation Bar */}
      <nav
        aria-label={`${brand} mobile navigation`}
        className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 md:hidden"
      >
        {navigation.map((item) => {
          const icon = item.icon ?? getDefaultNavIcon(item.label);
          const active =
            item.href !== undefined &&
            (pathname === item.href ||
              (item.href !== "/organization" &&
                item.href !== "/transport" &&
                pathname.startsWith(`${item.href}/`)));

          const className = `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            active
              ? "bg-blue-50 text-blue-700"
              : item.href
                ? "text-slate-600"
                : "text-slate-400"
          }`;

          return item.href ? (
            <Link key={item.label} href={item.href} className={className}>
              <span
                className={`shrink-0 ${
                  active ? "text-blue-600" : "text-slate-400"
                }`}
                aria-hidden="true"
              >
                {icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ) : (
            <span key={item.label} className={className}>
              <span className="shrink-0 text-slate-300" aria-hidden="true">
                {icon}
              </span>
              <span>{item.label}</span>
            </span>
          );
        })}
      </nav>
    </>
  );
}
