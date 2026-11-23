import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getAuthorizationContext,
  getUserAssignmentDetails,
  PERMISSIONS,
} from "@/lib/rbac";
import {
  ActivateAssignmentButton,
  AssignRoleModal,
  AssignmentScopeBadge,
  AssignmentStatusBadge,
  DeactivateAssignmentModal,
  RevokeAssignmentModal,
} from "../assignment-components";

type UserAssignmentDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  "assignment-not-found": "Role assignment could not be found.",
  "revoked-terminal":
    "Permanently revoked assignments cannot be reactivated or modified.",
  "reason-required":
    "A revocation reason of at least 3 characters is required to revoke an assignment.",
  "reason-too-long": "Revocation reason must be 1,000 characters or fewer.",
  "activation-failed":
    "Could not activate role assignment. Ensure the user, role, and department are active.",
  "deactivation-failed": "Could not deactivate role assignment. Please try again.",
  "revocation-failed": "Could not revoke role assignment. Please try again.",
  "assignment-failed":
    "Failed to assign roles. Please check the inputs and try again.",
};

const successMessages: Record<string, string> = {
  assigned: "Role(s) assigned successfully.",
  activated: "Role assignment activated successfully.",
  deactivated: "Role assignment deactivated successfully.",
  revoked: "Role assignment permanently revoked.",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export default async function UserAssignmentDetailsPage({
  params,
  searchParams,
}: UserAssignmentDetailsPageProps) {
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

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const details = await getUserAssignmentDetails(organizationId, id);
  if (!details) {
    notFound();
  }

  const queryParams = await searchParams;
  const errorMessage = queryParams.error
    ? errorMessages[queryParams.error] ?? "An error occurred. Please try again."
    : null;
  const successMessage = queryParams.success
    ? successMessages[queryParams.success] ?? null
    : null;

  const { user, assignments, availableRoles, availableDepartments } = details;

  const activeAssignments = assignments.filter((a) => a.status === "ACTIVE");
  const pendingAssignments = assignments.filter(
    (a) => a.status === "PENDING_VERIFICATION",
  );
  const inactiveAssignments = assignments.filter((a) => a.status === "INACTIVE");
  const revokedAssignments = assignments.filter((a) => a.status === "REVOKED");

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
        <Link href="/organization/assignments" className="hover:text-slate-800">
          Role Assignments
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">{user.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {user.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                user.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-800"
                  : user.status === "SUSPENDED"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {user.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {user.email || user.pendingEmail || "No email on record"} &bull; Legacy role:{" "}
            <span className="font-mono text-xs font-medium text-slate-700">
              {user.legacyRole}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/organization/assignments"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            ← Back to Directory
          </Link>

          <AssignRoleModal
            fixedUser={{ id: user.id, name: user.name }}
            roles={availableRoles}
            departments={availableDepartments}
            returnTo={`/organization/assignments/${user.id}`}
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
            href={`/organization/assignments/${user.id}`}
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
            href={`/organization/assignments/${user.id}`}
            className="text-xs text-red-700 hover:underline font-semibold"
          >
            Dismiss
          </Link>
        </div>
      )}

      {/* User Information Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Member Profile
        </h2>

        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Account Status</dt>
            <dd className="mt-1 font-medium text-slate-800">{user.status}</dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Primary Department</dt>
            <dd className="mt-1 font-medium text-slate-800">
              {user.departmentName || (
                <span className="text-slate-400 italic">None assigned</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Active Roles</dt>
            <dd className="mt-1 font-semibold text-emerald-700">
              {activeAssignments.length} active assignment{activeAssignments.length === 1 ? "" : "s"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Member Since</dt>
            <dd className="mt-1 text-slate-700">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {/* Role Assignments Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Role Assignments ({assignments.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Current and historical role grants for this user. Permissions from multiple active roles are unioned with strict scope enforcement.
            </p>
          </div>

          <AssignRoleModal
            fixedUser={{ id: user.id, name: user.name }}
            roles={availableRoles}
            departments={availableDepartments}
            returnTo={`/organization/assignments/${user.id}`}
          />
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
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
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              No role assignments yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              This user does not currently hold any assigned roles. Assign a built-in or custom role to grant permissions.
            </p>
            <div className="mt-6">
              <AssignRoleModal
                fixedUser={{ id: user.id, name: user.name }}
                roles={availableRoles}
                departments={availableDepartments}
                returnTo={`/organization/assignments/${user.id}`}
                triggerButton={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-blue-800"
                  >
                    + Assign First Role
                  </button>
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Assignments List */}
            {activeAssignments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Active Role Grants ({activeAssignments.length})
                </h3>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-xs">
                  {activeAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-base">
                            {a.roleName}
                          </span>
                          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {a.roleSlug}
                          </span>
                          {a.roleType === "BUILT_IN" ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              Built-in
                            </span>
                          ) : (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                              Custom
                            </span>
                          )}
                          <AssignmentStatusBadge status={a.status} />
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <AssignmentScopeBadge
                            departmentName={a.departmentName}
                          />
                          <span>&bull;</span>
                          <span>
                            Assigned {formatDate(a.assignedAt)}
                            {a.assignedByName && ` by ${a.assignedByName}`}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <DeactivateAssignmentModal
                          assignmentId={a.id}
                          roleName={a.roleName}
                          userName={user.name}
                          userId={user.id}
                          returnTo={`/organization/assignments/${user.id}`}
                        />
                        <RevokeAssignmentModal
                          assignmentId={a.id}
                          roleName={a.roleName}
                          userName={user.name}
                          userId={user.id}
                          returnTo={`/organization/assignments/${user.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Verification Assignments List */}
            {pendingAssignments.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                  Pending Verification ({pendingAssignments.length})
                </h3>
                <div className="divide-y divide-slate-100 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
                  {pendingAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-base">
                            {a.roleName}
                          </span>
                          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {a.roleSlug}
                          </span>
                          <AssignmentStatusBadge status={a.status} />
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <AssignmentScopeBadge
                            departmentName={a.departmentName}
                          />
                          <span>&bull;</span>
                          <span>
                            Assigned {formatDate(a.assignedAt)}
                            {a.assignedByName && ` by ${a.assignedByName}`}
                          </span>
                        </div>
                        <p className="text-xs text-blue-700 italic">
                          Will activate automatically when user completes password setup and email verification.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <RevokeAssignmentModal
                          assignmentId={a.id}
                          roleName={a.roleName}
                          userName={user.name}
                          userId={user.id}
                          returnTo={`/organization/assignments/${user.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Assignments List */}
            {inactiveAssignments.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Inactive Assignments ({inactiveAssignments.length})
                </h3>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-xs">
                  {inactiveAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-amber-50/10"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-700 text-base">
                            {a.roleName}
                          </span>
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {a.roleSlug}
                          </span>
                          <AssignmentStatusBadge status={a.status} />
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <AssignmentScopeBadge
                            departmentName={a.departmentName}
                          />
                          <span>&bull;</span>
                          <span>
                            Assigned {formatDate(a.assignedAt)}
                            {a.assignedByName && ` by ${a.assignedByName}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <ActivateAssignmentButton
                          assignmentId={a.id}
                          userId={user.id}
                          returnTo={`/organization/assignments/${user.id}`}
                        />
                        <RevokeAssignmentModal
                          assignmentId={a.id}
                          roleName={a.roleName}
                          userName={user.name}
                          userId={user.id}
                          returnTo={`/organization/assignments/${user.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revoked Assignments History */}
            {revokedAssignments.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-red-800">
                  Permanently Revoked History ({revokedAssignments.length})
                </h3>
                <div className="divide-y divide-slate-100 rounded-xl border border-red-200 bg-red-50/20 shadow-xs">
                  {revokedAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-600 line-through text-base">
                            {a.roleName}
                          </span>
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {a.roleSlug}
                          </span>
                          <AssignmentStatusBadge status={a.status} />
                          <span className="text-xs text-red-700 font-semibold">
                            (Terminal)
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <AssignmentScopeBadge
                            departmentName={a.departmentName}
                          />
                          <span>&bull;</span>
                          <span>Originally assigned {formatDate(a.assignedAt)}</span>
                        </div>

                        {/* Revocation audit details */}
                        <div className="mt-2 rounded-lg bg-red-50 border border-red-100 p-2.5 text-xs text-red-900 space-y-1">
                          <div className="flex items-center gap-2 font-semibold">
                            <span>Revoked on {a.revokedAt ? formatDate(a.revokedAt) : "Unknown date"}</span>
                            {a.revokedByName && <span>by {a.revokedByName}</span>}
                          </div>
                          {a.revocationReason && (
                            <p className="italic text-red-800">
                              Reason: &ldquo;{a.revocationReason}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 cursor-not-allowed">
                          Revoked (Permanent)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
