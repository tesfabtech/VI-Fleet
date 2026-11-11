import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  approveApplicationFromDepartment,
  rejectApplicationFromDepartment,
  setDepartmentStatus,
  updateDepartment,
} from "../actions";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DepartmentDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "name-required": "Enter a department name.",
  "name-too-long": "Department names must be 100 characters or fewer.",
  "description-too-long":
    "Department descriptions must be 1,000 characters or fewer.",
  "duplicate-name":
    "Another department with that name already exists in your organization.",
  "has-pending-requests":
    "This department has pending transportation requests. Resolve them before deactivating the department.",
  "invalid-application": "The application information is invalid.",
  "notes-too-long": "Review notes must be 2,000 characters or fewer.",
  "email-used":
    "This applicant's email address already belongs to an existing account.",
  "application-reviewed":
    "This application has already been processed.",
  "department-inactive-for-approval":
    "Reactivate this department before approving new staff applications.",
  "approval-failed":
    "Could not approve the application or send the invitation email.",
  "organization-inactive":
    "Your organization is currently inactive.",
};

const successMessages: Record<string, string> = {
  updated: "Department information updated successfully.",
  deactivated: "Department deactivated successfully.",
  reactivated: "Department reactivated successfully.",
  "application-approved":
    "Application approved and account setup invitation email sent.",
  "application-rejected": "Application rejected.",
};

