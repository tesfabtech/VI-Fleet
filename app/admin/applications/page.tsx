import Link from "next/link";
import { prisma } from "@/lib/prisma";

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  UNDER_REVIEW: "bg-blue-50 text-blue-800",
  APPROVED: "bg-green-50 text-green-800",
  REJECTED: "bg-red-50 text-red-800",
};

export default async function ApplicationsPage() {
  const applications = await prisma.organizationApplication.findMany({
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      organizationName: true,
      contactEmail: true,
      status: true,
      paymentStatus: true,
      submittedAt: true,
    },
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <Link
            href="/admin"
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            ← Admin dashboard
          </Link>

          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Organization applications
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Review and manage requests to join VI-Fleet.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {applications.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h2 className="font-semibold text-gray-900">
                No applications yet
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                New organization applications will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-6 py-4 font-semibold">
                      Organization
                    </th>
                    <th className="px-6 py-4 font-semibold">
                      Contact email
                    </th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Submitted</th>
                    <th className="px-6 py-4 font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {applications.map((application) => (
                    <tr key={application.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {application.organizationName}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {application.contactEmail}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            statusStyles[application.status] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {application.status.replaceAll("_", " ")}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {application.submittedAt.toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/applications/${application.id}`}
                          className="font-semibold text-blue-700 hover:text-blue-800"
                        >
                          View details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}