import type { ReactNode } from "react";
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

export default function ManagementDashboardShell({
  brand,
  roleLabel,
  userName,
  navigation,
  children,
}: ManagementDashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <DashboardSidebar brand={brand} navigation={navigation} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="flex min-h-20 items-center justify-between gap-4 px-5 py-3 sm:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {brand} dashboard
              </p>
              <h1 className="mt-1 text-lg font-semibold text-slate-900">
                Welcome back
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-48 truncate text-sm font-semibold text-slate-800">
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
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 py-2 sm:px-8 sm:hidden">
            <p className="truncate text-xs text-slate-500">
              {userName} · {roleLabel}
            </p>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}