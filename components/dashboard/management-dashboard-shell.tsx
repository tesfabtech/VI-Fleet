"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import DashboardSidebar, {
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-sidebar";

type ManagementDashboardShellProps = {
  brand: string;
  roleLabel: string;
  userName: string;
  navigation: DashboardNavItem[];
  children: ReactNode;
  homeHref?: string;
  title?: string;
  subtitle?: string;
};

type ThemeMode = "light" | "dark" | "system";

function syncThemeOnDocument() {
  if (typeof window === "undefined") return;
  const savedTheme = localStorage.getItem("vi-fleet-theme") || "light";
  const savedAccent = localStorage.getItem("vi-fleet-accent") || "blue";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved =
    savedTheme === "dark" || (savedTheme === "system" && prefersDark)
      ? "dark"
      : "light";

  document.documentElement.setAttribute("data-vi-theme", resolved);
  document.documentElement.setAttribute("data-vi-accent", savedAccent);
}

export default function ManagementDashboardShell({
  brand,
  roleLabel,
  userName,
  navigation,
  children,
  homeHref,
  title,
  subtitle,
}: ManagementDashboardShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

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

  const settingsHref =
    brand === "Organization" ? "/organization/settings" : undefined;

  // Initialize and synchronize theme
  useEffect(() => {
    const saved = localStorage.getItem("vi-fleet-theme") as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      queueMicrotask(() => {
        setTheme(saved);
      });
    }
    syncThemeOnDocument();

    const onThemeChange = () => {
      const current = localStorage.getItem("vi-fleet-theme") as ThemeMode | null;
      if (current === "light" || current === "dark" || current === "system") {
        setTheme(current);
      }
      syncThemeOnDocument();
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = localStorage.getItem("vi-fleet-theme") as ThemeMode | null;
      if (current === "system") {
        syncThemeOnDocument();
      }
    };

    window.addEventListener("vi-fleet-theme-change", onThemeChange);
    window.addEventListener("storage", onThemeChange);
    mediaQuery.addEventListener("change", onSystemChange);

    return () => {
      window.removeEventListener("vi-fleet-theme-change", onThemeChange);
      window.removeEventListener("storage", onThemeChange);
      mediaQuery.removeEventListener("change", onSystemChange);
    };
  }, []);

  // Close menus on outside click or Escape key
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node)
      ) {
        setNotificationOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Close mobile drawer and dropdowns on route changes
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    setNotificationOpen(false);
  }, [pathname]);

  function changeTheme(next: ThemeMode) {
    setTheme(next);
    localStorage.setItem("vi-fleet-theme", next);
    syncThemeOnDocument();
    window.dispatchEvent(new Event("vi-fleet-theme-change"));
  }

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="vi-workspace min-h-screen md:h-screen md:h-[100dvh] md:overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#0b1120] dark:text-slate-100 md:flex">
      {/* Shared Responsive Sidebar & Mobile Drawer */}
      <DashboardSidebar
        brand={brand}
        userName={userName}
        roleLabel={roleLabel}
        navigation={navigation}
        homeHref={resolvedHomeHref}
        brandSubtitle={subtitle}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />

      <div className="flex min-w-0 flex-1 flex-col md:h-full md:overflow-hidden">
        {/* Shared Top Navigation Header */}
        <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur transition-colors dark:border-slate-800 dark:bg-[#111827]/95">
          <div className="flex min-h-20 items-center justify-between gap-3 px-4 py-3 sm:px-8">
            {/* Left: Mobile Hamburger Toggle + Title Context */}
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation-drawer"
                onClick={() => setMobileOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#245B85] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 md:hidden"
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
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {subtitle || `${brand} Workspace`}
                </p>
                <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  {title || `Welcome back, ${userName.split(" ")[0] || "User"}`}
                </h1>
              </div>
            </div>

            {/* Right: Notification Bell & Profile Dropdown */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Notification Bell */}
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen((prev) => !prev);
                    setMenuOpen(false);
                  }}
                  aria-expanded={notificationOpen}
                  aria-haspopup="true"
                  aria-label="View notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#245B85] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                </button>

                {/* Honest Notification Dropdown */}
                {notificationOpen && (
                  <div
                    role="dialog"
                    aria-label="Notifications panel"
                    className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50 dark:border-slate-700 dark:bg-[#1f2937]"
                  >
                    <div className="border-b border-slate-100 pb-3 dark:border-slate-700">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        Notifications
                      </span>
                    </div>
                    <div className="py-7 text-center">
                      <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 01-3.46 0" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        No notifications available
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        You are all caught up!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* User Account Dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((prev) => !prev);
                    setNotificationOpen(false);
                  }}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-xs transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#245B85] dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/60"
                >
                  <div className="hidden text-right sm:block">
                    <p className="max-w-44 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {userName}
                    </p>
                    <p className="max-w-44 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {roleLabel}
                    </p>
                  </div>

                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#245B85] dark:bg-blue-900/50 dark:text-blue-300"
                    aria-hidden="true"
                  >
                    {userInitial}
                  </div>

                  <span
                    className="text-xs text-slate-400 dark:text-slate-500"
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 dark:border-slate-700 dark:bg-[#1f2937]"
                  >
                    {/* User Identity Header */}
                    <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-700">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {userName}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-[#245B85] dark:text-blue-400">
                        {roleLabel}
                      </p>
                    </div>

                    {/* Appearance Controls */}
                    <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-700">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Appearance
                      </p>
                      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                        {(["light", "dark", "system"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => changeTheme(mode)}
                            className={`rounded-lg py-1 text-xs font-semibold capitalize transition ${
                              theme === mode
                                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="py-1">
                      <Link
                        href={resolvedHomeHref}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                      >
                        <span>{brand} overview</span>
                        <span className="text-xs text-slate-400">→</span>
                      </Link>

                      {settingsHref && (
                        <Link
                          href={settingsHref}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                        >
                          <span>Organization & account settings</span>
                          <span className="text-xs text-slate-400">⚙</span>
                        </Link>
                      )}

                      <Link
                        href="/forgot-password"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                      >
                        <span>Reset password</span>
                        <span className="text-xs text-slate-400">🔑</span>
                      </Link>

                      <Link
                        href="/"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                      >
                        <span>Public home page</span>
                        <span className="text-xs text-slate-400">↗</span>
                      </Link>
                    </div>

                    {/* Sign Out */}
                    <div className="border-t border-slate-100 pt-1 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={signingOut}
                        onClick={handleSignOut}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <span>
                          {signingOut ? "Signing out..." : "Sign out"}
                        </span>
                        <span aria-hidden="true">↪</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Workspace Content */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
