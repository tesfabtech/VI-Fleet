import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  resendDepartmentUserInvitation,
  resendDepartmentUserVerificationEmail,
  updateDepartmentUserAssignment,
  updateDepartmentUserStatus,
} from "../actions";
import { getUserStage } from "../page";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = ["ORGANIZATION_ADMINISTRATOR", "VICE_ORGANIZATION_ADMINISTRATOR"];

const MESSAGES: Record<string, string> = {
  "department-updated": "Department updated. Existing transport requests remain with their original department.",
  "status-updated": "Account status updated.",
  "invitation-resent": "Password setup invitation email resent.",
  "verification-resent": "Verification email resent.",
};

const ERRORS: Record<string, string> = {
  invalid: "Invalid request.",
  "invalid-department": "Choose an active department belonging to your organization.",
  "setup-incomplete": "User must complete password setup and email verification before activation.",
  throttled: "Please wait at least 2 minutes before resending another email.",
  "approval-failed": "Email delivery failed. Check server logs.",
  inactive: "Your organization is currently inactive.",
};

export default async function DepartmentUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role) || !session.user.organizationId) notFound();

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const organizationId = session.user.organizationId;
  const query = await searchParams;

  const [user, activeDepts] = await Promise.all([
    prisma.user.findFirst({
      where: { id, organizationId, role: "DEPARTMENT_USER", deletedAt: null },
      select: {
        id: true, firstName: true, middleName: true, lastName: true, email: true, pendingEmail: true, phone: true,
        role: true, status: true, passwordHash: true, departmentId: true, createdAt: true,
        department: { select: { id: true, name: true, status: true } },
        submittedRequests: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { id: true, purpose: true, origin: true, destination: true, passengerCount: true, requestedStart: true, status: true, department: { select: { name: true } } },
        },
      },
    }),
    prisma.department.findMany({
      where: { organizationId, status: "ACTIVE", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!user) notFound();

  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || "Unnamed User";
  const stage = getUserStage(user);
  const returnTo = `/organization/department-users/${user.id}`;

  return (
    <main className="space-y-6">
      <div>
        <Link href="/organization/department-users" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to Department Users
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stage.cls}`}>{stage.label}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{user.role}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {user.email ?? user.pendingEmail ?? "No email"} {user.phone ? `• ${user.phone}` : ""} • Joined {user.createdAt.toLocaleDateString()}
        </p>
      </div>

      {query.message && MESSAGES[query.message] && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{MESSAGES[query.message]}</p>
      )}
      {query.error && ERRORS[query.error] && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{ERRORS[query.error]}</p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Department Reassignment */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Department Membership</h2>
          <p className="text-xs text-slate-500">
            Current: <strong>{user.department?.name ?? "Unassigned"}</strong>. Reassigning updates future requests while keeping past requests on their original department.
          </p>
          <form action={updateDepartmentUserAssignment} className="flex gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <select name="departmentId" defaultValue={user.departmentId ?? ""} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {activeDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Save
            </button>
          </form>
        </section>

        {/* Three-Stage Onboarding & Status Control */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Onboarding & Status Control</h2>
          <p className="text-xs text-slate-500">
            1. Provisioned ✓ → 2. Password {user.passwordHash ? "✓" : "Pending"} → 3. Verified {stage.stage === "DONE" ? "✓" : "Pending"}
          </p>

          {stage.stage === "PASSWORD" ? (
            <form action={resendDepartmentUserInvitation}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                Resend setup invitation email
              </button>
            </form>
          ) : stage.stage === "VERIFY" ? (
            <form action={resendDepartmentUserVerificationEmail}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Resend verification email
              </button>
            </form>
          ) : (
            <form action={updateDepartmentUserStatus} className="flex gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <select name="status" defaultValue={user.status} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Update status
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Transportation Request History */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Transportation Requests ({user.submittedRequests.length})</h2>
        </div>
        {!user.submittedRequests.length ? (
          <p className="p-6 text-sm text-slate-500">No transportation requests submitted yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Purpose</th>
                <th className="px-5 py-3">Route</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {user.submittedRequests.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">{r.purpose}</td>
                  <td className="px-5 py-3 text-slate-600">{r.origin} → {r.destination} ({r.passengerCount})</td>
                  <td className="px-5 py-3 text-slate-600">{r.department.name}</td>
                  <td className="px-5 py-3 text-slate-500">{r.requestedStart.toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
