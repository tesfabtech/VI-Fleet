"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardNavItem = {
  label: string;
  href?: string;
};

type DashboardSidebarProps = {
  brand: string;
  navigation: DashboardNavItem[];
};

export default function DashboardSidebar({
  brand,
  navigation,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden min-h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Link
            href={brand === "Organization" ? "/organization" : "/transport"}
            className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-xs">
              V
            </div>
            <span>
              VI-<span className="text-blue-600">Fleet</span>
            </span>
          </Link>
        </div>

        <div className="px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {brand} workspace
          </p>

          <nav className="space-y-0.5">
            {navigation.map((item) => {
              const active =
                item.href !== undefined &&
                (pathname === item.href ||
                  (item.href !== "/organization" &&
                    item.href !== "/transport" &&
                    pathname.startsWith(`${item.href}/`)));

              const className = `flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
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
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-slate-400">
                    Soon
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-slate-200 p-4">
          <p className="text-[11px] text-slate-400">Fleet Management System</p>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            VI-Fleet Platform
          </p>
        </div>
      </aside>

      {/* Mobile Horizontal Navigation */}
      <nav className="flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
        {navigation.map((item) => {
          const active =
            item.href !== undefined &&
            (pathname === item.href ||
              (item.href !== "/organization" &&
                item.href !== "/transport" &&
                pathname.startsWith(`${item.href}/`)));

          const className = `shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            active
              ? "bg-blue-50 text-blue-700 font-semibold"
              : item.href
                ? "text-slate-600 hover:bg-slate-100"
                : "text-slate-400 cursor-not-allowed"
          }`;

          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={className}
            >
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
