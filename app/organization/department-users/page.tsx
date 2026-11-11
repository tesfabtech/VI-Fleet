import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DepartmentUserApplicationStatus, UserStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  approveDepartmentUserApplication,
  createDepartmentUserInvitation,
  markDepartmentUserApplicationUnderReview,
  rejectDepartmentUserApplication,
} from "./actions";

const ALLOWED_ROLES = ["ORGANIZATION_ADMINISTRATOR", "VICE_ORGANIZATION_ADMINISTRATOR"];
const PAGE_SIZE = 20;

const MESSAGES: Record<string, string> = {
  "under-review": "Application marked as under review.",
  approved: "Application approved and setup invitation email sent.",
  rejected: "Application rejected.",
  "user-invited": "Department User created and invitation email sent.",
  "department-updated": "Department assignment updated.",
  "status-updated": "User status updated.",
  "invitation-resent": "Password setup invitation resent.",
  "verification-resent": "Email verification link resent.",
};

const ERRORS: Record<string, string> = {
  unauthorized: "You are not authorized to perform this action.",
  invalid: "Check the required fields and try again.",
  "invalid-department": "Choose an active department in your organization.",
  "invalid-status": "Invalid user status.",
  "user-not-found": "Department User not found.",
  "setup-incomplete": "User must complete password setup and email verification before activation.",
  throttled: "Please wait at least 2 minutes before resending another email to this user.",
  notes: "Review notes must be 2,000 characters or fewer.",
  "email-used": "That email address is already used by an account.",
  reviewed: "This application has already been processed.",
  inactive: "Your organization or the selected department is inactive.",
  "approval-failed": "Action or email delivery failed. Check server logs.",
};

export function getUserStage(u: { status: UserStatus; passwordHash: string | null; email: string | null; pendingEmail: string | null }) {
  if (!u.passwordHash) return { stage: "PASSWORD" as const, label: "Pending password", cls: "bg-amber-100 text-amber-800" };
  if (u.pendingEmail || !u.email) return { stage: "VERIFY" as const, label: "Pending verification", cls: "bg-blue-100 text-blue-800" };
  if (u.status === "ACTIVE") return { stage: "DONE" as const, label: "Active", cls: "bg-green-100 text-green-800" };
  if (u.status === "SUSPENDED") return { stage: "DONE" as const, label: "Suspended", cls: "bg-red-100 text-red-800" };
  return { stage: "DONE" as const, label: "Inactive", cls: "bg-slate-100 text-slate-700" };
}

