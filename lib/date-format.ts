export const formatAddisDateTime = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
};

export const toAddisDateTimeLocalValue = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 16);
};

export function formatWaitingDuration(createdAt: Date | string, now = new Date()): string {
  const c = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const diffMs = Math.max(0, now.getTime() - c.getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
