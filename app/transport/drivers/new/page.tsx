import Link from "next/link";
import { createDriver } from "../actions";

export default function NewDriverPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/transport/drivers"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Back to drivers
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Add a driver
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter the driver’s details. An invitation will be sent to their email
          address so they can set up their account.
        </p>
      </div>

      <form
        action={createDriver}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Personal details
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                First name *
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                maxLength={100}
                autoComplete="given-name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="middleName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Middle name *
              </label>
              <input
                id="middleName"
                name="middleName"
                type="text"
                required
                maxLength={100}
                autoComplete="additional-name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Last name *
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                maxLength={100}
                autoComplete="family-name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Email address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="phone"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Phone number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength={30}
                autoComplete="tel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </section>

        <div className="border-t border-gray-200" />

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Driver’s license
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="licenseNumber"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                License number *
              </label>
              <input
                id="licenseNumber"
                name="licenseNumber"
                type="text"
                required
                maxLength={100}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="licenseExpiryDate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                License expiry date
              </label>
              <input
                id="licenseExpiryDate"
                name="licenseExpiryDate"
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
          <Link
            href="/transport/drivers"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create driver and send invitation
          </button>
        </div>
      </form>
    </div>
  );
}