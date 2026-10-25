
import Link from "next/link";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import VerifyEmailForm from "./verify-email-form";

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  let valid = false;

  if (/^[a-f0-9]{64}$/i.test(token)) {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const record = await prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        user: {
          deletedAt: null,
          status: "INACTIVE",
          pendingEmail: { not: null },
          passwordHash: { not: null },
          OR: [
            {
              role: "ORGANIZATION_ADMINISTRATOR",
              organizationId: { not: null },
              departmentId: null,
            },
            {
              role: "DEPARTMENT_USER",
              organizationId: { not: null },
              departmentId: { not: null },
            },
            {
              role: "TRANSPORT_MANAGER",
              organizationId: { not: null },
              departmentId: null,
            },
            {
              role: "VICE_TRANSPORT_MANAGER",
              organizationId: { not: null },
              departmentId: null,
            },
            {
              role: "DRIVER",
              organizationId: { not: null },
              departmentId: null,
            },
          ],
        },
      },
      select: { id: true },
    });

    valid = Boolean(record);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-blue-700">
          VI-FLEET
        </Link>

        <h1 className="mt-6 text-2xl font-semibold text-gray-900">
          Verify your email
        </h1>

        {valid ? (
          <>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Confirm your login email address to activate your VI-Fleet
              account. You will be able to log in after verification.
            </p>
            <VerifyEmailForm token={token} />
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              This verification link is invalid, expired, or already used.
              Request a new verification email if your account setup is
              complete.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white"
            >
              Go to login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
