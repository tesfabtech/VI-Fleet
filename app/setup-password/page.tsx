import { createHash } from "node:crypto";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SetupPasswordForm from "./setup-password-form";

type SetupPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

type InvitationRole =
  | "ORGANIZATION_ADMINISTRATOR"
  | "DEPARTMENT_USER"
  | "TRANSPORT_MANAGER"
  | "VICE_TRANSPORT_MANAGER"
  | "DRIVER";

type InvitationDetails = {
  role: InvitationRole;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
};

export default async function SetupPasswordPage({
  searchParams,
}: SetupPasswordPageProps) {
  const params = await searchParams;
  const token =
    typeof params.token === "string" ? params.token : "";

  let invitationDetails: InvitationDetails | null = null;

  if (/^[a-f0-9]{64}$/i.test(token)) {
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const invitation =
      await prisma.organizationInvitation.findFirst({
        where: {
          tokenHash,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: {
            deletedAt: null,
            passwordHash: null,
            status: "INACTIVE",
            role: {
              in: [
                "ORGANIZATION_ADMINISTRATOR",
                "DEPARTMENT_USER",
                "TRANSPORT_MANAGER",
                "VICE_TRANSPORT_MANAGER",
                "DRIVER",
              ],
            },
          },
        },
        select: {
          user: {
            select: {
              role: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
              pendingEmail: true,
            },
          },
        },
      });

    if (invitation) {
      const user = invitation.user;

      if (
        user.role === "ORGANIZATION_ADMINISTRATOR" ||
        user.role === "DEPARTMENT_USER" ||
        user.role === "TRANSPORT_MANAGER" ||
        user.role === "VICE_TRANSPORT_MANAGER" ||
        user.role === "DRIVER"
      ) {
        const firstName = user.firstName;
        const middleName = user.middleName;
        const lastName = user.lastName;

        // Invited drivers may not have a verified email yet.
        const email = user.pendingEmail ?? user.email;

        const hasRequiredDetails =
          typeof firstName === "string" &&
          firstName.trim().length > 0 &&
          typeof middleName === "string" &&
          middleName.trim().length > 0 &&
          typeof lastName === "string" &&
          lastName.trim().length > 0 &&
          typeof email === "string" &&
          email.trim().length > 0;

        if (hasRequiredDetails) {
          invitationDetails = {
            role: user.role,
            firstName: firstName.trim(),
            middleName: middleName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
          };
        } else if (
          user.role === "ORGANIZATION_ADMINISTRATOR"
        ) {
          invitationDetails = {
            role: "ORGANIZATION_ADMINISTRATOR",
            firstName: "",
            middleName: "",
            lastName: "",
            email: "",
          };
        }
      }
    }
  }

  if (!invitationDetails) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Invitation unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            This invitation is invalid, expired, already used,
            or no longer available. Please contact your
            organization administrator for assistance.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  const applicantDetails =
    invitationDetails.role !== "ORGANIZATION_ADMINISTRATOR"
      ? {
          firstName: invitationDetails.firstName,
          middleName: invitationDetails.middleName,
          lastName: invitationDetails.lastName,
          email: invitationDetails.email,
        }
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Set up your VI-Fleet account
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Create a password to continue setting up your
          account. You will need to verify your email address
          before your account setup is complete.
        </p>

        <SetupPasswordForm
          token={token}
          role={invitationDetails.role}
          applicantDetails={applicantDetails}
        />
      </section>
    </main>
  );
}