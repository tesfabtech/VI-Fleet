"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import DashboardSidebar, {
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-sidebar";

type ManagementDashboardShellProps = {
  brand: string;
  roleLabel: string;
  userName: string;
  navigation: DashboardNavItem[];
  children: ReactNode;
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
}: ManagementDashboardShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const settingsHref =
    brand === "Organization" ? "/organization/settings" : undefined;
  const homeHref = brand === "Organization" ? "/organization" : "/transport";

  useEffect(() => {
    const saved = localStorage.getItem("vi-fleet-theme") as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      setTheme(saved);
    }
    syncThemeOnDocument();

    const onThemeChange = () => {
      const current = localStorage.getItem("vi-fleet-theme") as ThemeMode | null;
      if (current === "light" || current === "dark" || current === "system") {
        setTheme(current);
      }
      syncThemeOnDocument();
    };

    const onClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("vi-fleet-theme-change", onThemeChange);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("vi-fleet-theme-change", onThemeChange);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  function changeTheme(next: ThemeMode) {
    setTheme(next);
    localStorage.setItem("vi-fleet-theme", next);
    syncThemeOnDocument();
    window.dispatchEvent(new Event("vi-fleet-theme-change"));
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="vi-workspace min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 md:flex">
      <DashboardSidebar
        brand={brand}
        userName={userName}
        roleLabel={roleLabel}
        navigation={navigation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex min-h-20 items-center justify-between gap-4 px-5 py-3 sm:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {brand} dashboard
              </p>
              <h1 className="mt-1 text-lg font-semibold text-slate-900">
                Welcome back, {userName.split(" ")[0] || "User"}
              </h1>
            </div>

            {/* Interactive Account Dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="hidden text-right sm:block">
                  <p className="max-w-44 truncate text-sm font-semibold text-slate-800">
                    {userName}
                  </p>
                  <p className="text-xs text-slate-500">{roleLabel}</p>
                </div>

                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700"
                  aria-hidden="true"
                >
                  {userName.trim().charAt(0).toUpperCase() || "U"}
                </div>

                <span className="text-xs text-slate-400" aria-hidden="true">
                  ▾
                </span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50"
                >
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {userName}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-blue-600">
                      {roleLabel}
                    </p>
                  </div>

                  {/* Quick Theme Toggle inside Dropdown */}
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Theme
                    </p>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                      {(["light", "dark", "system"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => changeTheme(mode)}
                          className={`rounded-md py-1 text-xs font-semibold capitalize transition ${
                            theme === mode
                              ? "bg-white text-slate-900 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
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
                      href={homeHref}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <span>{brand} overview</span>
                      <span className="text-xs text-slate-400">→</span>
                    </Link>

                    {settingsHref && (
                      <Link
                        href={settingsHref}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <span>Organization & account settings</span>
                        <span className="text-xs text-slate-400">⚙</span>
                      </Link>
                    )}

                    <Link
                      href="/forgot-password"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <span>Reset password</span>
                      <span className="text-xs text-slate-400">🔑</span>
                    </Link>

                    <Link
                      href="/"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <span>Public home page</span>
                      <span className="text-xs text-slate-400">↗</span>
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={handleSignOut}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                      <span aria-hidden="true">↪</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
