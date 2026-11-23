import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getAuthorizationContext,
  getOrganizationRoleDetails,
  PERMISSIONS,
} from "@/lib/rbac";
import {
  ActivateRoleButton,
  DeactivateRoleModal,
} from "../role-components";

type RoleDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errorMessages: Record<string, string> = {
  "builtin-protected":
    "Built-in roles are protected system roles and cannot be edited, deactivated, or deleted.",
  "role-not-found": "Role could not be found.",
  "invalid-status": "Invalid status specified.",
  unauthorized: "You do not have permission to manage this role.",
  "status-update-failed": "Could not update role status. Please try again.",
};

const successMessages: Record<string, string> = {
  updated: "Role details and permissions updated successfully.",
  deactivated: "Role deactivated successfully.",
  reactivated: "Role reactivated successfully.",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function RoleDetailsPage({
  params,
  searchParams,
}: RoleDetailPageProps) {
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

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const role = await getOrganizationRoleDetails(organizationId, id);
  if (!role) {
    notFound();
  }

  const queryParams = await searchParams;
  const isBuiltIn = role.roleType === "BUILT_IN";
  const isActive = role.status === "ACTIVE";

  const errorMessage = queryParams.error ? errorMessages[queryParams.error] : null;
  const successMessage = queryParams.success
    ? successMessages[queryParams.success]
    : null;

  return (
    <main className="space-y-8 max-w-5xl">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs font-medium text-slate-500"
      >
        <Link href="/organization" className="hover:text-slate-800">
          Organization
        </Link>
        <span>/</span>
        <Link href="/organization/roles" className="hover:text-slate-800">
          Roles & Permissions
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">{role.name}</span>
      </nav>

      {/* Notification Banners */}
      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-600 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{successMessage}</span>
          </div>
        </div>
      )}

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

      {/* Header with Title, Badges, and Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {role.name}
            </h1>
            {isBuiltIn ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Built-in (Protected)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                Custom Role
              </span>
            )}
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Inactive
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {role.description || "No description provided for this role."}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {!isBuiltIn && (
            <>
              <Link
                href={`/organization/roles/${role.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none"
              >
                <svg
                  className="h-4 w-4 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
                Edit Role
              </Link>

              {isActive ? (
                <DeactivateRoleModal
                  roleId={role.id}
                  roleName={role.name}
                  assignedUsersCount={role.assignedUsersCount}
                  returnTo={`/organization/roles/${role.id}`}
                  triggerButtonClassName="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 hover:border-red-300"
                />
              ) : (
                <ActivateRoleButton
                  roleId={role.id}
                  returnTo={`/organization/roles/${role.id}`}
                  className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Built-in Protection Notice */}
      {isBuiltIn && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-blue-600 mt-0.5 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0v2h2V7a5 5 0 00-5-5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-semibold text-blue-900">Protected Built-in Role</p>
              <p className="mt-0.5 text-xs text-blue-800 leading-relaxed">
                This is a core system role with baseline functional permissions defined by the platform. It cannot be renamed, edited, deactivated, or deleted. Organizations may assign users to this role but cannot alter its baseline configuration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Role Metadata Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Role Details
        </h2>

        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Role Slug</dt>
            <dd className="mt-1 font-mono text-xs text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block">
              {role.slug}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Scope Allowed</dt>
            <dd className="mt-1 font-medium text-slate-800">
              {role.scopeAllowed === "ORGANIZATION_ONLY"
                ? "Organization-wide only"
                : role.scopeAllowed === "DEPARTMENT_ONLY"
                  ? "Department-scoped only"
                  : "Organization or Department"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Assigned Users</dt>
            <dd className="mt-1 font-semibold text-slate-900 flex items-center gap-2">
              <span>{role.assignedUsersCount} active user{role.assignedUsersCount === 1 ? "" : "s"}</span>
              <Link
                href={`/organization/assignments?role=${role.id}`}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                (View)
              </Link>
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Created Date</dt>
            <dd className="mt-1 text-slate-700">{formatDate(role.createdAt)}</dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Last Updated</dt>
            <dd className="mt-1 text-slate-700">{formatDate(role.updatedAt)}</dd>
          </div>

          {role.createdBy && (
            <div>
              <dt className="text-xs font-medium text-slate-500">Created By</dt>
              <dd className="mt-1 text-slate-700">
                {[role.createdBy.firstName, role.createdBy.lastName].filter(Boolean).join(" ") ||
                  role.createdBy.email ||
                  "Administrator"}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Granted Permissions List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Granted Permissions ({role.permissions.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Functional capabilities granted to users holding this role, organized by module.
            </p>
          </div>
        </div>

        {role.permissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No permissions are currently granted to this role.
          </div>
        ) : (
          <div className="space-y-6">
            {role.groupedPermissions.map((group) => (
              <section
                key={group.category}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
              >
                {/* Category Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3">
                  <span className="font-semibold text-slate-900 text-sm">
                    {group.category}
                  </span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {group.permissions.length} granted
                  </span>
                </div>

                {/* Permissions Grid */}
                <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
                  {group.permissions.map((perm) => (
                    <div
                      key={perm.code}
                      className="flex items-start gap-3 bg-white p-4"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {perm.name}
                          </span>
                          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {perm.code}
                          </span>
                        </div>
                        {perm.description && (
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                            {perm.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
