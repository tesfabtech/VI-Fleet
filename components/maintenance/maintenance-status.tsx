import type { MaintenanceStatus } from "@prisma/client";

const styles: Record<MaintenanceStatus | "UPCOMING" | "OVERDUE", string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-600",
  UPCOMING: "bg-amber-50 text-amber-800",
  OVERDUE: "bg-red-50 text-red-700",
};

export default function MaintenanceStatusBadge({
  status,
}: {
  status: MaintenanceStatus | "UPCOMING" | "OVERDUE";
}) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {label}
    </span>
  );
}