export default async function DepartmentDetailsPage({
  params,
  searchParams,
}: DepartmentDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const allowedRoles = [
    "ORGANIZATION_ADMINISTRATOR",
    "VICE_ORGANIZATION_ADMINISTRATOR",
  ];

  if (
    !allowedRoles.includes(session.user.role) ||
    !session.user.organizationId
  ) {
    notFound();
  }

  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const organizationId = session.user.organizationId;
  const queryParams = await searchParams;

  const department = await prisma.department.findFirst({
    where: {
      id,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      users: {
        where: { deletedAt: null },
        orderBy: [{ status: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          pendingEmail: true,
          phone: true,
          status: true,
          passwordHash: true,
          createdAt: true,
        },
      },
      departmentUserApplications: {
        where: {
          status: { in: ["PENDING", "UNDER_REVIEW"] },
        },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          submittedAt: true,
        },
      },
      transportationRequests: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          purpose: true,
          origin: true,
          destination: true,
          passengerCount: true,
          requestedStart: true,
          requestedEnd: true,
          status: true,
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      _count: {
        select: {
          users: { where: { deletedAt: null } },
          transportationRequests: { where: { deletedAt: null } },
          departmentUserApplications: true,
        },
      },
    },
  });

  if (!department) {
    notFound();
  }

  const isActive = department.status === "ACTIVE";
  const returnPath = `/organization/departments/${department.id}`;
  const activeMembersCount = department.users.filter(
    (u) => u.status === "ACTIVE",
  ).length;
  const pendingRequestsCount = department.transportationRequests.filter(
    (r) => r.status === "PENDING",
  ).length;

  const errorMessage = queryParams.error
    ? errorMessages[queryParams.error] ?? "Could not complete the action."
    : null;

  const successMessage = queryParams.success
    ? successMessages[queryParams.success] ?? null
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/organization/departments"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to departments
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {department.name}
            </h1>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isActive
                  ? "bg-green-100 text-green-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {isActive
                ? "Open for staff registration"
                : "Hidden from staff registration"}
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {department.description ||
              "No description provided for this department."}
          </p>
        </div>

        <form action={setDepartmentStatus}>
          <input type="hidden" name="id" value={department.id} />
          <input type="hidden" name="returnTo" value={returnPath} />
          <input
            type="hidden"
            name="status"
            value={isActive ? "INACTIVE" : "ACTIVE"}
          />
          <button
            type="submit"
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                : "border-green-200 bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {isActive ? "Deactivate department" : "Reactivate department"}
          </button>
        </form>
      </section>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {successMessage}
        </div>
      )}

      {/* KPI Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total members</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {department._count.users}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activeMembersCount} active accounts
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending applications</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">
            {department.departmentUserApplications.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Awaiting onboarding review
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Transport requests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {department._count.transportationRequests}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {pendingRequestsCount} currently pending
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Department created</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {department.createdAt.toLocaleDateString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Updated {department.updatedAt.toLocaleDateString()}
          </p>
        </article>
      </section>

      {/* Edit Department Information Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Update department information
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Edit the name or operational description for this department.
        </p>

        <form
          action={updateDepartment}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <input type="hidden" name="id" value={department.id} />
          <input type="hidden" name="returnTo" value={returnPath} />

          <div>
            <label
              htmlFor="dept-name"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Department name <span className="text-red-600">*</span>
            </label>
            <input
              id="dept-name"
              name="name"
              type="text"
              required
              maxLength={100}
              defaultValue={department.name}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="dept-description"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Description
            </label>
            <input
              id="dept-description"
              name="description"
              type="text"
              maxLength={1000}
              defaultValue={department.description ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Save department details
            </button>
          </div>
        </form>
      </section>

      {/* Pending Onboarding Applications for This Department */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Pending Staff Applications ({department.departmentUserApplications.length})
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Approve verified applicants to create their Department User
              account in {department.name}.
            </p>
          </div>

          <Link
            href="/organization/department-users"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            View all organization applications →
          </Link>
        </div>

        {department.departmentUserApplications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No pending staff applications for this department.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {department.departmentUserApplications.map((app) => (
              <article
                key={app.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {app.firstName} {app.middleName} {app.lastName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Email: {app.email}
                      {app.phone ? ` • Phone: ${app.phone}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Submitted {app.submittedAt.toLocaleString()}
                    </p>
                  </div>

                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    {app.status.replaceAll("_", " ")}
                  </span>
                </div>

                <form className="mt-4 space-y-3">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="returnTo" value={returnPath} />

                  <input
                    type="text"
                    name="reviewNotes"
                    maxLength={2000}
                    placeholder="Optional review note or rejection reason..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={!isActive}
                      formAction={approveApplicationFromDepartment}
                      className="rounded-lg bg-green-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                    >
                      Approve & send invitation
                    </button>

                    <button
                      type="submit"
                      formAction={rejectApplicationFromDepartment}
                      className="rounded-lg border border-red-300 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Reject application
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Assigned Department Members Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Department Members ({department.users.length})
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Department Users currently assigned to {department.name}.
            </p>
          </div>

          <Link
            href={`/organization/department-users?departmentId=${department.id}`}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Manage in Department Users directory →
          </Link>
        </div>

        {department.users.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No Department Users are assigned to this department yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {department.users.map((u) => {
                  const fullName =
                    [u.firstName, u.middleName, u.lastName]
                      .filter(Boolean)
                      .join(" ") || "Pending setup";
                  const isPendingSetup =
                    u.status === "INACTIVE" && !u.passwordHash;

                  return (
                    <tr key={u.id}>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {fullName}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {u.email ?? u.pendingEmail ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {u.phone ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : u.status === "SUSPENDED"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isPendingSetup ? "Pending setup" : u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {u.createdAt.toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Transportation Requests from This Department */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Transportation Requests ({department._count.transportationRequests})
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Latest transportation requests submitted by {department.name}.
          </p>
        </div>

        {department.transportationRequests.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No transportation requests have been submitted by this department
            yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Purpose</th>
                  <th className="px-6 py-3">Route</th>
                  <th className="px-6 py-3">Passengers</th>
                  <th className="px-6 py-3">Requested By</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {department.transportationRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {req.purpose}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {req.origin} → {req.destination}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {req.passengerCount}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {[req.requestedBy.firstName, req.requestedBy.lastName]
                        .filter(Boolean)
                        .join(" ") || req.requestedBy.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          req.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : req.status === "REJECTED" ||
                                req.status === "CANCELLED"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}