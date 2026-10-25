import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import DepartmentApplicationForm from "./department-application-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function DepartmentApplyPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token || token.length > 200) {
    return <InvalidLink />;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const link = await prisma.departmentRegistrationLink.findUnique({
    where: { tokenHash },
  });

  if (
    !link ||
    link.revokedAt ||
    (link.expiresAt && link.expiresAt <= new Date())
  ) {
    return <InvalidLink />;
  }

  const [organization, departments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: link.organizationId },
      select: { name: true },
    }),
    prisma.department.findMany({
      where: {
        organizationId: link.organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!organization) {
    return <InvalidLink />;
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            VI-Fleet
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Department User Application
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Apply for a Department User account at {organization.name}. Your
            account will not be activated until your application is approved,
            setup is completed, and your email is verified.
          </p>
        </header>

        {departments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
            This organization currently has no active departments accepting
            applications. Please contact the organization administrator.
          </div>
        ) : (
          <DepartmentApplicationForm
            token={token}
            organizationName={organization.name}
            departments={departments}
          />
        )}
      </div>
    </main>
  );
}

function InvalidLink() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Registration link unavailable
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          This link is invalid, expired, or has been revoked. Please contact
          the organization that provided it and request a valid link.
        </p>
      </div>
    </main>
  );
}