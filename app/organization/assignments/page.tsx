import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RoleAssignmentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getAuthorizationContext,
  getOrganizationUserAssignments,
  PERMISSIONS,
} from "@/lib/rbac";
import {
  AssignRoleModal,
  AssignmentScopeBadge,
  AssignmentStatusBadge,
} from "./assignment-components";

type AssignmentsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    q?: string;
    role?: string;
    department?: string;
    status?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  unauthorized: "You do not have permission to manage user role assignments.",
  "user-not-found": "The requested user could not be found in your organization.",
  "user-suspended": "Cannot assign roles to a suspended user account.",
  "role-required": "Select at least one role to assign.",
  "duplicate-assignment":
    "The user already has an active assignment for this role and scope.",
  "driver-profile-missing":
    "An active Driver role requires an active driver profile linked to this user.",
  "department-required":
    "The selected role requires a department scope. Please select a department.",
  "org-only-scope": "The selected role permits organization-wide scope only.",
  "role-inactive": "The selected role is inactive and cannot be assigned.",
  "dept-inactive": "The selected department is inactive.",
  "invalid-department":
    "The selected department was not found in your organization.",
  "assignment-failed":
    "Failed to assign roles. Please check the inputs and try again.",
  "organization-inactive":
    "Your organization is inactive. Role assignment is currently unavailable.",
};

const successMessages: Record<string, string> = {
  assigned: "Role(s) assigned successfully.",
  activated: "Role assignment activated successfully.",
  deactivated: "Role assignment deactivated successfully.",
  revoked: "Role assignment permanently revoked.",
};

export default async function AssignmentsDirectoryPage({
  searchParams,
}: AssignmentsPageProps) {
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
    !authContext.hasPermission(PERMISSIONS.ORG_ROLES_ASSIGN)
  ) {
    notFound();
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const roleFilter = params.role?.trim() || undefined;
  const departmentFilter = params.department?.trim() || undefined;
  const statusFilter =
    params.status === "ACTIVE" ||
    params.status === "PENDING_VERIFICATION" ||
    params.status === "INACTIVE" ||
    params.status === "REVOKED"
      ? (params.status as RoleAssignmentStatus)
      : undefined;

  // Fetch directory listing with filters
  const [{ users, stats }, availableRoles, availableDepartments] =
    await Promise.all([
      getOrganizationUserAssignments(organizationId, {
        query,
        roleId: roleFilter,
        departmentId: departmentFilter,
        status: statusFilter,
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
      prisma.department.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
          deletedAt: null,
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

  const userOptions = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    legacyRole: u.legacyRole,
  }));

  const errorMessage = params.error
    ? errorMessages[params.error] ?? "An error occurred. Please try again."
    : null;
  const successMessage = params.success
    ? successMessages[params.success] ?? null
    : null;

  const isFiltered = Boolean(query || roleFilter || departmentFilter || statusFilter);

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Role Assignments
            </h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {stats.totalUsers} Members
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Manage user role assignments, configure organization-wide or department-level scope, and manage assignment lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/organization/roles"
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Roles Catalog
          </Link>

          <AssignRoleModal
            users={userOptions}
            roles={availableRoles}
            departments={availableDepartments}
            returnTo="/organization/assignments"
          />
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
            href="/organization/assignments"
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
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
          <Link
            href="/organization/assignments"
            className="text-xs text-red-700 hover:underline font-semibold"
          >
            Dismiss
          </Link>
        </div>
      )}

      {/* KPI Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Users
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {stats.totalUsers}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {stats.usersWithActiveRoles} user{stats.usersWithActiveRoles === 1 ? "" : "s"} holding active roles
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Assignments
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {stats.totalActiveAssignments}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Active role grants in effect
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pending Verification
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600">
            {stats.totalPendingAssignments}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Awaiting recipient email confirmation
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Inactive & Revoked
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-600">
              {stats.totalInactiveAssignments}
            </span>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-lg font-semibold tracking-tight text-red-600">
              {stats.totalRevokedAssignments} revoked
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Suspended or permanently revoked
          </p>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <form
          method="GET"
          action="/organization/assignments"
          className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <label htmlFor="user-search" className="sr-only">
              Search users
            </label>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-4 w-4 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              id="user-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by name, email, or phone..."
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Role Filter */}
            <div>
              <label htmlFor="filter-role" className="sr-only">
                Filter by Role
              </label>
              <select
                id="filter-role"
                name="role"
                defaultValue={roleFilter ?? ""}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">All Roles</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label htmlFor="filter-dept" className="sr-only">
                Filter by Department
              </label>
              <select
                id="filter-dept"
                name="department"
                defaultValue={departmentFilter ?? ""}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">All Departments</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
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
                <option value="PENDING_VERIFICATION">Pending Verification</option>
                <option value="INACTIVE">Inactive</option>
                <option value="REVOKED">Revoked</option>
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
                href="/organization/assignments"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
              >
                Clear Filters
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* Users Directory Table */}
      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            No organization users found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {isFiltered
              ? "No users match your selected filters. Try broadening your search or resetting filters."
              : "No organization members are currently registered."}
          </p>
          {isFiltered && (
            <div className="mt-4">
              <Link
                href="/organization/assignments"
                className="text-sm font-semibold text-blue-700 hover:underline"
              >
                Reset all filters
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Department
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Role Assignments
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center">
                    Active Roles
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const activeAssignments = u.assignments.filter(
                    (a) => a.status === "ACTIVE",
                  );
                  const otherAssignments = u.assignments.filter(
                    (a) => a.status !== "ACTIVE",
                  );

                  return (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      {/* User Info */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <Link
                            href={`/organization/assignments/${u.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                          >
                            {u.name}
                          </Link>
                          <span className="text-xs text-slate-500">
                            {u.email || u.pendingEmail || "No email"}
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {u.legacyRole}
                            </span>
                            {u.status !== "ACTIVE" && (
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${
                                  u.status === "SUSPENDED"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {u.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Primary Department */}
                      <td className="px-6 py-4">
                        {u.departmentName ? (
                          <span className="font-medium text-slate-800">
                            {u.departmentName}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            None assigned
                          </span>
                        )}
                      </td>

                      {/* Role Assignments Badges */}
                      <td className="px-6 py-4">
                        {u.assignments.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">
                            No roles assigned
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1.5 max-w-md">
                            {/* Active Assignments */}
                            {activeAssignments.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center gap-1.5 flex-wrap"
                              >
                                <span className="font-medium text-slate-900 text-xs">
                                  {a.roleName}
                                </span>
                                <AssignmentScopeBadge
                                  departmentName={a.departmentName}
                                />
                                <AssignmentStatusBadge status={a.status} />
                              </div>
                            ))}

                            {/* Other (Inactive / Pending / Revoked) Assignments */}
                            {otherAssignments.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center gap-1.5 flex-wrap opacity-75"
                              >
                                <span className="text-slate-700 text-xs line-through decoration-slate-400">
                                  {a.roleName}
                                </span>
                                <AssignmentScopeBadge
                                  departmentName={a.departmentName}
                                />
                                <AssignmentStatusBadge status={a.status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Active Count */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
                            u.activeAssignmentCount > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {u.activeAssignmentCount}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/organization/assignments/${u.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            Manage Roles
                          </Link>

                          <AssignRoleModal
                            fixedUser={{ id: u.id, name: u.name }}
                            roles={availableRoles}
                            departments={availableDepartments}
                            returnTo="/organization/assignments"
                            triggerButton={
                              <button
                                type="button"
                                className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                + Assign
                              </button>
                            }
                          />
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
