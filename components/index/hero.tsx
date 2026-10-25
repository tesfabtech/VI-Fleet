import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-white">
      <div className="mx-auto flex max-w-7xl justify-center px-6 py-20 md:py-28 lg:px-8 lg:py-32">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
            A better way to
            <span className="text-blue-700"> manage your fleet.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            Bring vehicles, drivers, transportation requests, and maintenance
            into one organized platform built for your organization.
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              Register Your Organization
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <span className="font-bold text-blue-700">✓</span>
              Centralized records
            </span>

            <span className="flex items-center gap-2">
              <span className="font-bold text-blue-700">✓</span>
              Organization-based access
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}