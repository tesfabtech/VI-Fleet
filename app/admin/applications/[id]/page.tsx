import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ApplicationActions from "./application-actions";

export default async function ApplicationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validate the application UUID before querying the database.
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(id)) {
    notFound();
  }

  const application = await prisma.organizationApplication.findUnique({
    where: { id },
    select: {
      id: true,
      organizationName: true,
      contactEmail: true,
      phone: true,
      description: true,
      status: true,
      paymentStatus: true,
      reviewNotes: true,
      submittedAt: true,
      reviewedAt: true,
      organizationId: true,
      organization: {
        select: {
         id: true,
          code: true,
       },
     },
    },
  });

  if (!application) {
    notFound();
  }

  const statusStyles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-800",
    UNDER_REVIEW: "bg-blue-50 text-blue-800",
    APPROVED: "bg-green-50 text-green-800",
    REJECTED: "bg-red-50 text-red-800",
  };

  const details = [
    {
      label: "Organization name",
      value: application.organizationName,
    },
    {
      label: "Contact email",
      value: application.contactEmail,
    },
    {
      label: "Phone number",
      value: application.phone || "Not provided",
    },
    {
      label: "Payment status",
      value: application.paymentStatus.replaceAll("_", " "),
    },
    {
      label: "Submitted",
      value: application.submittedAt.toLocaleString(),
    },
    {
      label: "Last reviewed",
      value: application.reviewedAt?.toLocaleString() ?? "Not reviewed",
    },
    {
  label: "Organization code",
  value: application.organization?.code ?? "Not assigned",
   },
  ];

  const isActionable =
    application.status === "PENDING" ||
    application.status === "UNDER_REVIEW";

  return (
    <main className="mx-auto max-w-5xl">
      {/* Page heading and navigation */}
      <div className="mb-8">
        <Link
          href="/admin/applications"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition hover:text-blue-800"
        >
          <span aria-hidden="true">←</span>
          Back to applications
        </Link>

        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Organization onboarding
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
              Application details
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Review the submitted information and decide whether to approve
              this organization.
            </p>
          </div>

          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusStyles[application.status] ??
              "bg-gray-100 text-gray-700"
            }`}
          >
            {application.status.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Application information */}
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="font-semibold text-gray-950">
                Organization information
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Information provided during registration.
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-6 px-6 py-6 sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label} className="min-w-0">
                  <p className="text-sm text-gray-500">{detail.label}</p>

                  <p className="mt-1 wraps-break-words text-sm font-medium text-gray-900">
                    {detail.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 px-6 py-6">
              <h3 className="text-sm font-semibold text-gray-900">
                Organization description
              </h3>

              <p className="mt-2 whitespace-pre-wrap wraps-break-words text-sm leading-7 text-gray-600">
                {application.description || "No description provided."}
              </p>
            </div>
          </section>

          {/* Review history and internal notes */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="font-semibold text-gray-950">
                Internal review notes
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Notes recorded by the System Administrator.
              </p>
            </div>

            <div className="px-6 py-5">
              {application.reviewNotes ? (
                <p className="whitespace-pre-wrap wraps-break-words text-sm leading-7 text-gray-700">
                  {application.reviewNotes}
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  No review notes have been recorded.
                </p>
              )}
            </div>
          </section>

          {/* Linked organization after approval */}
          {application.organizationId && (
            <section className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800">
                  <span aria-hidden="true">✓</span>
                </div>

                <div className="min-w-0">
                  <h2 className="font-semibold text-green-900">
                    Organization created
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-green-800">
                    This application is linked to an organization record.
                  </p>

                  <p className="mt-2 break-all font-mono text-xs text-green-800">
                    {application.organizationId}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Completed application message */}
          {!isActionable && (
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <h2 className="font-semibold text-gray-900">
                Application decision recorded
              </h2>

              <p className="mt-1 text-sm leading-6 text-gray-600">
                This application is {application.status.toLowerCase()}.
                Further approval or rejection actions are unavailable.
              </p>
            </section>
          )}
        </div>

        {/* Approval and rejection controls */}
        <aside className="min-w-0">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-gray-950">
              Review decision
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-500">
              {isActionable
                ? "Choose how to proceed with this application."
                : "The review decision for this application has been completed."}
            </p>

            <div className="mt-5">
              <ApplicationActions
                applicationId={application.id}
                status={application.status}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}