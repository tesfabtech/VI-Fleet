"use client";

import { useId, useMemo, useState } from "react";
import { RoleAssignmentStatus, RoleScopeAllowed, RoleType } from "@prisma/client";
import {
  activateAssignmentAction,
  assignRolesAction,
  deactivateAssignmentAction,
  revokeAssignmentAction,
} from "./actions";

// ============================================================
// BADGE COMPONENTS
// ============================================================

export function AssignmentStatusBadge({ status }: { status: RoleAssignmentStatus }) {
  switch (status) {
    case "ACTIVE":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Active
        </span>
      );
    case "PENDING_VERIFICATION":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 border border-blue-200">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          Pending Verification
        </span>
      );
    case "INACTIVE":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
          Inactive
        </span>
      );
    case "REVOKED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800 border border-red-200">
          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
          Revoked
        </span>
      );
    default:
      return null;
  }
}

export function AssignmentScopeBadge({
  departmentName,
}: {
  departmentName: string | null;
}) {
  if (departmentName) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
        <svg
          className="h-3 w-3 text-indigo-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        Dept: {departmentName}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
      <svg
        className="h-3 w-3 text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
        />
      </svg>
      Organization-wide
    </span>
  );
}

// ============================================================
// ASSIGN ROLES MODAL
// ============================================================

interface RoleOption {
  id: string;
  name: string;
  slug: string;
  roleType: RoleType;
  scopeAllowed: RoleScopeAllowed;
  description: string | null;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string | null;
  legacyRole: string;
}

interface AssignRoleModalProps {
  users?: UserOption[];
  fixedUser?: { id: string; name: string };
  roles: RoleOption[];
  departments: DepartmentOption[];
  returnTo?: string;
  triggerButton?: React.ReactNode;
}

interface SelectedRoleConfig {
  roleId: string;
  scope: "ORGANIZATION" | "DEPARTMENT";
  departmentId: string;
}

