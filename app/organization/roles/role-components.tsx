"use client";

import { useId, useMemo, useState } from "react";
import type { PermissionGroup } from "@/lib/rbac";
import { setRoleStatus } from "./actions";

interface PermissionSelectorProps {
  groups: PermissionGroup[];
  initialSelectedCodes?: string[];
}

export function PermissionSelector({
  groups,
  initialSelectedCodes = [],
}: PermissionSelectorProps) {
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set(initialSelectedCodes),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputId = useId();

  const totalCatalogCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.permissions.length, 0);
  }, [groups]);

  // Filter groups based on search term
  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return groups;

    return groups
      .map((group) => {
        const matchingPermissions = group.permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.code.toLowerCase().includes(term) ||
            (p.description && p.description.toLowerCase().includes(term)),
        );
        return {
          ...group,
          permissions: matchingPermissions,
        };
      })
      .filter((group) => group.permissions.length > 0);
  }, [groups, searchTerm]);

  const togglePermission = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleGroup = (group: PermissionGroup) => {
    const allSelected = group.permissions.every((p) =>
      selectedCodes.has(p.code),
    );
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        group.permissions.forEach((p) => next.delete(p.code));
      } else {
        group.permissions.forEach((p) => next.add(p.code));
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    groups.forEach((g) => g.permissions.forEach((p) => all.add(p.code)));
    setSelectedCodes(all);
  };

  const clearAll = () => {
    setSelectedCodes(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Hidden inputs to send in FormData */}
      {Array.from(selectedCodes).map((code) => (
        <input key={code} type="hidden" name="permissions" value={code} />
      ))}

      {/* Toolbar & Filter */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 items-center justify-center rounded-full bg-blue-100 px-3 text-xs font-semibold text-blue-800">
              {selectedCodes.size} / {totalCatalogCount} selected
            </span>
          </div>
          <div className="h-4 w-px bg-slate-300" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              Select All
            </button>
            <span className="text-slate-400">|</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs sm:w-72">
          <label htmlFor={searchInputId} className="sr-only">
            Filter permissions
          </label>
          <input
            id={searchInputId}
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search permissions..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Selected Permissions Review Drawer */}
      {selectedCodes.size > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-900">
            Selected Permissions Review ({selectedCodes.size})
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {Array.from(selectedCodes).map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-mono font-medium text-blue-900 shadow-xs border border-blue-200"
              >
                <span>{code}</span>
                <button
                  type="button"
                  onClick={() => togglePermission(code)}
                  className="rounded-full text-blue-600 hover:bg-blue-100 hover:text-blue-900 p-0.5"
                  aria-label={`Remove ${code}`}
                >
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Permission Categories */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">
            No permissions match your search &ldquo;{searchTerm}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="mt-2 text-sm font-medium text-blue-600 hover:underline"
          >
            Clear search filter
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map((group) => {
            const allSelected = group.permissions.every((p) =>
              selectedCodes.has(p.code),
            );
            const someSelected =
              !allSelected &&
              group.permissions.some((p) => selectedCodes.has(p.code));

            return (
              <section
                key={group.category}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
              >
                {/* Category Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">
                      {group.category}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {
                        group.permissions.filter((p) =>
                          selectedCodes.has(p.code),
                        ).length
                      }{" "}
                      / {group.permissions.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {allSelected ? "Deselect All" : "Select Category"}
                  </button>
                </div>

                {/* Permissions Grid */}
                <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
                  {group.permissions.map((perm) => {
                    const isChecked = selectedCodes.has(perm.code);
                    return (
                      <label
                        key={perm.code}
                        className={`flex cursor-pointer items-start gap-3 bg-white p-4 transition-colors hover:bg-slate-50 ${
                          isChecked ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(perm.code)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
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
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DeactivateRoleModalProps {
  roleId: string;
  roleName: string;
  assignedUsersCount: number;
  returnTo?: string;
  triggerButtonClassName?: string;
}

export function DeactivateRoleModal({
  roleId,
  roleName,
  assignedUsersCount,
  returnTo,
  triggerButtonClassName,
}: DeactivateRoleModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          triggerButtonClassName ||
          "rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 hover:border-red-300"
        }
      >
        Deactivate
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-dialog-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
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
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div>
                <h3
                  id="deactivate-dialog-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Deactivate &ldquo;{roleName}&rdquo;?
                </h3>
                <p className="text-xs text-slate-500">
                  Confirm role deactivation and review affected users.
                </p>
              </div>
            </div>

            {/* Warning when active users are assigned */}
            <div className="mt-4">
              {assignedUsersCount > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-800">
                    <svg
                      className="h-5 w-5 text-amber-600 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      {assignedUsersCount} active user
                      {assignedUsersCount === 1 ? "" : "s"} currently assigned
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Deactivating this role will <strong>immediately revoke</strong> all permissions
                    granted by this role for {assignedUsersCount === 1 ? "this user" : "these users"}.
                    Their user assignments will be preserved and will resume if the role is reactivated.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  No active users are currently assigned to this role. Deactivating it will prevent it from being assigned or granting permissions.
                </div>
              )}
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Are you sure you want to deactivate this role? You can reactivate it at any time.
            </p>

            <form
              action={setRoleStatus}
              onSubmit={() => setIsSubmitting(true)}
              className="mt-6 flex justify-end gap-3"
            >
              <input type="hidden" name="roleId" value={roleId} />
              <input type="hidden" name="status" value="INACTIVE" />
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50"
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

interface ActivateRoleButtonProps {
  roleId: string;
  returnTo?: string;
  className?: string;
}

export function ActivateRoleButton({
  roleId,
  returnTo,
  className,
}: ActivateRoleButtonProps) {
  const [isPending, setIsPending] = useState(false);

  return (
    <form action={setRoleStatus} onSubmit={() => setIsPending(true)}>
      <input type="hidden" name="roleId" value={roleId} />
      <input type="hidden" name="status" value="ACTIVE" />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <button
        type="submit"
        disabled={isPending}
        className={
          className ||
          "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300"
        }
      >
        {isPending ? "Activating..." : "Activate Role"}
      </button>
    </form>
  );
}
