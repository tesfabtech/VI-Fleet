
type MaintenanceStatsProps = {
  totalRecords: number;
  scheduled: number;
  upcoming: number;
  overdue: number;
};

const stats = [
  {
    key: "totalRecords",
    label: "Total Records",
    description: "All maintenance records",
    icon: "📋",
    color: "blue",
  },
  {
    key: "scheduled",
    label: "Scheduled",
    description: "Planned maintenance",
    icon: "📅",
    color: "purple",
  },
  {
    key: "upcoming",
    label: "Upcoming",
    description: "Services approaching",
    icon: "🔔",
    color: "green",
  },
  {
    key: "overdue",
    label: "Overdue",
    description: "Services past due",
    icon: "⚠️",
    color: "red",
  },
] as const;

const colorStyles = {
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-600",
};

export default function MaintenanceStats({
  totalRecords,
  scheduled,
  upcoming,
  overdue,
}: MaintenanceStatsProps) {
  const values = {
    totalRecords,
    scheduled,
    upcoming,
    overdue,
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.key}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                {stat.label}
              </p>

              <h2 className="mt-2 text-3xl font-bold text-gray-900">
                {values[stat.key]}
              </h2>
            </div>

            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${
                colorStyles[stat.color]
              }`}
            >
              {stat.icon}
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            {stat.description}
          </p>
        </div>
      ))}
    </div>
  );
}
