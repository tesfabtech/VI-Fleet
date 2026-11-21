import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOfficialDocumentSignedUrl } from "@/lib/organization-application/document-service";
import ApplicationActions from "./application-actions";

function formatOrgType(type: string | null): string {
  switch (type) {
    case "PRIVATE_COMPANY":
      return "Private Company";
    case "GOVERNMENT":
      return "Government";
    case "NGO":
      return "NGO";
    case "OTHER":
      return "Other";
    default:
      return type || "Not specified";
  }
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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

  // Verify requester is a System Administrator before proceeding
  const session = await auth();
  if (!session?.user || session.user.role !== "SYSTEM_ADMINISTRATOR") {
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
      organizationType: true,
      website: true,
      country: true,
      region: true,
      city: true,
      streetAddress: true,
      departmentCount: true,
      estimatedFleetSize: true,
      officialDocumentKey: true,
      officialDocumentFileName: true,
      officialDocumentMimeType: true,
      officialDocumentSize: true,
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

  // Generate short-lived signed URLs for the official document on the server
  let documentViewUrl: string | null = null;
  let documentDownloadUrl: string | null = null;

  if (application.officialDocumentKey) {
    try {
      documentViewUrl = await getOfficialDocumentSignedUrl(
        application.officialDocumentKey,
        { expiresIn: 900 },
      );
      documentDownloadUrl = await getOfficialDocumentSignedUrl(
        application.officialDocumentKey,
        {
          expiresIn: 900,
          download:
            application.officialDocumentFileName || "official-document",
        },
      );
    } catch (error) {
      console.error("Failed to generate official document signed URL:", error);
    }
  }

  const statusStyles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-800",
    UNDER_REVIEW: "bg-blue-50 text-blue-800",
    APPROVED: "bg-green-50 text-green-800",
    REJECTED: "bg-red-50 text-red-800",
  };

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
              Review the submitted organization information and official document before approval.
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
        {/* Application details */}
        <div className="space-y-6">
          {/* Section: Organization Profile */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="font-semibold text-gray-950">
                Organization Profile
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Primary organization profile and fleet specifications.
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-6 px-6 py-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization Name
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 break-words">
                  {application.organizationName}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization Type
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatOrgType(application.organizationType)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estimated Fleet Size
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.estimatedFleetSize
                    ? `${application.estimatedFleetSize} vehicles`
                    : "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department Count
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.departmentCount !== null &&
                  application.departmentCount !== undefined
                    ? application.departmentCount
                    : "Not specified"}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Website
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 break-all">
                  {application.website ? (
                    <a
                      href={
                        application.website.startsWith("http")
                          ? application.website
                          : `https://${application.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:text-blue-800 underline inline-flex items-center gap-1"
                    >
                      {application.website} ↗
                    </a>
                  ) : (
                    "Not provided"
                  )}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organization Description
              </h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-gray-600">
                {application.description || "No description provided."}
              </p>
            </div>
          </section>

          {/* Section: Contact & Location */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="font-semibold text-gray-950">
                Contact & Location
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Onboarding contact details and registered physical address.
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-6 px-6 py-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Email
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 break-all">
                  {application.contactEmail}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone Number
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.phone || "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.country || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Region / State
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.region || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  City
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.city || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Street Address
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 break-words">
                  {application.streetAddress || "Not provided"}
                </p>
              </div>
            </div>
          </section>

          {/* Section: Official Organization Document */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="font-semibold text-gray-950">
                Official Organization Document
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Submitted registration license or verification certificate.
              </p>
            </div>

            <div className="p-6">
              {application.officialDocumentKey ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white font-bold text-sm">
                        DOC
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {application.officialDocumentFileName || "Official Document"}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {application.officialDocumentMimeType || "Document"} •{" "}
                          {formatFileSize(application.officialDocumentSize)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {documentViewUrl ? (
                        <a
                          href={documentViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition"
                        >
                          View document ↗
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Preview unavailable
                        </span>
                      )}

                      {documentDownloadUrl && (
                        <a
                          href={documentDownloadUrl}
                          download={
                            application.officialDocumentFileName ||
                            "official-document"
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                        >
                          Download ↓
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
                  <p className="text-sm text-gray-500">
                    No official document uploaded (legacy application or document not provided).
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Section: Application Submission & Payment Metadata */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="font-semibold text-gray-950">
                Application Status & Submission
              </h2>
            </div>

            <div className="grid gap-x-8 gap-y-4 px-6 py-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.paymentStatus.replaceAll("_", " ")}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization Code
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.organization?.code ?? "Not assigned"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted At
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.submittedAt.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Reviewed At
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {application.reviewedAt?.toLocaleString() ?? "Not reviewed"}
                </p>
              </div>
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
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
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
