import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAuthorizationContext, PERMISSIONS } from "@/lib/rbac";
import { validateWorkflowDraft } from "@/lib/workflow";
import {
  AddStageModal,
  ApprovalPolicyBadge,
  CreateDraftModal,
  DeleteStageModal,
  EditStageModal,
  EditWorkflowMetadataModal,
  PublishWorkflowModal,
  StageReorderButtons,
  VersionStatusBadge,
  WorkflowStatusBadge,
} from "../workflow-components";

type WorkflowDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    v?: string;
    error?: string;
    success?: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errorMessages: Record<string, string> = {
  unauthorized: "You do not have permission to manage this workflow.",
  "organization-inactive": "Your organization is inactive. Workflow management is unavailable.",
  "workflow-not-found": "The requested workflow was not found.",
  "version-not-found": "The specified workflow version was not found.",
  "stage-not-found": "The requested stage was not found.",
  "stage-name-required": "Stage name is required.",
  "stage-name-too-long": "Stage name must be 150 characters or fewer.",
  "approvers-required": "At least one approver (user or role) is required for each stage.",
  "version-immutable": "Cannot modify a published or archived workflow version. Create a new draft.",
  "already-published": "This workflow version is already published.",
  "stage-add-failed": "Could not add stage. Please check your inputs.",
  "stage-update-failed": "Could not update stage. Please check your inputs.",
  "stage-remove-failed": "Could not remove stage. Please try again.",
  "reorder-failed": "Could not reorder stages. Please try again.",
  "publish-failed": "Validation failed: Could not publish incomplete workflow.",
  "draft-creation-failed": "Could not create new draft version.",
};

