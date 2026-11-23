export default function AssignmentsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-200 rounded-md" />
          <div className="h-4 w-96 bg-slate-100 rounded-md" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-lg" />
      </div>

      {/* KPI Stats Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-2"
          >
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-8 w-16 bg-slate-300 rounded" />
            <div className="h-3 w-40 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="h-14 bg-slate-100 rounded-xl border border-slate-200" />

      {/* Table Skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100">
            <div className="space-y-2">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-24 bg-slate-100 rounded-full" />
              <div className="h-6 w-20 bg-slate-100 rounded-full" />
            </div>
            <div className="h-8 w-28 bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
