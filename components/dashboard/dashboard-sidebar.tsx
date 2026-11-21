"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type DashboardNavItem = {
  label: string;
  href?: string;
  icon?: ReactNode;
};

export type DashboardSidebarProps = {
  brand: string;
  userName?: string;
  roleLabel?: string;
  navigation: DashboardNavItem[];
  homeHref?: string;
  brandSubtitle?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
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
          strokeWidth="1.8"
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

    case "organization applications":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );

    case "organizations":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M6 11h2M10 11h2M6 15h2M10 15h2M16 11h2M16 15h2" />
        </svg>
      );

    case "user management":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      );

    case "departments":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );

    case "transport requests":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      );

    case "new request":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );

    case "recycle bin":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      );

    case "settings":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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

function isRouteActive(pathname: string, href?: string): boolean {
  if (!href) return false;

  const rootRoutes = [
    "/organization",
    "/transport",
    "/department",
    "/admin",
  ];

  if (rootRoutes.includes(href)) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardSidebar({
  brand,
  userName = "User",
  roleLabel = "Workspace member",
  navigation,
  homeHref,
  brandSubtitle,
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  // Dynamic Home Route Determination
  const resolvedHomeHref =
    homeHref ||
    navigation.find((item) => item.label.toLowerCase() === "overview")?.href ||
    navigation.find((item) => item.href)?.href ||
    (brand === "Organization"
      ? "/organization"
      : brand === "Department"
        ? "/department"
        : brand === "Transport"
          ? "/transport"
          : brand === "Administration" || brand === "System Administrator"
            ? "/admin"
            : "/");

  // Handle Escape key and body scroll lock for mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onMobileClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen, onMobileClose]);

  // Close drawer on pathname navigation
  useEffect(() => {
    onMobileClose?.();
  }, [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  const renderSidebarContent = (isMobile: boolean) => (
    <div className="flex h-full w-full flex-col">
      {/* Brand Header */}
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 px-6 dark:border-slate-800">
        <Link
          href={resolvedHomeHref}
          onClick={isMobile ? onMobileClose : undefined}
          className="group flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245B85]"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700">
            <Image
              src="/logo.jfif"
              alt="VI-Fleet Logo"
              width={36}
              height={36}
              className="h-full w-auto object-contain transition-transform duration-200 group-hover:scale-105"
              priority
            />
          </div>
          <div className="min-w-0">
            <span className="text-lg font-black tracking-tight text-[#142B45] dark:text-slate-100">
              VI-<span className="text-[#245B85] dark:text-blue-400">Fleet</span>
            </span>
            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {brandSubtitle || `${brand} Workspace`}
            </p>
          </div>
        </Link>

        {isMobile && onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#245B85] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Independently Scrollable Navigation */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {brand === "Administration"
            ? "Platform Administration"
            : `${brand} Workspace`}
        </p>

        <nav
          aria-label={`${brand} workspace navigation`}
          className="space-y-1"
        >
          {navigation.map((item) => {
            const icon = item.icon ?? getDefaultNavIcon(item.label);
            const active = isRouteActive(pathname, item.href);

            const baseClass =
              "group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition";

            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={isMobile ? onMobileClose : undefined}
                  className={`${baseClass} ${
                    active
                      ? "bg-blue-50 text-[#245B85] font-semibold dark:bg-blue-950/40 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 transition ${
                        active
                          ? "text-[#245B85] dark:text-blue-400"
                          : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                      }`}
                      aria-hidden="true"
                    >
                      {icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {active && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#245B85] dark:bg-blue-400" />
                  )}
                </Link>
              );
            }

            return (
              <div
                key={item.label}
                className={`${baseClass} cursor-not-allowed text-slate-400 dark:text-slate-500`}
                title="This section has not been implemented yet"
                aria-disabled="true"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="shrink-0 text-slate-300 dark:text-slate-600"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  Soon
                </span>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Stationary Bottom Profile & Sign-Out */}
      <div className="mt-auto shrink-0 border-t border-slate-200 p-4 space-y-2 bg-white dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#245B85] dark:bg-blue-900/50 dark:text-blue-300">
            {userName.trim().charAt(0).toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
              {userName}
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {roleLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={signingOut}
          onClick={handleSignOut}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          <span aria-hidden="true">↪</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Stationary Sidebar */}
      <aside className="hidden md:flex md:h-full md:w-64 md:shrink-0 md:flex-col md:overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Backdrop */}
      <div
        role="presentation"
        onClick={onMobileClose}
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Mobile Navigation Drawer */}
      <aside
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${brand} navigation drawer`}
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-[#111827] md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent(true)}
      </aside>
    </>
  );
}
