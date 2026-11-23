"use client";

import { useEffect, useState } from "react";
import {
  StageApprovalPolicy,
  StageApproverType,
  WorkflowStatus,
  WorkflowVersionStatus,
} from "@prisma/client";
import {
  addStageAction,
  createDraftFromVersionAction,
  moveStageAction,
  publishWorkflowAction,
  removeStageAction,
  updateStageAction,
  updateWorkflowMetadataAction,
} from "./actions";

// ============================================================
// BADGE COMPONENTS
// ============================================================

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

export function VersionStatusBadge({ status }: { status: WorkflowVersionStatus }) {
  switch (status) {
    case "DRAFT":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
          Draft
        </span>
      );
    case "PUBLISHED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Published
        </span>
      );
    case "ARCHIVED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          Archived
        </span>
      );
    default:
      return null;
  }
}

export function ApprovalPolicyBadge({ policy }: { policy: StageApprovalPolicy }) {
  if (policy === "ALL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        <svg className="h-3 w-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        ALL (Unanimous)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">
      <svg className="h-3 w-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      ANY_ONE (First decision)
    </span>
  );
}

// ============================================================
// TYPES FOR STAGE CONFIGURATION
// ============================================================

export interface AvailableUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  middleName?: string | null;
  email: string | null;
  role: string;
  departmentName?: string | null;
}

export interface AvailableRole {
  id: string;
  name: string;
  slug: string;
  roleType: string;
  scopeAllowed: string;
  description?: string | null;
}

export interface AvailablePermission {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
}

