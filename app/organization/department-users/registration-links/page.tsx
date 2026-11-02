// app/organization/department-users/registration-links/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/gmail-email";
import { decryptRegistrationToken } from "@/lib/department-registration-token";
import RegistrationLinkManager from "./registration-link-manager";
import { revokeRegistrationLink } from "./actions";

const allowedRoles = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];

type PageProps = {
  searchParams: Promise<{
    revoked?: string;
  }>;
};

export default async function RegistrationLinksPage({
  searchParams,
}: PageProps) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (!allowedRoles.includes(session.user.role)) notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const [params, organization, links] = await Promise.all([
    searchParams,
    prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      select: {
        name: true,
      },
    }),
    prisma.departmentRegistrationLink.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!organization) notFound();

  const now = new Date();

  // Any unrevoked record blocks creation until it is revoked,
  // including an expired link.
  const hasUnrevokedLink = links.some((link) => link.revokedAt === null);

  const activeLink = links.find(
    (link) =>
      link.revokedAt === null &&
      (link.expiresAt === null || link.expiresAt > now),
  );

  let activeRegistrationUrl: string | null = null;

  if (activeLink?.tokenEncrypted) {
    try {
      const rawToken = decryptRegistrationToken(activeLink.tokenEncrypted);

      activeRegistrationUrl = getAppUrl(
        `/department-apply?token=${encodeURIComponent(rawToken)}`,
      );
    } catch (error) {
      console.error(
        "Could not decrypt the department registration link:",
        error,
      );
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <Link
          href="/organization/department-users"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to Department Users
        </Link>

        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Department User Registration Links
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Create, copy, share, and revoke links applicants use to apply for
          Department User accounts.
        </p>
      </div>

      {params.revoked === "1" && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          Registration link revoked successfully. You can now generate a new
          link.
        </p>
      )}

      <RegistrationLinkManager
        activeRegistrationUrl={activeRegistrationUrl}
        hasUnrevokedLink={hasUnrevokedLink}
        organizationName={organization.name}
      />

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Registration link history
        </h2>

        {links.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">
            No registration links have been created yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {links.map((link) => {
              const expired =
                link.expiresAt !== null && link.expiresAt <= now;

              const status = link.revokedAt
                ? "Revoked"
                : expired
                  ? "Expired — revoke to replace"
                  : "Active";

              return (
                <div
                  key={link.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      Created {link.createdAt.toLocaleString()}
                    </p>

                    <p className="mt-1 text-sm text-gray-600">
                      {link.expiresAt
                        ? `Expires ${link.expiresAt.toLocaleString()}`
                        : "No automatic expiry"}
                    </p>

                    <p
                      className={`mt-1 text-sm font-medium ${
                        status === "Active"
                          ? "text-green-700"
                          : "text-gray-500"
                      }`}
                    >
                      {status}
                    </p>
                  </div>

                  {!link.revokedAt && (
                    <form action={revokeRegistrationLink}>
                      <input type="hidden" name="linkId" value={link.id} />

                      <button
                        type="submit"
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Revoke link
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}