import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createDepartment,
  setDepartmentStatus,
  updateDepartment,
} from "./actions";

type DepartmentsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "name-required": "Enter a department name.",
  "name-too-long": "Department names must be 100 characters or fewer.",
  "duplicate-name":
    "A department with that name already exists in your organization.",
  "department-not-found": "That department could not be found.",
  "invalid-department": "The department details are invalid.",
  "invalid-status": "The requested department status is invalid.",
};

const successMessages: Record<string, string> = {
  created: "Department created successfully.",
  updated: "Department updated successfully.",
  deactivated: "Department deactivated successfully.",
  reactivated: "Department reactivated successfully.",
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

  const [departments, activeCount, inactiveCount] = await Promise.all([
    prisma.department.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
      },
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
  ]);

  const errorMessage = params.error
    ? errorMessages[params.error] ?? "Something went wrong. Please try again."
    : null;

  const successMessage = params.success
    ? successMessages[params.success] ?? null
    : null;

  return (
    <div className="space-y-8">
      <section>
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
            Create and manage departments within your organization. Department
            records remain available when deactivated.
          </p>
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

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total departments" value={departments.length} />
        <StatCard label="Active departments" value={activeCount} />
        <StatCard label="Inactive departments" value={inactiveCount} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Create department
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Department names must be unique within your organization.
        </p>

        <form action={createDepartment} className="mt-5 space-y-4">
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
              placeholder="e.g. Finance"
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
            <textarea
              id="new-department-description"
              name="description"
              rows={3}
              placeholder="What does this department do?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
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
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Your departments
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Edit details or change a department’s status.
          </p>
        </div>

        {departments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h4 className="font-semibold text-slate-900">
              No departments yet
            </h4>
            <p className="mt-2 text-sm text-slate-500">
              Create your first department using the form above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {departments.map((department) => {
              const isActive = department.status === "ACTIVE";

              return (
                <article key={department.id} className="p-6">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {department.name}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          Created{" "}
                          {department.createdAt.toLocaleDateString()}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <form
                      action={updateDepartment}
                      className="grid gap-4 md:grid-cols-2"
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={department.id}
                      />

                      <div>
                        <label
                          htmlFor={`name-${department.id}`}
                          className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                          Department name
                        </label>
                        <input
                          id={`name-${department.id}`}
                          name="name"
                          type="text"
                          required
                          maxLength={100}
                          defaultValue={department.name}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`description-${department.id}`}
                          className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                          Description
                        </label>
                        <textarea
                          id={`description-${department.id}`}
                          name="description"
                          rows={2}
                          defaultValue={department.description ?? ""}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Save changes
                        </button>
                      </div>
                    </form>

                    <div className="border-t border-slate-100 pt-4">
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
                          className={`text-sm font-semibold ${
                            isActive
                              ? "text-red-600 hover:text-red-700"
                              : "text-green-700 hover:text-green-800"
                          }`}
                        >
                          {isActive
                            ? "Deactivate department"
                            : "Reactivate department"}
                        </button>
                      </form>
                    </div>
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
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </article>
  );
}