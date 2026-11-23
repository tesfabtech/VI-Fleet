import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getAuthorizationContext,
  getGroupedPermissionCatalog,
  PERMISSIONS,
} from "@/lib/rbac";
import { createRole } from "../actions";
import { PermissionSelector } from "../role-components";

type NewRolePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "name-required": "Enter a role name.",
  "name-too-long": "Role name must be 150 characters or fewer.",
  "description-too-long": "Description must be 1,000 characters or fewer.",
  "duplicate-name": "A role with that name already exists in your organization.",
  "reserved-name": "That role name is reserved for system built-in roles.",
  "invalid-permissions": "One or more selected permissions are invalid.",
  "platform-permission-rejected":
    "Platform-only permissions cannot be assigned to organization roles.",
  unauthorized: "You do not have permission to create organization roles.",
  "creation-failed": "Could not create custom role. Check your inputs and try again.",
};

export default async function NewCustomRolePage({
  searchParams,
}: NewRolePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;
  if (!organizationId) {
    notFound();
  }

  const authContext = await getAuthorizationContext();
  if (
    !authContext ||
    !authContext.hasPermission(PERMISSIONS.ORG_ROLES_MANAGE)
  ) {
    notFound();
  }

  const params = await searchParams;
  const groups = await getGroupedPermissionCatalog();
  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <main className="space-y-6 max-w-5xl">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/organization" className="hover:text-slate-800">
          Organization
        </Link>
        <span>/</span>
        <Link href="/organization/roles" className="hover:text-slate-800">
          Roles & Permissions
        </Link>
        <span>/</span>
        <span className="text-slate-800">Create Custom Role</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Create Custom Role
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Define a new custom organization role and select which functional permissions it grants to members.
        </p>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-red-600 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Creation Form */}
      <form action={createRole} className="space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Role Information
          </h2>

          <div className="space-y-4 max-w-2xl">
            {/* Role Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-900"
              >
                Role Name <span className="text-red-500">*</span>
              </label>
              <p className="mt-0.5 text-xs text-slate-500">
                Choose a descriptive name. Must be unique within your organization.
              </p>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={150}
                placeholder="e.g. Fleet Operations Assistant"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-slate-900"
              >
                Description <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </label>
              <p className="mt-0.5 text-xs text-slate-500">
                Briefly describe the responsibilities and scope of this role.
              </p>
              <textarea
                id="description"
                name="description"
                rows={3}
                maxLength={1000}
                placeholder="e.g. Coordinates day-to-day vehicle inspections and logs fuel consumption records."
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
        </section>

        {/* Permissions Configuration */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Configure Role Permissions
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select permissions from the official catalog to grant to members assigned this role. Platform-only permissions are excluded.
            </p>
          </div>

          <PermissionSelector groups={groups} />
        </section>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
          <Link
            href="/organization/roles"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            Create Role
          </button>
        </div>
      </form>
    </main>
  );
}
