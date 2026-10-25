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
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-20 items-center border-b border-slate-200 px-6">
          <Link
            href={brand === "Organization" ? "/organization" : "/transport"}
            className="text-xl font-bold tracking-tight text-slate-900"
          >
            VI-<span className="text-blue-600">Fleet</span>
          </Link>
        </div>

        <div className="px-5 py-5">
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

        <div className="mt-auto border-t border-slate-200 p-5">
          <p className="text-xs text-slate-500">Fleet management platform</p>
          <p className="mt-1 text-xs font-medium text-slate-700">
            VI-Fleet
          </p>
        </div>
      </aside>

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