export function AssignRoleModal({
  users,
  fixedUser,
  roles,
  departments,
  returnTo,
  triggerButton,
}: AssignRoleModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(fixedUser?.id ?? "");
  const [selectedRoleConfigs, setSelectedRoleConfigs] = useState<
    Record<string, SelectedRoleConfig>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalId = useId();

  const handleRoleToggle = (role: RoleOption) => {
    setSelectedRoleConfigs((prev) => {
      const next = { ...prev };
      if (next[role.id]) {
        delete next[role.id];
      } else {
        // Determine default scope according to scopeAllowed
        const defaultScope =
          role.scopeAllowed === "DEPARTMENT_ONLY" || role.slug === "department-user"
            ? "DEPARTMENT"
            : "ORGANIZATION";
        next[role.id] = {
          roleId: role.id,
          scope: defaultScope,
          departmentId:
            defaultScope === "DEPARTMENT" && departments.length > 0
              ? departments[0].id
              : "",
        };
      }
      return next;
    });
  };

  const handleScopeChange = (
    roleId: string,
    scope: "ORGANIZATION" | "DEPARTMENT",
  ) => {
    setSelectedRoleConfigs((prev) => {
      const current = prev[roleId];
      if (!current) return prev;
      return {
        ...prev,
        [roleId]: {
          ...current,
          scope,
          departmentId:
            scope === "DEPARTMENT" && !current.departmentId && departments.length > 0
              ? departments[0].id
              : current.departmentId,
        },
      };
    });
  };

  const handleDepartmentChange = (roleId: string, departmentId: string) => {
    setSelectedRoleConfigs((prev) => {
      const current = prev[roleId];
      if (!current) return prev;
      return {
        ...prev,
        [roleId]: {
          ...current,
          departmentId,
        },
      };
    });
  };

  const selectedCount = Object.keys(selectedRoleConfigs).length;
  const isTargetUserValid = Boolean(fixedUser?.id || selectedUserId);

  // Prepare JSON payload for the server action
  const payloadArray = useMemo(() => {
    return Object.values(selectedRoleConfigs).map((cfg) => ({
      roleId: cfg.roleId,
      scope: cfg.scope,
      departmentId: cfg.scope === "DEPARTMENT" ? cfg.departmentId || null : null,
    }));
  }, [selectedRoleConfigs]);

  const canSubmit =
    isTargetUserValid &&
    selectedCount > 0 &&
    payloadArray.every(
      (item) => item.scope !== "DEPARTMENT" || Boolean(item.departmentId),
    );

  const resetForm = () => {
    if (!fixedUser) {
      setSelectedUserId("");
    }
    setSelectedRoleConfigs({});
  };

  return (
    <>
      {triggerButton ? (
        <span onClick={() => setIsOpen(true)}>{triggerButton}</span>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.765z"
            />
          </svg>
          Assign Role
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${modalId}-title`}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3
                  id={`${modalId}-title`}
                  className="text-lg font-semibold text-slate-900"
                >
                  Assign Organization Roles
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fixedUser
                    ? `Assign roles and define scope for ${fixedUser.name}.`
                    : "Select an organization member and configure role assignments."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
                aria-label="Close dialog"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form
              action={assignRolesAction}
              onSubmit={() => setIsSubmitting(true)}
              className="mt-6 space-y-6"
            >
              <input
                type="hidden"
                name="userId"
                value={fixedUser ? fixedUser.id : selectedUserId}
              />
              <input
                type="hidden"
                name="roleAssignmentsJson"
                value={JSON.stringify(payloadArray)}
              />
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

              {/* User Selection if not fixed */}
              {!fixedUser && users && (
                <div>
                  <label
                    htmlFor={`${modalId}-user`}
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Select User <span className="text-red-500">*</span>
                  </label>
                  <select
                    id={`${modalId}-user`}
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                    className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">-- Choose an organization user --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email || "No email"} - {u.legacyRole})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Roles Selection */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Select Roles & Scope <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs font-medium text-slate-500">
                    {selectedCount} selected
                  </span>
                </div>

                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 max-h-80 overflow-y-auto">
                  {roles.map((role) => {
                    const isSelected = Boolean(selectedRoleConfigs[role.id]);
                    const currentConfig = selectedRoleConfigs[role.id];
                    const isDeptOnly =
                      role.scopeAllowed === "DEPARTMENT_ONLY" ||
                      role.slug === "department-user";
                    const isOrgOnly = role.scopeAllowed === "ORGANIZATION_ONLY";

                    return (
                      <div
                        key={role.id}
                        className={`p-3.5 transition-colors ${
                          isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            id={`${modalId}-role-${role.id}`}
                            checked={isSelected}
                            onChange={() => handleRoleToggle(role)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={`${modalId}-role-${role.id}`}
                              className="font-medium text-sm text-slate-900 cursor-pointer flex items-center gap-2 flex-wrap"
                            >
                              <span>{role.name}</span>
                              <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {role.slug}
                              </span>
                              {role.roleType === "BUILT_IN" ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  Built-in
                                </span>
                              ) : (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                                  Custom
                                </span>
                              )}
                            </label>
                            {role.description && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {role.description}
                              </p>
                            )}

                            {/* Scope Selection when Role is checked */}
                            {isSelected && currentConfig && (
                              <div className="mt-3 pt-3 border-t border-blue-100 space-y-3">
                                <div>
                                  <span className="block text-xs font-semibold text-slate-700">
                                    Assignment Scope:
                                  </span>
                                  {isOrgOnly ? (
                                    <p className="mt-1 text-xs text-slate-600">
                                      🔒 This role permits <strong>Organization-wide</strong> scope only.
                                    </p>
                                  ) : isDeptOnly ? (
                                    <p className="mt-1 text-xs text-slate-600">
                                      🔒 This role requires a <strong>Department-specific</strong> scope.
                                    </p>
                                  ) : (
                                    <div className="mt-1 flex items-center gap-4">
                                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`scope_choice_${role.id}`}
                                          checked={currentConfig.scope === "ORGANIZATION"}
                                          onChange={() =>
                                            handleScopeChange(role.id, "ORGANIZATION")
                                          }
                                          className="text-blue-600 focus:ring-blue-500"
                                        />
                                        Organization-wide
                                      </label>
                                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`scope_choice_${role.id}`}
                                          checked={currentConfig.scope === "DEPARTMENT"}
                                          onChange={() =>
                                            handleScopeChange(role.id, "DEPARTMENT")
                                          }
                                          className="text-blue-600 focus:ring-blue-500"
                                        />
                                        Department-scoped
                                      </label>
                                    </div>
                                  )}
                                </div>

                                {/* Department Picker if Department Scope */}
                                {currentConfig.scope === "DEPARTMENT" && (
                                  <div>
                                    <label
                                      htmlFor={`${modalId}-dept-${role.id}`}
                                      className="block text-xs font-medium text-slate-700"
                                    >
                                      Target Department <span className="text-red-500">*</span>
                                    </label>
                                    {departments.length === 0 ? (
                                      <p className="mt-1 text-xs text-amber-700">
                                        No active departments found. Please create a department first.
                                      </p>
                                    ) : (
                                      <select
                                        id={`${modalId}-dept-${role.id}`}
                                        value={currentConfig.departmentId}
                                        onChange={(e) =>
                                          handleDepartmentChange(role.id, e.target.value)
                                        }
                                        required
                                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                      >
                                        <option value="">-- Choose department --</option>
                                        {departments.map((d) => (
                                          <option key={d.id} value={d.id}>
                                            {d.name}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSubmitting ? "Assigning..." : `Assign ${selectedCount} Role${selectedCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// DEACTIVATE ASSIGNMENT MODAL
// ============================================================

interface DeactivateAssignmentModalProps {
  assignmentId: string;
  roleName: string;
  userName: string;
  userId: string;
  returnTo?: string;
}

export function DeactivateAssignmentModal({
  assignmentId,
  roleName,
  userName,
  userId,
  returnTo,
}: DeactivateAssignmentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 hover:border-amber-300"
      >
        Deactivate
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${modalId}-title`}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 mt-0.5">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div>
                <h3
                  id={`${modalId}-title`}
                  className="text-base font-semibold text-slate-900"
                >
                  Deactivate &ldquo;{roleName}&rdquo; Assignment?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Deactivating this role will <strong>immediately suspend</strong> all permissions
                  granted by this role to <strong>{userName}</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              The assignment record will be preserved with status <strong>INACTIVE</strong> and can be reactivated by an authorized administrator at any time.
            </div>

            <form
              action={deactivateAssignmentAction}
              onSubmit={() => setIsSubmitting(true)}
              className="mt-6 flex justify-end gap-3"
            >
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <input type="hidden" name="userId" value={userId} />
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isSubmitting ? "Deactivating..." : "Confirm Deactivation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// REVOKE ASSIGNMENT MODAL (PERMANENT / TERMINAL)
// ============================================================

interface RevokeAssignmentModalProps {
  assignmentId: string;
  roleName: string;
  userName: string;
  userId: string;
  returnTo?: string;
}

export function RevokeAssignmentModal({
  assignmentId,
  roleName,
  userName,
  userId,
  returnTo,
}: RevokeAssignmentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalId = useId();

  const isReasonValid = reason.trim().length >= 3;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 hover:border-red-300"
      >
        Revoke
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${modalId}-title`}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 mt-0.5">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </div>
              <div>
                <h3
                  id={`${modalId}-title`}
                  className="text-base font-semibold text-slate-900"
                >
                  Permanently Revoke &ldquo;{roleName}&rdquo; Assignment?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  You are permanently revoking this role assignment for <strong>{userName}</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 leading-relaxed">
              ⚠️ <strong>Warning:</strong> Revocation is a <strong>terminal state</strong> enforced by the database. A revoked assignment record <strong>can never be reactivated</strong>. A reason must be recorded for compliance and audit logs.
            </div>

            <form
              action={revokeAssignmentAction}
              onSubmit={() => setIsSubmitting(true)}
              className="mt-4 space-y-4"
            >
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <input type="hidden" name="userId" value={userId} />
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

              <div>
                <label
                  htmlFor={`${modalId}-reason`}
                  className="block text-xs font-semibold text-slate-700"
                >
                  Revocation Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id={`${modalId}-reason`}
                  name="reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this role assignment is being revoked..."
                  required
                  minLength={3}
                  maxLength={1000}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>Minimum 3 characters required.</span>
                  <span>{reason.length} / 1000</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isReasonValid || isSubmitting}
                  className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Revoking..." : "Confirm Permanent Revocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// ACTIVATE ASSIGNMENT BUTTON
// ============================================================

interface ActivateAssignmentButtonProps {
  assignmentId: string;
  userId: string;
  returnTo?: string;
  className?: string;
}

export function ActivateAssignmentButton({
  assignmentId,
  userId,
  returnTo,
  className,
}: ActivateAssignmentButtonProps) {
  const [isPending, setIsPending] = useState(false);

  return (
    <form action={activateAssignmentAction} onSubmit={() => setIsPending(true)}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="userId" value={userId} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <button
        type="submit"
        disabled={isPending}
        className={
          className ||
          "rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 disabled:opacity-50"
        }
      >
        {isPending ? "Activating..." : "Activate"}
      </button>
    </form>
  );
}
