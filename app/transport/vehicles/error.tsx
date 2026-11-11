"use client";

export default function VehiclesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <section
        role="alert"
        className="rounded-xl border border-red-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-950">
          Vehicles could not be loaded
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Please try again. If this keeps happening, contact your system
          administrator.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
