import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RoleStatus, RoleType } from "@prisma/client";
import { auth } from "@/auth";
import {
  getAuthorizationContext,
  getOrganizationRoles,
  PERMISSIONS,
} from "@/lib/rbac";
import { ActivateRoleButton, DeactivateRoleModal } from "./role-components";

type RolesPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    q?: string;
    type?: string;
    status?: string;
    sort?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "name-required": "Role name is required.",
  "name-too-long": "Role name must be 150 characters or fewer.",
  "description-too-long": "Role description must be 1,000 characters or fewer.",
  "duplicate-name": "A role with that name already exists in your organization.",
  "reserved-name": "That role name is reserved for system built-in roles.",
  "role-not-found": "The requested role could not be found.",
  "builtin-protected":
    "Built-in roles are protected system roles and cannot be edited, deactivated, or deleted.",
  "invalid-permissions": "One or more selected permissions are invalid or unknown.",
  "platform-permission-rejected":
    "Platform-only permissions cannot be assigned to organization roles.",
  unauthorized: "You do not have permission to manage organization roles.",
  "organization-inactive":
    "Your organization is inactive. Role management is currently unavailable.",
  "creation-failed": "Could not create custom role. Please verify your inputs.",
  "update-failed": "Could not update custom role. Please try again.",
  "status-update-failed": "Could not change role status. Please try again.",
};

const successMessages: Record<string, string> = {
  created: "Custom role created successfully.",
  updated: "Role information and permissions updated successfully.",
  deactivated: "Custom role deactivated successfully.",
  reactivated: "Custom role reactivated successfully.",
};

export default async function OrganizationRolesPage({
  searchParams,
}: RolesPageProps) {
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
  const query = params.q?.trim() ?? "";
  const typeFilter =
    params.type === "BUILT_IN" || params.type === "CUSTOM"
      ? (params.type as RoleType)
      : undefined;
  const statusFilter =
    params.status === "ACTIVE" || params.status === "INACTIVE"
      ? (params.status as RoleStatus)
      : undefined;
  const sort =
    params.sort === "users" ||
    params.sort === "permissions" ||
    params.sort === "newest"
      ? params.sort
      : "name";

  const allRoles = await getOrganizationRoles(organizationId);

  // Filtered roles based on search and parameters
  const filteredRoles = await getOrganizationRoles(organizationId, {
    query,
    typeFilter,
    statusFilter,
    sort,
  });

  // Calculate summary KPI stats
  const totalRolesCount = allRoles.length;
  const builtInRolesCount = allRoles.filter(
    (r) => r.roleType === "BUILT_IN",
  ).length;
  const customRolesCount = allRoles.filter((r) => r.roleType === "CUSTOM").length;
  const activeRolesCount = allRoles.filter((r) => r.status === "ACTIVE").length;

  const errorMessage = params.error
    ? errorMessages[params.error] ?? "An error occurred. Please try again."
    : null;
  const successMessage = params.success
    ? successMessages[params.success] ?? null
    : null;

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Roles & Permissions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            View system built-in roles and configure custom roles and permission sets for your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/organization/assignments"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
              />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
            Role Assignments
          </Link>
          <Link
            href="/organization/roles/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Custom Role
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
          <Link
            href="/organization/roles"
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
          <Link
            href="/organization/roles"
            className="text-xs text-red-700 hover:underline font-semibold"
          >
            Dismiss
          </Link>
        </div>
      )}

      {/* KPI Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-sm font-medium text-slate-500">Total Roles</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{totalRolesCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-sm font-medium text-slate-500">Built-in Roles</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{builtInRolesCount}</span>
            <span className="text-xs text-slate-500 font-medium">(protected)</span>
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-sm font-medium text-slate-500">Custom Roles</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">{customRolesCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-sm font-medium text-slate-500">Active Roles</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{activeRolesCount}</p>
        </article>
      </section>

      {/* Filter and Search Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <form method="GET" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <label htmlFor="q" className="sr-only">
              Search roles
            </label>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </div>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search by role name or description..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Role Type Filter */}
            <select
              name="type"
              defaultValue={params.type ?? "ALL"}
              aria-label="Filter by role type"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All Types</option>
              <option value="BUILT_IN">Built-in Roles</option>
              <option value="CUSTOM">Custom Roles</option>
            </select>

            {/* Status Filter */}
            <select
              name="status"
              defaultValue={params.status ?? "ALL"}
              aria-label="Filter by role status"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            {/* Sort */}
            <select
              name="sort"
              defaultValue={sort}
              aria-label="Sort roles"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="name">Name (A-Z)</option>
              <option value="users">Most Assigned Users</option>
              <option value="permissions">Most Permissions</option>
              <option value="newest">Recently Created</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 focus:outline-none"
            >
              Filter
            </button>

            {(query || params.type || params.status || params.sort) && (
              <Link
                href="/organization/roles"
                className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline px-1"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* Roles Directory Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {filteredRoles.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              No roles found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {query || params.type || params.status
                ? "No roles match your search or filter criteria. Try clearing filters."
                : "No custom roles have been created yet. Create custom roles to tailor permissions for your organization members."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {(query || params.type || params.status) && (
                <Link
                  href="/organization/roles"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear filters
                </Link>
              )}
              <Link
                href="/organization/roles/new"
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Create Custom Role
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Role Name
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center">
                    Permissions
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center">
                    Assigned Users
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRoles.map((role) => {
                  const isBuiltIn = role.roleType === "BUILT_IN";
                  const isActive = role.status === "ACTIVE";

                  return (
                    <tr
                      key={role.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Name & Description */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/organization/roles/${role.id}`}
                              className="font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {role.name}
                            </Link>
                            {isBuiltIn && (
                              <span
                                title="Protected built-in role"
                                className="text-slate-400"
                              >
                                <svg
                                  className="h-3.5 w-3.5 text-slate-500"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0v2h2V7a5 5 0 00-5-5z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                            )}
                          </div>
                          {role.description ? (
                            <p className="mt-1 line-clamp-1 text-xs text-slate-500 max-w-md">
                              {role.description}
                            </p>
                          ) : (
                            <span className="mt-1 text-xs text-slate-400 italic">
                              No description provided
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role Type Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isBuiltIn ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            Built-in
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                            Custom
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      </td>

                      {/* Permission Count */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {role.permissionCount} permission{role.permissionCount === 1 ? "" : "s"}
                        </span>
                      </td>

                      {/* Assigned Users Count */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-700">
                          {role.assignedUsersCount} user{role.assignedUsersCount === 1 ? "" : "s"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/organization/roles/${role.id}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          >
                            Details
                          </Link>

                          {!isBuiltIn && (
                            <>
                              <Link
                                href={`/organization/roles/${role.id}/edit`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-300"
                              >
                                Edit
                              </Link>

                              {isActive ? (
                                <DeactivateRoleModal
                                  roleId={role.id}
                                  roleName={role.name}
                                  assignedUsersCount={role.assignedUsersCount}
                                  returnTo="/organization/roles"
                                />
                              ) : (
                                <ActivateRoleButton
                                  roleId={role.id}
                                  returnTo="/organization/roles"
                                />
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
