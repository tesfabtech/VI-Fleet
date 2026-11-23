export default function WorkflowsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg bg-slate-200" />
          <div className="h-4 w-96 rounded-lg bg-slate-100" />
        </div>
        <div className="h-10 w-44 rounded-lg bg-slate-200" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="h-14 rounded-xl border border-slate-200 bg-white p-3 shadow-xs" />

      <div className="h-96 rounded-xl border border-slate-200 bg-white shadow-xs" />
    </div>
  );
}
