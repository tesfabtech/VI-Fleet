export default function DepartmentRequestsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded-lg bg-slate-200" />
          <div className="h-4 w-48 rounded-lg bg-slate-100" />
        </div>
        <div className="h-10 w-44 rounded-xl bg-slate-200" />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-20 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-3 h-6 w-12 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="h-9 w-full rounded-xl bg-slate-100" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-14 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
