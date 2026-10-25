import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type DriversPageProps = {
  searchParams: Promise<{
    created?: string;
    invitation?: string;
    error?: string;
  }>;
};

const ALLOWED_ROLES = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
] as const;

function formatDate(date: Date | null): string {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getDriverStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "SUSPENDED":
      return "Suspended";
    default:
      return status;
  }
}

function getStatusClasses(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800";
    case "SUSPENDED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getNotice(searchParams: {
  created?: string;
  invitation?: string;
  error?: string;
}) {
  if (searchParams.created === "1") {
    return {
      type: "success" as const,
      message:
        "The driver account was created and the invitation email was sent.",
    };
  }

  if (searchParams.invitation === "failed") {
    return {
      type: "error" as const,
      message:
        "The driver was created, but the invitation email could not be confirmed. Check your email configuration and arrange a safe way to resend the invitation.",
    };
  }

  const errorMessages: Record<string, string> = {
    "email-exists":
      "That email address is already associated with an account or pending invitation.",
    "license-exists":
      "That license number is already registered in your organization.",
    "missing-fields": "Complete all required fields and try again.",
    "invalid-length": "One or more fields exceed the allowed length.",
    "invalid-email": "Enter a valid email address.",
    "invalid-expiry": "Enter a valid license expiry date.",
    "organization-unavailable":
      "Your organization is unavailable. Contact your administrator.",
    "create-failed":
      "The driver could not be created. Please try again.",
  };

  if (searchParams.error && errorMessages[searchParams.error]) {
    return {
      type: "error" as const,
      message: errorMessages[searchParams.error],
    };
  }

  return null;
}

export default async function DriversPage({
  searchParams,
}: DriversPageProps) {
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

  const organizationId = sessionUser.organizationId;
  const params = await searchParams;
  const notice = getNotice(params);

  const drivers = await prisma.driver.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      licenseNumber: true,
      licenseExpiryDate: true,
      status: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          pendingEmail: true,
          status: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const activeCount = drivers.filter(
    (driver) => driver.status === "ACTIVE",
  ).length;

  const inactiveCount = drivers.filter(
    (driver) => driver.status === "INACTIVE",
  ).length;

  const suspendedCount = drivers.filter(
    (driver) => driver.status === "SUSPENDED",
  ).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Drivers
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage driver accounts, licenses, and invitations for your
            organization.
          </p>
        </div>

        <Link
          href="/transport/drivers/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + Add driver
        </Link>
      </div>

      {notice && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total drivers</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {drivers.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="mt-2 text-3xl font-bold text-gray-700">
            {inactiveCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Suspended</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {suspendedCount}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Driver directory</h2>
          <p className="mt-1 text-sm text-gray-500">
            {drivers.length} {drivers.length === 1 ? "driver" : "drivers"}{" "}
            registered
          </p>
        </div>

        {drivers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              No drivers yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              Add your first driver to register their license details and
              invite them to set up a VI-Fleet account.
            </p>
            <Link
              href="/transport/drivers/new"
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Add your first driver
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Driver
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    License
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Expiry date
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Driver status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Account
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {drivers.map((driver) => {
                  const accountEmail =
                    driver.user?.email ??
                    driver.user?.pendingEmail ??
                    "No email";

                  const emailPending =
                    !driver.user?.email &&
                    Boolean(driver.user?.pendingEmail);

                  return (
                    <tr key={driver.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-medium text-gray-900">
                          {driver.firstName} {driver.lastName}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Added {formatDate(driver.createdAt)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm text-gray-900">
                          {accountEmail}
                        </p>
                        {driver.phone && (
                          <p className="mt-1 text-sm text-gray-500">
                            {driver.phone}
                          </p>
                        )}
                        {emailPending && (
                          <p className="mt-1 text-xs text-amber-700">
                            Email not verified
                          </p>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-700">
                        {driver.licenseNumber}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-700">
                        {formatDate(driver.licenseExpiryDate)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                            driver.status,
                          )}`}
                        >
                          {getDriverStatusLabel(driver.status)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            driver.user?.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : driver.user?.status === "SUSPENDED"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {driver.user?.status === "ACTIVE"
                            ? "Active"
                            : driver.user?.status === "SUSPENDED"
                              ? "Suspended"
                              : driver.user
                                ? "Pending setup"
                                : "No account"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}