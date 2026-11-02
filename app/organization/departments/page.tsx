import Link from "next/link";
import { redirect } from "next/navigation";
import { DepartmentStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createDepartment,
  deleteEmptyDepartment,
  setDepartmentStatus,
  updateDepartment,
} from "./actions";

type DepartmentsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    q?: string;
    filter?: string;
    sort?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "name-required": "Enter a department name.",
  "name-too-long": "Department names must be 100 characters or fewer.",
  "description-too-long":
    "Department descriptions must be 1,000 characters or fewer.",
  "duplicate-name":
    "A department with that name already exists in your organization.",
  "department-not-found": "That department could not be found.",
  "invalid-department": "The department details are invalid.",
  "invalid-status": "The requested department status is invalid.",
  "has-pending-requests":
    "This department has pending transportation requests. Resolve or cancel its pending requests before deactivating it.",
  "department-not-empty":
    "Only departments with zero users, applications, and transportation requests can be deleted. Deactivate the department instead.",
  "organization-inactive":
    "Your organization is inactive. Department changes are currently unavailable.",
};

const successMessages: Record<string, string> = {
  created: "Department created successfully.",
  updated: "Department updated successfully.",
  deactivated: "Department deactivated successfully.",
  reactivated: "Department reactivated successfully.",
  deleted: "Empty department removed successfully.",
};

