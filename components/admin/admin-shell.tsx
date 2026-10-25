"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const navigation = [
  {
    label: "Overview",
    href: "/admin",
    icon: "▦",
  },
  {
    label: "Organization applications",
    href: "/admin/applications",
    icon: "▤",
  },
];

const upcomingNavigation = [
  { label: "Organizations", icon: "▣" },
  { label: "User management", icon: "♙" },
  { label: "Settings", icon: "⚙" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/admin/applications")) {
    return "Organization applications";
  }

  return "Overview";
}

export default function AdminShell({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const pageTitle = getPageTitle(pathname);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-gray-950/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-gray-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white">
            V
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-gray-950">
              VI-Fleet
            </p>
            <p className="text-xs text-gray-500">Platform administration</p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Workspace
          </p>

          <nav aria-label="Main navigation" className="mt-3 space-y-1">
            {navigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-blue-50 text-blue-800"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-950"
                  }`}
                >
                  <span className="w-5 text-center text-base" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-4 pt-8">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Platform
          </p>

          <nav aria-label="Platform navigation" className="mt-3 space-y-1">
            {upcomingNavigation.map((item) => (
              <div
                key={item.label}
                title="This section has not been implemented yet"
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400"
              >
                <span className="w-5 text-center text-base" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wide">
                  Soon
                </span>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
              SA
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                System Administrator
              </p>
              <p className="text-xs text-gray-500">Platform access</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="w-5 text-center" aria-hidden="true">
              ↪
            </span>
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 lg:hidden"
            >
              <span aria-hidden="true">☰</span>
            </button>

            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-gray-950">
                {pageTitle}
              </p>
              <p className="hidden text-xs text-gray-500 sm:block">
                VI-Fleet / Administration
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="ml-3 shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-blue-700"
          >
            View website
          </Link>
        </header>

        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}