export interface StageApproverView {
  id?: string;
  approverType: StageApproverType;
  userId?: string | null;
  roleId?: string | null;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  role?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

// ============================================================
// ADD STAGE MODAL
// ============================================================

export function AddStageModal({
  workflowId,
  versionId,
  users,
  roles,
  permissions,
}: {
  workflowId: string;
  versionId: string;
  users: AvailableUser[];
  roles: AvailableRole[];
  permissions: AvailablePermission[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const [approverRows, setApproverRows] = useState<
    Array<{ type: StageApproverType; targetId: string }>
  >([
    {
      type: roles.length > 0 ? "ROLE" : "USER",
      targetId: roles.length > 0 ? roles[0].id : users[0]?.id || "",
    },
  ]);

  const addApproverRow = () => {
    setApproverRows((prev) => [
      ...prev,
      {
        type: roles.length > 0 ? "ROLE" : "USER",
        targetId: roles.length > 0 ? roles[0].id : users[0]?.id || "",
      },
    ]);
  };

  const removeApproverRow = (index: number) => {
    setApproverRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateApproverType = (index: number, newType: StageApproverType) => {
    setApproverRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              type: newType,
              targetId: newType === "ROLE" ? roles[0]?.id || "" : users[0]?.id || "",
            }
          : row,
      ),
    );
  };

  const updateApproverTarget = (index: number, targetId: string) => {
    setApproverRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, targetId } : row)),
    );
  };

  const approversJson = JSON.stringify(
    approverRows
      .filter((r) => r.targetId)
      .map((r) => ({
        approverType: r.type,
        userId: r.type === "USER" ? r.targetId : undefined,
        roleId: r.type === "ROLE" ? r.targetId : undefined,
      })),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Approval Stage
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-stage-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 id="add-stage-modal-title" className="text-lg font-bold text-slate-900">Add Approval Stage</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure stage requirements, approval policy, and assigned approvers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form action={addStageAction} className="space-y-5">
              <input type="hidden" name="workflowId" value={workflowId} />
              <input type="hidden" name="versionId" value={versionId} />
              <input type="hidden" name="approversJson" value={approversJson} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stage Name <span className="text-red-600">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Department Head Approval"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  name="description"
                  rows={2}
                  maxLength={500}
                  placeholder="Describe the objective or criteria for this approval stage..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approval Mode
                  </label>
                  <select
                    name="approvalPolicy"
                    defaultValue="ANY_ONE"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="ANY_ONE">ANY_ONE (First decision advances stage)</option>
                    <option value="ALL">ALL (All eligible approvers must approve)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Use ANY_ONE for pool/delegation or ALL for multi-party concurrence.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Required RBAC Permission <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    name="requiredPermissionCode"
                    defaultValue=""
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">None (No extra permission check)</option>
                    {permissions.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Approvers must hold this permission in the request's scope.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="isOptional"
                  name="isOptional"
                  type="checkbox"
                  value="true"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isOptional" className="text-sm font-medium text-slate-700">
                  Optional stage (can be skipped during instance execution)
                </label>
              </div>

              {/* Approvers Configuration */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Configured Approvers <span className="text-red-600">*</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Select organization roles or specific members who can approve this stage.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addApproverRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Add Another Approver
                  </button>
                </div>

                <div className="space-y-2">
                  {approverRows.map((row, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                    >
                      <select
                        value={row.type}
                        onChange={(e) =>
                          updateApproverType(index, e.target.value as StageApproverType)
                        }
                        className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="ROLE">Role</option>
                        <option value="USER">Specific User</option>
                      </select>

                      {row.type === "ROLE" ? (
                        <select
                          value={row.targetId}
                          onChange={(e) => updateApproverTarget(index, e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.scopeAllowed === "DEPARTMENT_ONLY" ? "Dept-scoped" : "Org-wide"})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={row.targetId}
                          onChange={(e) => updateApproverTarget(index, e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.firstName} {u.lastName} ({u.email})
                            </option>
                          ))}
                        </select>
                      )}

                      {approverRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeApproverRow(index)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Remove approver"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approverRows.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Stage
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
// EDIT STAGE MODAL
// ============================================================

export function EditStageModal({
  workflowId,
  versionId,
  stage,
  users,
  roles,
  permissions,
}: {
  workflowId: string;
  versionId: string;
  stage: {
    id: string;
    name: string;
    description?: string | null;
    approvalPolicy: StageApprovalPolicy;
    isOptional: boolean;
    requiredPermissionCode?: string | null;
    approvers: StageApproverView[];
  };
  users: AvailableUser[];
  roles: AvailableRole[];
  permissions: AvailablePermission[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const [approverRows, setApproverRows] = useState<
    Array<{ type: StageApproverType; targetId: string }>
  >(() => {
    if (stage.approvers.length > 0) {
      return stage.approvers.map((a) => ({
        type: a.approverType,
        targetId: (a.approverType === "USER" ? a.userId : a.roleId) || "",
      }));
    }
    return [
      {
        type: roles.length > 0 ? "ROLE" : "USER",
        targetId: roles.length > 0 ? roles[0].id : users[0]?.id || "",
      },
    ];
  });

  const addApproverRow = () => {
    setApproverRows((prev) => [
      ...prev,
      {
        type: roles.length > 0 ? "ROLE" : "USER",
        targetId: roles.length > 0 ? roles[0].id : users[0]?.id || "",
      },
    ]);
  };

  const removeApproverRow = (index: number) => {
    setApproverRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateApproverType = (index: number, newType: StageApproverType) => {
    setApproverRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              type: newType,
              targetId: newType === "ROLE" ? roles[0]?.id || "" : users[0]?.id || "",
            }
          : row,
      ),
    );
  };

  const updateApproverTarget = (index: number, targetId: string) => {
    setApproverRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, targetId } : row)),
    );
  };

  const approversJson = JSON.stringify(
    approverRows
      .filter((r) => r.targetId)
      .map((r) => ({
        approverType: r.type,
        userId: r.type === "USER" ? r.targetId : undefined,
        roleId: r.type === "ROLE" ? r.targetId : undefined,
      })),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none"
      >
        Edit
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`edit-stage-modal-title-${stage.id}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 id={`edit-stage-modal-title-${stage.id}`} className="text-lg font-bold text-slate-900">Edit Approval Stage</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Modify stage parameters and approvers for draft version.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form action={updateStageAction} className="space-y-5">
              <input type="hidden" name="workflowId" value={workflowId} />
              <input type="hidden" name="versionId" value={versionId} />
              <input type="hidden" name="stageId" value={stage.id} />
              <input type="hidden" name="approversJson" value={approversJson} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stage Name <span className="text-red-600">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  maxLength={150}
                  defaultValue={stage.name}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  name="description"
                  rows={2}
                  maxLength={500}
                  defaultValue={stage.description || ""}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approval Mode
                  </label>
                  <select
                    name="approvalPolicy"
                    defaultValue={stage.approvalPolicy}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="ANY_ONE">ANY_ONE (First decision advances stage)</option>
                    <option value="ALL">ALL (All eligible approvers must approve)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Required RBAC Permission <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    name="requiredPermissionCode"
                    defaultValue={stage.requiredPermissionCode || ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">None (No extra permission check)</option>
                    {permissions.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id={`edit-isOptional-${stage.id}`}
                  name="isOptional"
                  type="checkbox"
                  value="true"
                  defaultChecked={stage.isOptional}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`edit-isOptional-${stage.id}`} className="text-sm font-medium text-slate-700">
                  Optional stage (can be skipped during instance execution)
                </label>
              </div>

              {/* Approvers Configuration */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Configured Approvers <span className="text-red-600">*</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Must have at least one approver configured.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addApproverRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Add Another Approver
                  </button>
                </div>

                <div className="space-y-2">
                  {approverRows.map((row, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                    >
                      <select
                        value={row.type}
                        onChange={(e) =>
                          updateApproverType(index, e.target.value as StageApproverType)
                        }
                        className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="ROLE">Role</option>
                        <option value="USER">Specific User</option>
                      </select>

                      {row.type === "ROLE" ? (
                        <select
                          value={row.targetId}
                          onChange={(e) => updateApproverTarget(index, e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.scopeAllowed === "DEPARTMENT_ONLY" ? "Dept-scoped" : "Org-wide"})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={row.targetId}
                          onChange={(e) => updateApproverTarget(index, e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.firstName} {u.lastName} ({u.email})
                            </option>
                          ))}
                        </select>
                      )}

                      {approverRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeApproverRow(index)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Remove approver"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approverRows.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Changes
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
// DELETE STAGE CONFIRMATION MODAL
// ============================================================

export function DeleteStageModal({
  workflowId,
  versionId,
  stageId,
  stageName,
}: {
  workflowId: string;
  versionId: string;
  stageId: string;
  stageName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none"
      >
        Remove
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-stage-modal-title-${stageId}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 id={`delete-stage-modal-title-${stageId}`} className="text-base font-bold text-slate-900">
              Remove Approval Stage?
            </h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to remove stage <strong>"{stageName}"</strong>?
              Remaining stages will be automatically re-sequenced in consecutive order.
            </p>

            <form action={removeStageAction} className="flex justify-end gap-3 pt-2">
              <input type="hidden" name="workflowId" value={workflowId} />
              <input type="hidden" name="versionId" value={versionId} />
              <input type="hidden" name="stageId" value={stageId} />

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-700"
              >
                Remove Stage
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// STAGE REORDER BUTTONS
// ============================================================

export function StageReorderButtons({
  workflowId,
  versionId,
  stageId,
  isFirst,
  isLast,
}: {
  workflowId: string;
  versionId: string;
  stageId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {!isFirst && (
        <form action={moveStageAction}>
          <input type="hidden" name="workflowId" value={workflowId} />
          <input type="hidden" name="versionId" value={versionId} />
          <input type="hidden" name="stageId" value={stageId} />
          <input type="hidden" name="direction" value="up" />
          <button
            type="submit"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Move Up"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </form>
      )}

      {!isLast && (
        <form action={moveStageAction}>
          <input type="hidden" name="workflowId" value={workflowId} />
          <input type="hidden" name="versionId" value={versionId} />
          <input type="hidden" name="stageId" value={stageId} />
          <input type="hidden" name="direction" value="down" />
          <button
            type="submit"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Move Down"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

// ============================================================
// PUBLISH WORKFLOW MODAL
// ============================================================

export function PublishWorkflowModal({
  workflowId,
  versionId,
  versionNumber,
  isValid,
  validationErrors,
}: {
  workflowId: string;
  versionId: string;
  versionNumber: number;
  isValid: boolean;
  validationErrors: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        disabled={!isValid}
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
        Publish Version {versionNumber}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`publish-modal-title-${versionId}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 id={`publish-modal-title-${versionId}`} className="text-base font-bold text-slate-900">
              Publish Workflow Version {versionNumber}?
            </h3>
            <p className="text-sm text-slate-600">
              Publishing will make <strong>Version {versionNumber}</strong> the active approval
              process for all newly submitted requests in your organization. Any previously
              published version will be archived.
            </p>

            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              ✓ All validation rules and consecutive stage requirements are satisfied.
            </div>

            <form action={publishWorkflowAction} className="flex justify-end gap-3 pt-2">
              <input type="hidden" name="workflowId" value={workflowId} />
              <input type="hidden" name="versionId" value={versionId} />

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700"
              >
                Confirm & Publish
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// CREATE DRAFT MODAL
// ============================================================

export function CreateDraftModal({
  workflowId,
  fromVersionId,
  fromVersionNumber,
}: {
  workflowId: string;
  fromVersionId: string;
  fromVersionNumber: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        Create New Draft from Version {fromVersionNumber}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`create-draft-modal-title-${fromVersionId}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 id={`create-draft-modal-title-${fromVersionId}`} className="text-base font-bold text-slate-900">
              Create New Draft from Version {fromVersionNumber}?
            </h3>
            <p className="text-sm text-slate-600">
              A new draft version will be created by deep-copying all stages and approvers from
              Version {fromVersionNumber}. Published versions remain immutable and unaffected.
            </p>

            <form action={createDraftFromVersionAction} className="flex justify-end gap-3 pt-2">
              <input type="hidden" name="workflowId" value={workflowId} />
              <input type="hidden" name="fromVersionId" value={fromVersionId} />

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                Create Draft
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// EDIT WORKFLOW METADATA MODAL
// ============================================================

export function EditWorkflowMetadataModal({
  workflow,
}: {
  workflow: {
    id: string;
    name: string;
    description?: string | null;
    status: WorkflowStatus;
    workflowType: string;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
      >
        Edit Details
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`edit-workflow-modal-title-${workflow.id}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id={`edit-workflow-modal-title-${workflow.id}`} className="text-base font-bold text-slate-900">Edit Workflow Details</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form action={updateWorkflowMetadataAction} className="space-y-4">
              <input type="hidden" name="workflowId" value={workflow.id} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Workflow Name <span className="text-red-600">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  maxLength={150}
                  defaultValue={workflow.name}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  name="description"
                  rows={3}
                  maxLength={1000}
                  defaultValue={workflow.description || ""}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={workflow.status}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
                >
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
