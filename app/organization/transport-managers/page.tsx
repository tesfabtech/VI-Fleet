import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createTransportManager } from "./actions";

const allowedRoles = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];

type PageProps = {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

const messages: Record<string, string> = {
  "invitation-sent": "The account was created and the invitation email was sent.",
};

const errors: Record<string, string> = {
  invalid: "Check the required fields and try again.",
  "email-used": "That email address is already associated with an account.",
  "organization-inactive": "Your organization is inactive. Account creation is unavailable.",
  "creation-failed": "The account could not be created or the invitation email could not be delivered. Please try again.",
};

export default async function TransportManagersPage({
  searchParams,
}: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (
    !allowedRoles.includes(session.user.role) ||
    !session.user.organizationId
  ) {
    redirect("/organization");
  }

  const params = await searchParams;

  const users = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      role: {
        in: ["TRANSPORT_MANAGER", "VICE_TRANSPORT_MANAGER"],
      },
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-8">
      <section>
        <Link
          href="/organization"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← Back to overview
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          Transport Managers
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Create Transport Manager accounts for your organization and send
          secure account-setup invitations.
        </p>
      </section>

      {params.message && messages[params.message] && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {messages[params.message]}
        </p>
      )}

      {params.error && errors[params.error] && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {errors[params.error]}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Create an account
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          The new user will receive an invitation link valid for 48 hours.
        </p>

        <form action={createTransportManager} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Your name
              </label>
              <input
                id="firstName"
                name="firstName"
                required
                maxLength={150}
                autoComplete="given-name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="middleName"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Father&apos;s name
              </label>
              <input
                id="middleName"
                name="middleName"
                required
                maxLength={150}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Grandfather&apos;s name
              </label>
              <input
                id="lastName"
                name="lastName"
                required
                maxLength={150}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Phone number (optional)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength={30}
                autoComplete="tel"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Role
              </label>
              <select
                id="role"
                name="role"
                required
                defaultValue="TRANSPORT_MANAGER"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="TRANSPORT_MANAGER">
                  Transport Manager
                </option>
                <option value="VICE_TRANSPORT_MANAGER">
                  Vice Transport Manager
                </option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create account and send invitation
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Existing accounts
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {users.length} account{users.length === 1 ? "" : "s"} in your organization
          </p>
        </div>

        {users.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No Transport Manager accounts have been created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                      {[user.firstName, user.middleName, user.lastName]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                      {user.email || "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                      {user.role === "VICE_TRANSPORT_MANAGER"
                        ? "Vice Transport Manager"
                        : "Transport Manager"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {user.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                      {user.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}