export default function MaintenanceLoading() {
  return (
    <main
      aria-label="Loading maintenance"
      className="space-y-6 p-4 sm:p-6"
    >
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </main>
  );
}
