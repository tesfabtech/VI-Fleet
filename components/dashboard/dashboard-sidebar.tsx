"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type DashboardNavItem = {
  label: string;
  href?: string;
};

type DashboardSidebarProps = {
  brand: string;
  userName?: string;
  roleLabel?: string;
  navigation: DashboardNavItem[];
};

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
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-6">
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

        <div className="px-4 py-5">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {brand} workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const active =
                item.href !== undefined &&
                (pathname === item.href ||
                  (item.href !== "/organization" &&
                    item.href !== "/transport" &&
                    pathname.startsWith(`${item.href}/`)));

              const className = `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
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
                  <span>{item.label}</span>
                  {active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  )}
                </Link>
              ) : (
                <div
                  key={item.label}
                  className={className}
                  title="This section is not available yet"
                >
                  <span>{item.label}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                    Soon
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Account & Sign-Out Box */}
        <div className="mt-auto border-t border-slate-200 p-4 space-y-2">
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
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        {navigation.map((item) => {
          const active =
            item.href !== undefined &&
            (pathname === item.href ||
              (item.href !== "/organization" &&
                item.href !== "/transport" &&
                pathname.startsWith(`${item.href}/`)));

          const className = `shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
            active
              ? "bg-blue-50 text-blue-700"
              : item.href
                ? "text-slate-600"
                : "text-slate-400"
          }`;

          return item.href ? (
            <Link key={item.label} href={item.href} className={className}>
              {item.label}
            </Link>
          ) : (
            <span key={item.label} className={className}>
              {item.label}
            </span>
          );
        })}
      </nav>
    </>
  );
}