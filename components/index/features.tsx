const features = [
  {
    number: "01",
    title: "Vehicle Management",
    description:
      "Keep vehicle details, availability, and assignments organized in one place.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M3 13l2-6h14l2 6v6h-2v-2H5v2H3v-6z" />
        <path d="M5 13h14M7 17h.01M17 17h.01" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Driver Management",
    description:
      "Maintain driver profiles and organize responsibilities and assignments.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0112 0v2M16 5a3 3 0 010 6M18 14a5 5 0 013 4v2" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Transportation Requests",
    description:
      "Coordinate requests and trips with a clear, structured workflow.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Maintenance & Fuel",
    description:
      "Record servicing, plan maintenance, and keep fuel information accessible.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M14 6l4-4 4 4-4 4M18 6l-8 8M5 4l5 5-6 6-3-3zM3 15l6 6" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="border-y border-gray-100 bg-gray-50/70">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              What you can manage
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              The essentials, working together.
            </h2>
          </div>
          <p className="max-w-md leading-7 text-gray-600">
            Practical tools to help your team manage everyday fleet operations
            with greater structure and visibility.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.number}
              className="rounded-xl border border-gray-200 bg-white p-6 transition hover:border-blue-200 hover:shadow-md hover:shadow-gray-200/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  {feature.icon}
                </div>
                <span className="text-sm font-medium text-gray-300">
                  {feature.number}
                </span>
              </div>

              <h3 className="mt-6 text-lg font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}