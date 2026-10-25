
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  approveDepartmentUserApplication,
  rejectDepartmentUserApplication,
} from "./actions";

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
  approved:
    "Application approved. The invitation email was sent successfully.",
  rejected: "Application rejected successfully.",
};

const errors: Record<string, string> = {
  unauthorized: "You are not authorized to review these applications.",
  invalid: "The application information is invalid.",
  notes: "Review notes must be 2,000 characters or fewer.",
  "email-used":
    "This email address already belongs to an account. No approval was made.",
  reviewed:
    "This application has already been reviewed or is no longer available.",
  inactive:
    "The organization or selected department is inactive. No approval was made.",
  "approval-failed":
    "Approval failed. No approval was completed. Check the server logs for details.",
  "rejection-failed": "Rejection failed. Please try again.",
};

function statusClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "bg-green-100 text-green-800";
    case "REJECTED":
      return "bg-red-100 text-red-800";
    case "UNDER_REVIEW":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

export default async function DepartmentUsersPage({
  searchParams,
}: PageProps) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (!allowedRoles.includes(session.user.role)) notFound();

  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const params = await searchParams;

  const applications = await prisma.departmentUserApplication.findMany({
    where: { organizationId },
    include: {
      department: { select: { name: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Department Users
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Review applications and manage Department User registration.
          </p>
        </div>

        <Link
          href="/organization/department-users/registration-links"
          className="inline-flex w-fit rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Manage registration links
        </Link>
      </div>

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

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Applications ({applications.length})
        </h2>

        {applications.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">
            No applications have been submitted yet. Create a registration
            link to invite applicants.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {applications.map((application) => {
              const canReview =
                application.status === "PENDING" ||
                application.status === "UNDER_REVIEW";

              return (
                <article
                  key={application.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {application.firstName} {application.middleName}{" "}
                        {application.lastName}
                      </h3>

                      <p className="mt-1 text-sm text-gray-700">
                        Email: {application.email}
                      </p>

                      <p className="mt-1 text-sm text-gray-700">
                        Phone: {application.phone || "Not provided"}
                      </p>

                      <p className="mt-1 text-sm text-gray-700">
                        Department: {application.department.name}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Submitted: {application.submittedAt.toLocaleString()}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(application.status)}`}
                    >
                      {application.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  {application.reviewNotes && (
                    <div className="mt-4 rounded-md bg-gray-50 p-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        Review notes
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                        {application.reviewNotes}
                      </p>
                    </div>
                  )}

                  {canReview && (
                    <form className="mt-4 space-y-3">
                      <label
                        htmlFor={`notes-${application.id}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Review notes (optional)
                      </label>

                      <textarea
                        id={`notes-${application.id}`}
                        name="reviewNotes"
                        maxLength={2000}
                        rows={3}
                        placeholder="Add notes about this decision..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                      />

                      <input
                        type="hidden"
                        name="applicationId"
                        value={application.id}
                      />

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          formAction={approveDepartmentUserApplication}
                          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                        >
                          Approve and send invitation
                        </button>

                        <button
                          type="submit"
                          formAction={rejectDepartmentUserApplication}
                          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Reject application
                        </button>
                      </div>
                    </form>
                  )}

                  {!canReview && application.reviewedAt && (
                    <p className="mt-3 text-xs text-gray-500">
                      Reviewed on {application.reviewedAt.toLocaleString()}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
