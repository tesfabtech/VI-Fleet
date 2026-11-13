import { notFound, redirect } from "next/navigation";
import {
  resolveReportsAccess,
  listReportsOrganizations,
} from "@/lib/reports/access";
import {
  validateReportFilters,
  type ReportType,
  type QuickDateRange,
} from "@/lib/reports/validation";
import { fetchReportData } from "@/lib/reports/queries";
import ReportsView from "@/components/reports/reports-view";
import ReportsOrganizationPicker from "@/components/reports/reports-organization-picker";

type ReportsPageProps = {
  searchParams: Promise<{
    type?: string | string[];
    range?: string | string[];
    startDate?: string | string[];
    endDate?: string | string[];
    search?: string | string[];
    status?: string | string[];
  }>;
};

function paramStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || "";
  return val || "";
}

export default async function TransportReportsPage({
  searchParams,
}: ReportsPageProps) {
  const access = await resolveReportsAccess();

  if (access.status === "unauthenticated") {
    redirect("/login");
  }

  if (access.status === "forbidden") {
    notFound();
  }

  const organizations =
    access.status === "select-organization" ||
    access.context.isSystemAdministrator
      ? await listReportsOrganizations()
      : [];

  if (access.status === "select-organization") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Operational Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select an organization below to view and export reports.
          </p>
        </div>
        <ReportsOrganizationPicker organizations={organizations} />
      </div>
    );
  }

  const params = await searchParams;
  const initialType = (paramStr(params.type) || "vehicle-usage") as ReportType;
  const initialRange = (paramStr(params.range) || "all") as QuickDateRange;
  const initialStartDate = paramStr(params.startDate);
  const initialEndDate = paramStr(params.endDate);
  const initialSearch = paramStr(params.search);
  const initialStatus = paramStr(params.status);

  const filter = validateReportFilters({
    type: initialType,
    range: initialRange,
    startDate: initialStartDate,
    endDate: initialEndDate,
    search: initialSearch,
    status: initialStatus,
  });

  const reportData = await fetchReportData(
    access.context.organizationId,
    filter,
  );

  return (
    <div className="space-y-6">
      {access.context.isSystemAdministrator && (
        <ReportsOrganizationPicker
          organizations={organizations}
          currentOrganizationId={access.context.organizationId}
        />
      )}

      <ReportsView
        reportData={reportData}
        initialType={filter.type}
        initialRange={filter.range}
        initialStartDate={initialStartDate}
        initialEndDate={initialEndDate}
        initialSearch={initialSearch}
        initialStatus={initialStatus}
        organizationName={access.context.organizationName}
      />
    </div>
  );
}
