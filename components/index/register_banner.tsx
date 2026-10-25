import Link from "next/link";

export default function RegisterBanner() {
  return (
    <section id="about" className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-blue-700">
              Get started with VI-Fleet
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Bring your fleet operations together.
            </h2>
            <p className="mt-3 leading-7 text-gray-600">
              Register your organization to begin the application and review
              process.
            </p>
          </div>

          <Link
            href="/register"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Register Organization
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}