export default async function DepartmentsPage({
  searchParams,
}: DepartmentsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const allowedRoles = [
    "ORGANIZATION_ADMINISTRATOR",
    "VICE_ORGANIZATION_ADMINISTRATOR",
  ];

  if (!allowedRoles.includes(session.user.role)) {
    redirect("/dashboard");
  }

  const organizationId = session.user.organizationId;

  if (!organizationId) {
    redirect("/login");
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const statusFilter =
    params.filter === "ACTIVE" || params.filter === "INACTIVE"
      ? (params.filter as DepartmentStatus)
      : undefined;
  const sortOption =
    params.sort === "members" || params.sort === "newest"
      ? params.sort
      : "name";

  const orderBy: Prisma.DepartmentOrderByWithRelationInput[] =
    sortOption === "members"
      ? [{ users: { _count: "desc" } }, { name: "asc" }]
      : sortOption === "newest"
        ? [{ createdAt: "desc" }]
        : [{ name: "asc" }];

  const now = new Date();

  const [
    departments,
    totalCount,
    activeCount,
    inactiveCount,
    pendingApplicationsCount,
    activeRegistrationLink,
  ] = await Promise.all([
    prisma.department.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            departmentUserApplications: true,
            transportationRequests: { where: { deletedAt: null } },
          },
        },
        departmentUserApplications: {
          where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
          select: { id: true },
        },
        transportationRequests: {
          where: { status: "PENDING", deletedAt: null },
          select: { id: true },
        },
      },
    }),
    prisma.department.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.department.count({
      where: {
        organizationId,
        deletedAt: null,
        status: "ACTIVE",
      },
    }),
    prisma.department.count({
      where: {
        organizationId,
        deletedAt: null,
        status: "INACTIVE",
      },
    }),
    prisma.departmentUserApplication.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "UNDER_REVIEW"] },
      },
    }),
    prisma.departmentRegistrationLink.findFirst({
      where: {
        organizationId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
        expiresAt: true,
      },
    }),
  ]);

  const errorMessage = params.error
    ? errorMessages[params.error] ?? "Something went wrong. Please try again."
    : null;

  const successMessage = params.success
    ? successMessages[params.success] ?? null
    : null;

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            href="/organization"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to overview
          </Link>

          <div className="mt-4">
            <p className="text-sm font-medium text-blue-600">
              Organization workspace
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Departments
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Create and manage departments within your organization, monitor
              department members and requests, and control which departments are
              open for staff registration.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/organization/department-users/registration-links"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            Registration link:{" "}
            <span
              className={
                activeRegistrationLink ? "text-green-700" : "text-slate-500"
              }
            >
              {activeRegistrationLink ? "Active" : "Inactive"}
            </span>
          </Link>

          <Link
            href="/organization/department-users"
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            Review applications ({pendingApplicationsCount})
          </Link>
        </div>
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total departments"
          value={totalCount}
          detail="Registered in your organization"
        />
        <StatCard
          label="Active departments"
          value={activeCount}
          detail="Open for registration & requests"
        />
        <StatCard
          label="Inactive departments"
          value={inactiveCount}
          detail="Hidden from new applications"
        />
        <StatCard
          label="Pending applications"
          value={pendingApplicationsCount}
          detail="Awaiting administrator review"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Create department
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Department names must be unique within your organization. Newly
          created departments are active by default.
        </p>

        <form action={createDepartment} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="new-department-name"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Department name <span className="text-red-600">*</span>
              </label>
              <input
                id="new-department-name"
                name="name"
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Department of Software Engineering"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="new-department-description"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Description <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="new-department-description"
                name="description"
                type="text"
                maxLength={1000}
                placeholder="College, directorate, or operational scope..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Create department
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Your departments ({departments.length})
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Click any department to view its full details, members,
              applications, and transportation requests.
            </p>
          </div>

          <form
            method="GET"
            action="/organization/departments"
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search name or description..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />

            <select
              name="filter"
              defaultValue={statusFilter ?? "ALL"}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active only</option>
              <option value="INACTIVE">Inactive only</option>
            </select>

            <select
              name="sort"
              defaultValue={sortOption}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="name">Sort: Name (A–Z)</option>
              <option value="members">Sort: Most members</option>
              <option value="newest">Sort: Newest first</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply
            </button>

            {(query || statusFilter || sortOption !== "name") && (
              <Link
                href="/organization/departments"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset
              </Link>
            )}
          </form>
        </div>

        {departments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h4 className="font-semibold text-slate-900">
              {totalCount === 0
                ? "No departments yet"
                : "No departments match your filter"}
            </h4>
            <p className="mt-2 text-sm text-slate-500">
              {totalCount === 0
                ? "Create your first department using the form above."
                : "Try clearing your search query or changing the status filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {departments.map((department) => {
              const isActive = department.status === "ACTIVE";
              const pendingApps =
                department.departmentUserApplications.length;
              const pendingReqs = department.transportationRequests.length;
              const isCompletelyEmpty =
                department._count.users === 0 &&
                department._count.departmentUserApplications === 0 &&
                department._count.transportationRequests === 0;

              return (
                <article key={department.id} className="p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Link
                            href={`/organization/departments/${department.id}`}
                            className="text-base font-bold text-slate-900 hover:text-blue-600 hover:underline"
                          >
                            {department.name}
                          </Link>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isActive
                                ? "bg-green-50 text-green-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              isActive
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {isActive
                              ? "Open for staff registration"
                              : "Registration closed"}
                          </span>
                        </div>

                        {department.description && (
                          <p className="mt-1.5 text-sm text-slate-600">
                            {department.description}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>
                            Created {department.createdAt.toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <Link
                            href={`/organization/departments/${department.id}`}
                            className="font-medium text-slate-700 hover:text-blue-600 hover:underline"
                          >
                            {department._count.users}{" "}
                            {department._count.users === 1 ? "member" : "members"}
                          </Link>
                          <span>•</span>
                          <span>
                            {department._count.transportationRequests} transport{" "}
                            {department._count.transportationRequests === 1
                              ? "request"
                              : "requests"}
                          </span>

                          {pendingApps > 0 && (
                            <>
                              <span>•</span>
                              <Link
                                href={`/organization/departments/${department.id}`}
                                className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-100"
                              >
                                {pendingApps} pending{" "}
                                {pendingApps === 1
                                  ? "application"
                                  : "applications"}
                              </Link>
                            </>
                          )}

                          {pendingReqs > 0 && (
                            <>
                              <span>•</span>
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                                {pendingReqs} pending{" "}
                                {pendingReqs === 1 ? "request" : "requests"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/organization/departments/${department.id}`}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View details →
                        </Link>

                        <form action={setDepartmentStatus}>
                          <input
                            type="hidden"
                            name="id"
                            value={department.id}
                          />
                          <input
                            type="hidden"
                            name="status"
                            value={isActive ? "INACTIVE" : "ACTIVE"}
                          />
                          <button
                            type="submit"
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                              isActive
                                ? "border-amber-200 text-amber-800 hover:bg-amber-50"
                                : "border-green-200 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>

                        {isCompletelyEmpty && (
                          <form action={deleteEmptyDepartment}>
                            <input
                              type="hidden"
                              name="id"
                              value={department.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Delete empty
                            </button>
                          </form>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Edit Form to keep the directory clean */}
                    <details className="group rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2.5">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700 select-none hover:text-blue-600">
                        Edit department name or description
                      </summary>

                      <form
                        action={updateDepartment}
                        className="mt-4 grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-2"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={department.id}
                        />

                        <div>
                          <label
                            htmlFor={`name-${department.id}`}
                            className="mb-1.5 block text-xs font-medium text-slate-700"
                          >
                            Department name{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            id={`name-${department.id}`}
                            name="name"
                            type="text"
                            required
                            maxLength={100}
                            defaultValue={department.name}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`description-${department.id}`}
                            className="mb-1.5 block text-xs font-medium text-slate-700"
                          >
                            Description
                          </label>
                          <input
                            id={`description-${department.id}`}
                            name="description"
                            type="text"
                            maxLength={1000}
                            defaultValue={department.description ?? ""}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="flex justify-end md:col-span-2">
                          <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            Save changes
                          </button>
                        </div>
                      </form>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}
