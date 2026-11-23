export default function RolesLoading() {
  return (
    <main className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-md bg-slate-200" />
          <div className="h-4 w-96 rounded-md bg-slate-200" />
        </div>
        <div className="h-10 w-44 rounded-lg bg-slate-200" />
      </div>

      {/* KPI Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-8 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-10 w-full rounded-lg bg-slate-200" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="h-6 w-full rounded bg-slate-200" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 w-full rounded bg-slate-100" />
        ))}
      </div>
    </main>
  );
}