export default async function DepartmentUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role) || !session.user.organizationId) notFound();

  const organizationId = session.user.organizationId;
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const departmentId = params.departmentId?.trim() || undefined;
  const userStatus = ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(params.userStatus ?? "") ? (params.userStatus as UserStatus) : undefined;
  const appStatus = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"].includes(params.appStatus ?? "")
    ? (params.appStatus as DepartmentUserApplicationStatus)
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const userWhere = {
    organizationId,
    role: "DEPARTMENT_USER" as const,
    deletedAt: null,
    ...(departmentId ? { departmentId } : {}),
    ...(userStatus ? { status: userStatus } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { middleName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { pendingEmail: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [departments, users, filteredTotal, totalUsers, activeUsers, inactiveUsers, pendingApps, applications] = await Promise.all([
    prisma.department.findMany({ where: { organizationId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true } }),
    prisma.user.findMany({
      where: userWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, firstName: true, middleName: true, lastName: true, email: true, pendingEmail: true, phone: true,
        status: true, passwordHash: true, createdAt: true,
        department: { select: { id: true, name: true, status: true } },
        _count: { select: { submittedRequests: { where: { deletedAt: null } } } },
      },
    }),
    prisma.user.count({ where: userWhere }),
    prisma.user.count({ where: { organizationId, role: "DEPARTMENT_USER", deletedAt: null } }),
    prisma.user.count({ where: { organizationId, role: "DEPARTMENT_USER", status: "ACTIVE", deletedAt: null } }),
    prisma.user.count({ where: { organizationId, role: "DEPARTMENT_USER", status: "INACTIVE", deletedAt: null } }),
    prisma.departmentUserApplication.count({ where: { organizationId, status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
    prisma.departmentUserApplication.findMany({
      where: { organizationId, ...(departmentId ? { departmentId } : {}), ...(appStatus ? { status: appStatus } : {}) },
      include: { department: { select: { id: true, name: true } } },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const activeDepts = departments.filter((d) => d.status === "ACTIVE");
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (departmentId) sp.set("departmentId", departmentId);
    if (userStatus) sp.set("userStatus", userStatus);
    if (appStatus) sp.set("appStatus", appStatus);
    sp.set("page", String(p));
    return `/organization/department-users?${sp.toString()}`;
  };

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Department Users</h1>
          <p className="mt-1 text-sm text-slate-600">Manage directory members, invitations, and registration applications.</p>
        </div>
        <Link
          href="/organization/department-users/registration-links"
          className="inline-flex w-fit rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Share & manage registration link
        </Link>
      </div>

      {params.message && MESSAGES[params.message] && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{MESSAGES[params.message]}</p>
      )}
      {params.error && ERRORS[params.error] && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{ERRORS[params.error]}</p>
      )}

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Department Users", value: totalUsers },
          { label: "Active Accounts", value: activeUsers },
          { label: "Pending / Inactive", value: inactiveUsers },
          { label: "Open Applications", value: pendingApps },
        ].map((k) => (
          <article key={k.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{k.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{k.value}</p>
          </article>
        ))}
      </section>

      {/* Collapsible Direct Invite */}
      <details className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900 hover:text-blue-600">
          + Invite a Department User directly
        </summary>
        <form action={createDepartmentUserInvitation} className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <input name="firstName" required maxLength={150} placeholder="First name *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="middleName" required maxLength={150} placeholder="Father's name *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="lastName" required maxLength={150} placeholder="Grandfather's name *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select name="departmentId" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Select active department *</option>
            {activeDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input name="email" type="email" required maxLength={255} placeholder="Email address *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="phone" type="tel" maxLength={30} placeholder="Phone (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={!activeDepts.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              Send setup invitation
            </button>
          </div>
        </form>
      </details>

      {/* Directory Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Directory ({filteredTotal})</h2>
          <form method="GET" action="/organization/department-users" className="flex flex-wrap gap-2">
            <input name="q" defaultValue={q} placeholder="Search name, email, phone..." className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <select name="departmentId" defaultValue={departmentId ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select name="userStatus" defaultValue={userStatus ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive / Pending</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Filter</button>
          </form>
        </div>

        {!users.length ? (
          <p className="p-8 text-center text-sm text-slate-500">No Department Users match your filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email & Phone</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Requests</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const fullName = [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ") || "Unnamed";
                  const stage = getUserStage(u);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{fullName}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <div>{u.email ?? u.pendingEmail ?? "—"}</div>
                        {u.phone && <div className="text-xs text-slate-400">{u.phone}</div>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">{u.department?.name ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stage.cls}`}>{stage.label}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{u._count.submittedRequests}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/organization/department-users/${u.id}`} className="font-semibold text-blue-600 hover:underline">
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-600">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={pageHref(page - 1)} className="rounded border px-2.5 py-1 hover:bg-slate-50">← Previous</Link>}
              {page < totalPages && <Link href={pageHref(page + 1)} className="rounded border px-2.5 py-1 hover:bg-slate-50">Next →</Link>}
            </div>
          </div>
        )}
      </section>

      {/* Applications Queue */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Applications ({applications.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"].map((st) => {
              const active = (st === "ALL" && !appStatus) || appStatus === st;
              return (
                <Link
                  key={st}
                  href={st === "ALL" ? "/organization/department-users" : `/organization/department-users?appStatus=${st}`}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {st.replaceAll("_", " ")}
                </Link>
              );
            })}
          </div>
        </div>

        {!applications.length ? (
          <p className="text-sm text-slate-500">No applications found.</p>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const canReview = app.status === "PENDING" || app.status === "UNDER_REVIEW";
              return (
                <article key={app.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{app.firstName} {app.middleName} {app.lastName}</h3>
                      <p className="text-xs text-slate-600">{app.email} • {app.phone || "No phone"} • Dept: <strong>{app.department.name}</strong></p>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.createdUserId && (
                        <Link href={`/organization/department-users/${app.createdUserId}`} className="text-xs font-semibold text-blue-600 hover:underline">
                          View user →
                        </Link>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {app.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>

                  {app.reviewNotes && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">Notes: {app.reviewNotes}</p>}

                  {canReview && (
                    <form className="mt-3 space-y-2">
                      <input type="hidden" name="applicationId" value={app.id} />
                      <input name="reviewNotes" maxLength={2000} defaultValue={app.reviewNotes ?? ""} placeholder="Optional review note or rejection reason..." className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs" />
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" formAction={approveDepartmentUserApplication} className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800">
                          Approve & invite
                        </button>
                        {app.status === "PENDING" && (
                          <button type="submit" formAction={markDepartmentUserApplicationUnderReview} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                            Mark under review
                          </button>
                        )}
                        <button type="submit" formAction={rejectDepartmentUserApplication} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">
                          Reject
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
