import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateDriverProfile } from "../../management-actions";

type EditDriverPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_ROLES = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields": "First name, last name, and license number are required.",
  "invalid-length": "One or more fields exceed the allowed character limit.",
  "invalid-expiry": "Enter a valid license expiry date.",
  "license-exists":
    "That license number is already registered to another driver in your organization.",
  "driver-not-found": "Driver record not found.",
  "update-failed": "Could not update the driver. Please try again.",
};

export default async function EditDriverPage({
  params,
  searchParams,
}: EditDriverPageProps) {
  const session = await auth();
  const sessionUser = session?.user;

  if (
    !sessionUser?.id ||
    !sessionUser.organizationId ||
    !sessionUser.role ||
    !ALLOWED_ROLES.includes(
      sessionUser.role as (typeof ALLOWED_ROLES)[number],
    )
  ) {
    redirect("/login");
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const query = await searchParams;
  const organizationId = sessionUser.organizationId;

  const driver = await prisma.driver.findFirst({
    where: {
      id,
      organizationId,
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          pendingEmail: true,
          phone: true,
        },
      },
    },
  });

  if (!driver) {
    notFound();
  }

  const rawExpiry = driver.licenseExpiryDate
    ? driver.licenseExpiryDate.toISOString().slice(0, 10)
    : "";

  const emailDisplay =
    driver.user?.email ??
    driver.user?.pendingEmail ??
    "No email registered";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/transport/drivers/${driver.id}`}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          ← Back to driver profile
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Edit driver profile
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Update personal details, license information, and notes for this
          driver.
        </p>
      </div>

      {query.error && ERROR_MESSAGES[query.error] && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {ERROR_MESSAGES[query.error]}
        </div>
      )}

      <form
        action={updateDriverProfile}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="driverId" value={driver.id} />
        <input
          type="hidden"
          name="returnTo"
          value={`/transport/drivers/${driver.id}/edit`}
        />

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
                defaultValue={driver.firstName}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="middleName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Middle name
              </label>
              <input
                id="middleName"
                name="middleName"
                type="text"
                maxLength={150}
                defaultValue={driver.user?.middleName ?? ""}
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
                defaultValue={driver.lastName}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
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
                defaultValue={driver.phone ?? driver.user?.phone ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="emailReadonly"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Email address (Read-only)
              </label>
              <input
                id="emailReadonly"
                type="email"
                disabled
                value={emailDisplay}
                className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Email addresses are bound to security verification and account
                identity.
              </p>
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
                defaultValue={driver.licenseNumber}
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
                defaultValue={rawExpiry}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </section>

        <div className="border-t border-gray-200" />

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Internal notes
          </h2>
          <div>
            <label
              htmlFor="notes"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Notes for Transport Managers
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={driver.notes ?? ""}
              placeholder="Add optional notes about certifications, driving records, or shift preferences..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
          <Link
            href={`/transport/drivers/${driver.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

