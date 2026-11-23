import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAuthorizationContext, PERMISSIONS } from "@/lib/rbac";
import { createWorkflowAction } from "../actions";

type NewWorkflowPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  unauthorized: "You do not have permission to create approval workflows.",
  "organization-inactive": "Your organization is inactive. Workflow creation is unavailable.",
  "name-required": "Workflow name is required.",
  "name-too-long": "Workflow name must be 150 characters or fewer.",
  "type-too-long": "Workflow type must be 100 characters or fewer.",
  "description-too-long": "Description must be 1,000 characters or fewer.",
  "creation-failed": "Could not create approval workflow. Please try again.",
};

const COMMON_WORKFLOW_TYPES = [
  { value: "TRANSPORTATION_REQUEST", label: "Transportation Request Approval (Standard)" },
  { value: "VEHICLE_REQUISITION", label: "Vehicle Requisition & Assignment" },
  { value: "MAINTENANCE_APPROVAL", label: "Maintenance & Service Work Order" },
  { value: "FUEL_REQUISITION", label: "Fuel Requisition & Card Authorization" },
];

export default async function NewWorkflowPage({
  searchParams,
}: NewWorkflowPageProps) {
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
  const errorMessage = params.error
    ? errorMessages[params.error] || decodeURIComponent(params.error)
    : null;

  return (
    <main className="max-w-3xl space-y-6">
      {/* Back button & Page title */}
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
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Create Approval Workflow
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Define a new approval workflow for your organization. A draft version (Version 1) will be initialized, allowing you to configure ordered approval stages with ANY_ONE or ALL approver policies, assign role or user approvers, and validate policies before publishing.
        </p>
      </div>

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
        </div>
      )}

      {/* Workflow Creation Form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <form action={createWorkflowAction} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-slate-900 mb-1">
              Workflow Name <span className="text-red-600">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={150}
              placeholder="e.g. Standard Department Request Approval"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <p className="text-xs text-slate-500 mt-1">
              Descriptive name visible to administrators and approvers.
            </p>
          </div>

          <div>
            <label htmlFor="workflowType" className="block text-sm font-semibold text-slate-900 mb-1">
              Process / Workflow Type <span className="text-red-600">*</span>
            </label>
            <input
              id="workflowType"
              name="workflowType"
              type="text"
              required
              maxLength={100}
              defaultValue="TRANSPORTATION_REQUEST"
              list="workflow-type-suggestions"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <datalist id="workflow-type-suggestions">
              {COMMON_WORKFLOW_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-slate-500 mt-1">
              Identifier linking this workflow to the application business process (e.g. <code>TRANSPORTATION_REQUEST</code>).
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-slate-900 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={1000}
              placeholder="Describe what requests this workflow handles, required stages, or operational guidelines..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Lifecycle Notice */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              What happens next?
            </div>
            <p>
              Submitting this form initializes <strong>Version 1 (Draft)</strong>. You will be redirected to the workflow management interface where you can add ordered approval stages, configure approval policies (ANY_ONE or ALL), assign role and user approvers, and run publication validation.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <Link
              href="/organization/workflows"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create Workflow Draft
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