const successMessages: Record<string, string> = {
  created: "Workflow created successfully.",
  "metadata-updated": "Workflow details updated successfully.",
  "stage-added": "Approval stage added successfully.",
  "stage-updated": "Approval stage updated successfully.",
  "stage-removed": "Approval stage removed and remaining stages re-sequenced.",
  "stage-moved": "Stage sequence updated.",
  published: "Workflow version published successfully.",
  "draft-created": "New draft version created.",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: WorkflowDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;
  if (!organizationId) {
    notFound();
  }

  const authContext = await getAuthorizationContext();
  if (!authContext || !authContext.hasPermission(PERMISSIONS.ORG_ROLES_MANAGE)) {
    notFound();
  }

  const { id: workflowId } = await params;
  if (!workflowId || !UUID_PATTERN.test(workflowId)) {
    notFound();
  }

  const search = await searchParams;

  // Query workflow with all versions and stages
  const workflow = await prisma.approvalWorkflow.findFirst({
    where: {
      id: workflowId,
      organizationId,
      deletedAt: null,
    },
    include: {
      createdBy: {
        select: { firstName: true, lastName: true, email: true },
      },
      currentVersion: {
        include: {
          stages: {
            orderBy: { stageOrder: "asc" },
            include: {
              approvers: {
                include: {
                  role: { select: { id: true, name: true, slug: true, scopeAllowed: true } },
                  user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
              },
            },
          },
          publishedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          stages: {
            orderBy: { stageOrder: "asc" },
            include: {
              approvers: {
                include: {
                  role: { select: { id: true, name: true, slug: true, scopeAllowed: true } },
                  user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
              },
            },
          },
          publishedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
      _count: {
        select: {
          instances: true,
        },
      },
    },
  });

  if (!workflow) {
    notFound();
  }

  // Fetch available users, roles, and non-platform permissions for approver selection
  const [availableUsers, availableRoles, availablePermissions] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
        role: { not: "SYSTEM_ADMINISTRATOR" },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        role: true,
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.organizationRole.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: [{ roleType: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        roleType: true,
        scopeAllowed: true,
        description: true,
      },
    }),
    prisma.permission.findMany({
      where: {
        isPlatformOnly: false,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        description: true,
      },
    }),
  ]);

  // Determine which version to view
  const requestedVersionId = search.v;
  let selectedVersion = requestedVersionId
    ? workflow.versions.find((v) => v.id === requestedVersionId)
    : undefined;

  // If no specific version requested, prioritize DRAFT if present, otherwise currentVersion, otherwise latest
  if (!selectedVersion) {
    selectedVersion =
      workflow.versions.find((v) => v.status === "DRAFT") ||
      workflow.currentVersion ||
      workflow.versions[0];
  }

  if (!selectedVersion) {
    notFound();
  }

  const isDraft = selectedVersion.status === "DRAFT";
  const isPublished = selectedVersion.status === "PUBLISHED";
  const isArchived = selectedVersion.status === "ARCHIVED";
  const existingDraftVersion = workflow.versions.find((v) => v.status === "DRAFT");

  // Validate draft version prior to publication
  let validationResult: { valid: boolean; errors: string[] } = { valid: false, errors: [] };
  if (isDraft) {
    validationResult = await validateWorkflowDraft({
      organizationId,
      versionId: selectedVersion.id,
    });
  }

  const errorMessage = search.error
    ? errorMessages[search.error] || decodeURIComponent(search.error)
    : null;
  const successMessage = search.success
    ? successMessages[search.success] || decodeURIComponent(search.success)
    : null;

  return (
    <main className="space-y-8">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/organization/workflows"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Approval Workflows
        </Link>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {workflow.name}
              </h1>
              <WorkflowStatusBadge status={workflow.status} />
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-700 border border-slate-200">
                {workflow.workflowType}
              </span>
            </div>
            {workflow.description && (
              <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                {workflow.description}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Created {formatDate(workflow.createdAt)}
              {workflow.createdBy && ` by ${workflow.createdBy.firstName} ${workflow.createdBy.lastName}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <EditWorkflowMetadataModal workflow={workflow} />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{successMessage}</span>
          </div>
          <Link
            href={`/organization/workflows/${workflow.id}?v=${selectedVersion.id}`}
            className="text-xs text-green-700 hover:underline font-semibold"
          >
            Dismiss
          </Link>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
          <Link
            href={`/organization/workflows/${workflow.id}?v=${selectedVersion.id}`}
            className="text-xs text-red-700 hover:underline font-semibold"
          >
            Dismiss
          </Link>
        </div>
      )}

      {/* Version Selector Tabs & Controls */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Workflow Versions ({workflow.versions.length})
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {workflow.versions.map((ver) => {
                const isSelected = ver.id === selectedVersion.id;
                return (
                  <Link
                    key={ver.id}
                    href={`/organization/workflows/${workflow.id}?v=${ver.id}`}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>Version {ver.versionNumber}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        ver.status === "PUBLISHED"
                          ? isSelected
                            ? "bg-emerald-500 text-white"
                            : "bg-emerald-100 text-emerald-800"
                          : ver.status === "DRAFT"
                            ? isSelected
                              ? "bg-blue-500 text-white"
                              : "bg-blue-100 text-blue-800"
                            : isSelected
                              ? "bg-slate-700 text-slate-200"
                              : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {ver.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isDraft && !existingDraftVersion && (
              <CreateDraftModal
                workflowId={workflow.id}
                fromVersionId={selectedVersion.id}
                fromVersionNumber={selectedVersion.versionNumber}
              />
            )}
            {!isDraft && existingDraftVersion && (
              <Link
                href={`/organization/workflows/${workflow.id}?v=${existingDraftVersion.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Go to Active Draft (v{existingDraftVersion.versionNumber}) →
              </Link>
            )}
          </div>
        </div>

        {/* Selected Version Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900 text-sm">
              Version {selectedVersion.versionNumber} Details
            </span>
            <VersionStatusBadge status={selectedVersion.status} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-500">
            <span>Stages: <strong className="text-slate-900">{selectedVersion.stages.length}</strong></span>
            <span>Created: <strong className="text-slate-900">{formatDate(selectedVersion.createdAt)}</strong></span>
            {selectedVersion.publishedAt && (
              <span>
                Published: <strong className="text-slate-900">{formatDate(selectedVersion.publishedAt)}</strong>
                {selectedVersion.publishedBy && ` by ${selectedVersion.publishedBy.firstName} ${selectedVersion.publishedBy.lastName}`}
              </span>
            )}
            {selectedVersion.archivedAt && (
              <span>Archived: <strong className="text-slate-900">{formatDate(selectedVersion.archivedAt)}</strong></span>
            )}
          </div>
        </div>
      </section>

      {/* Validation & Publishing Card (Shown for DRAFT) */}
      {isDraft && (
        <section
          className={`rounded-2xl border p-5 shadow-xs ${
            validationResult.valid
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-amber-200 bg-amber-50/50"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {validationResult.valid ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                )}
                <h3 className="text-sm font-bold text-slate-900">
                  {validationResult.valid
                    ? "Workflow is complete and ready to publish"
                    : "Draft validation requirements incomplete"}
                </h3>
              </div>

              {validationResult.valid ? (
                <p className="text-xs text-slate-600 pl-8">
                  All {selectedVersion.stages.length} stages have valid consecutive sequences, active approvers, and RBAC rules satisfied.
                </p>
              ) : (
                <ul className="list-disc list-inside text-xs text-amber-900 space-y-0.5 pl-8 pt-1">
                  {validationResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 pl-8 sm:pl-0">
              <PublishWorkflowModal
                workflowId={workflow.id}
                versionId={selectedVersion.id}
                versionNumber={selectedVersion.versionNumber}
                isValid={validationResult.valid}
                validationErrors={validationResult.errors}
              />
            </div>
          </div>
        </section>
      )}

      {/* Immutability Banner (Shown for PUBLISHED or ARCHIVED) */}
      {!isDraft && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 flex items-start gap-3">
          <svg className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              {isPublished
                ? "This version is published and strictly immutable."
                : "This version is archived and read-only."}
            </p>
            <p className="text-slate-500">
              To guarantee workflow execution auditability and prevent altering in-flight approvals, stages and approvers cannot be modified directly on published or archived versions. Use the <strong>"Create New Draft"</strong> button to clone this configuration into an editable draft.
            </p>
          </div>
        </div>
      )}

      {/* Approval Stages Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Approval Stages ({selectedVersion.stages.length})
            </h2>
            <p className="text-xs text-slate-500">
              Stages execute sequentially starting from Stage 1.
            </p>
          </div>

          {isDraft && (
            <AddStageModal
              workflowId={workflow.id}
              versionId={selectedVersion.id}
              users={availableUsers}
              roles={availableRoles}
              permissions={availablePermissions}
            />
          )}
        </div>

        {selectedVersion.stages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No approval stages configured</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Workflows require at least one approval stage before they can be published. Add your first approval stage above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedVersion.stages.map((stage, index) => {
              const isFirst = index === 0;
              const isLast = index === selectedVersion.stages.length - 1;

              return (
                <div
                  key={stage.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 transition hover:border-slate-300"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-bold text-white">
                          Stage {stage.stageOrder}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{stage.name}</h3>

                        {stage.isOptional ? (
                          <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Optional
                          </span>
                        ) : (
                          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            Mandatory
                          </span>
                        )}

                        <ApprovalPolicyBadge policy={stage.approvalPolicy} />

                        {stage.requiredPermissionCode && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">
                            Requires: {stage.requiredPermissionCode}
                          </span>
                        )}
                      </div>

                      {stage.description && (
                        <p className="text-xs text-slate-500 pl-8">{stage.description}</p>
                      )}
                    </div>

                    {isDraft && (
                      <div className="flex items-center gap-2 shrink-0">
                        <StageReorderButtons
                          workflowId={workflow.id}
                          versionId={selectedVersion.id}
                          stageId={stage.id}
                          isFirst={isFirst}
                          isLast={isLast}
                        />
                        <EditStageModal
                          workflowId={workflow.id}
                          versionId={selectedVersion.id}
                          stage={stage}
                          users={availableUsers}
                          roles={availableRoles}
                          permissions={availablePermissions}
                        />
                        <DeleteStageModal
                          workflowId={workflow.id}
                          versionId={selectedVersion.id}
                          stageId={stage.id}
                          stageName={stage.name}
                        />
                      </div>
                    )}
                  </div>

                  {/* Configured Approvers */}
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Eligible Approvers ({stage.approvers.length})
                    </h4>

                    {stage.approvers.length === 0 ? (
                      <p className="text-xs text-red-600 italic">
                        No approvers configured. At least one approver is required.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {stage.approvers.map((appr) => {
                          if (appr.approverType === "USER" && appr.user) {
                            return (
                              <div
                                key={appr.id}
                                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs"
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-[11px]">
                                  {appr.user.firstName?.[0] || "U"}
                                  {appr.user.lastName?.[0] || ""}
                                </span>
                                <div className="truncate">
                                  <p className="font-semibold text-slate-900 truncate">
                                    {[appr.user.firstName, appr.user.lastName].filter(Boolean).join(" ") || "User"}
                                  </p>
                                  <p className="text-[11px] text-slate-500 truncate">{appr.user.email || "No email"}</p>
                                </div>
                                <span className="ml-auto rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                                  User
                                </span>
                              </div>
                            );
                          }

                          if (appr.approverType === "ROLE" && appr.role) {
                            return (
                              <div
                                key={appr.id}
                                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs"
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                </span>
                                <div className="truncate">
                                  <p className="font-semibold text-slate-900 truncate">{appr.role.name}</p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {appr.role.scopeAllowed === "DEPARTMENT_ONLY"
                                      ? "Department-scoped"
                                      : "Organization-wide"}
                                  </p>
                                </div>
                                <span className="ml-auto rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                                  Role
                                </span>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
