import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WorkflowStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAuthorizationContext, PERMISSIONS } from "@/lib/rbac";
import {
  VersionStatusBadge,
  WorkflowStatusBadge,
} from "./workflow-components";

type WorkflowsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    q?: string;
    type?: string;
    status?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  unauthorized: "You do not have permission to manage approval workflows.",
  "organization-inactive": "Your organization is inactive. Workflow management is unavailable.",
  "workflow-not-found": "The requested approval workflow could not be found.",
  "name-required": "Workflow name is required.",
  "creation-failed": "Could not create approval workflow. Please try again.",
  "immutable-version": "Cannot modify a published or archived workflow version.",
};

const successMessages: Record<string, string> = {
  created: "Workflow draft created successfully.",
  "metadata-updated": "Workflow details updated successfully.",
  published: "Workflow version published successfully.",
  "draft-created": "New draft version created from published workflow.",
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

export default async function WorkflowsDirectoryPage({
  searchParams,
}: WorkflowsPageProps) {
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

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const typeFilter = params.type?.trim() || undefined;
  const statusFilter =
    params.status === "ACTIVE" || params.status === "INACTIVE"
      ? (params.status as WorkflowStatus)
      : undefined;

  const [allOrgWorkflows, workflows] = await Promise.all([
    prisma.approvalWorkflow.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        workflowType: true,
        status: true,
        currentVersionId: true,
        versions: {
          where: { status: "DRAFT" },
          select: { id: true },
        },
      },
    }),
    prisma.approvalWorkflow.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { workflowType: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(typeFilter ? { workflowType: typeFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        currentVersion: {
          include: {
            stages: { orderBy: { stageOrder: "asc" } },
            publishedBy: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            stages: { orderBy: { stageOrder: "asc" } },
          },
        },
        _count: {
          select: {
            instances: true,
          },
        },
      },
    }),
  ]);

  // Calculate organization-wide summary metrics (independent of active search and filters)
  const totalWorkflows = allOrgWorkflows.length;
  const activeWorkflows = allOrgWorkflows.filter((w) => w.status === "ACTIVE").length;
  const publishedWorkflows = allOrgWorkflows.filter((w) => w.currentVersionId !== null).length;
  const workflowsWithDraft = allOrgWorkflows.filter((w) => w.versions.length > 0).length;

  // Extract distinct workflow types across the organization so users can switch types directly
  const distinctTypes = Array.from(new Set(allOrgWorkflows.map((w) => w.workflowType))).sort();

  const errorMessage = params.error
    ? errorMessages[params.error] || decodeURIComponent(params.error)
    : null;
  const successMessage = params.success
    ? successMessages[params.success] || decodeURIComponent(params.success)
    : null;

  const isFiltered = Boolean(query || typeFilter || statusFilter);

  return (
    <main className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Approval Workflows
            </h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {isFiltered ? `${workflows.length} of ${totalWorkflows} Filtered` : `${totalWorkflows} Configured`}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Configure ordered approval stages with ANY_ONE or ALL policies, assign role and user approvers, and manage published workflow versions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/organization/workflows/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Approval Workflow
          </Link>
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
          <Link href="/organization/workflows" className="text-xs text-green-700 hover:underline font-semibold">
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
          <Link href="/organization/workflows" className="text-xs text-red-700 hover:underline font-semibold">
            Dismiss
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Workflows
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {totalWorkflows}
          </p>
          <p className="mt-1 text-xs text-slate-500">Configured in organization</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Workflows
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {activeWorkflows}
          </p>
          <p className="mt-1 text-xs text-slate-500">Available for execution</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Published Versions
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600">
            {publishedWorkflows}
          </p>
          <p className="mt-1 text-xs text-slate-500">With active published version</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Workflows In Draft
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {workflowsWithDraft}
          </p>
          <p className="mt-1 text-xs text-slate-500">Unpublished draft versions</p>
        </div>
      </section>

      {/* Search and Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <form
          method="GET"
          action="/organization/workflows"
          className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="relative flex-1 max-w-md">
            <label htmlFor="workflow-search" className="sr-only">
              Search workflows
            </label>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              id="workflow-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by workflow name, type, or description..."
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="filter-type" className="sr-only">
                Filter by Type
              </label>
              <select
                id="filter-type"
                name="type"
                defaultValue={typeFilter ?? ""}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">All Workflow Types</option>
                {distinctTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-status" className="sr-only">
                Filter by Status
              </label>
              <select
                id="filter-status"
                name="status"
                defaultValue={statusFilter ?? ""}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
            >
              Filter
            </button>

            {isFiltered && (
              <Link
                href="/organization/workflows"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
              >
                Clear Filters
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* Directory Table */}
      {workflows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            No approval workflows found
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {isFiltered
              ? "No workflows match your search or filter criteria. Try adjusting or clearing your filters."
              : "Get started by creating your organization's first approval workflow."}
          </p>
          <div className="mt-6">
            {isFiltered ? (
              <Link
                href="/organization/workflows"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Reset filters
              </Link>
            ) : (
              <Link
                href="/organization/workflows/new"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                + Create Approval Workflow
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Workflow
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Published Version
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Draft Status
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center">
                    Instances
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workflows.map((wf) => {
                  const draftVersion = wf.versions.find((v) => v.status === "DRAFT");
                  const publishedVersion = wf.currentVersion;

                  return (
                    <tr key={wf.id} className="transition-colors hover:bg-slate-50/70">
                      {/* Name & Description */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <Link
                            href={`/organization/workflows/${wf.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                          >
                            {wf.name}
                          </Link>
                          {wf.description && (
                            <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {wf.description}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 mt-1">
                            Created {formatDate(wf.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Workflow Type */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-mono font-medium text-slate-700 border border-slate-200">
                          {wf.workflowType}
                        </span>
                      </td>

                      {/* Workflow Status */}
                      <td className="px-6 py-4">
                        <WorkflowStatusBadge status={wf.status} />
                      </td>

                      {/* Current Published Version */}
                      <td className="px-6 py-4">
                        {publishedVersion ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 text-xs">
                                Version {publishedVersion.versionNumber}
                              </span>
                              <VersionStatusBadge status="PUBLISHED" />
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {publishedVersion.stages.length} stage{publishedVersion.stages.length === 1 ? "" : "s"} • Published {formatDate(publishedVersion.publishedAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            No published version
                          </span>
                        )}
                      </td>

                      {/* Draft Status */}
                      <td className="px-6 py-4">
                        {draftVersion ? (
                          <div className="flex items-center gap-1.5">
                            <VersionStatusBadge status="DRAFT" />
                            <span className="text-xs text-slate-700 font-medium">
                              v{draftVersion.versionNumber} ({draftVersion.stages.length} stages)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">None active</span>
                        )}
                      </td>

                      {/* Total Instances */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700">
                          {wf._count.instances}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/organization/workflows/${wf.id}${draftVersion ? `?v=${draftVersion.id}` : ""}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            {draftVersion ? "Edit Draft" : "Manage"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
