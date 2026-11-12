import { NextRequest } from "next/server";
import { resolveReportsAccess } from "@/lib/reports/access";
import { validateReportFilters } from "@/lib/reports/validation";
import { fetchReportData } from "@/lib/reports/queries";
import { buildReportCsv } from "@/lib/reports/business-logic";

export async function GET(request: NextRequest) {
  const access = await resolveReportsAccess();

  if (access.status === "unauthenticated") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (access.status === "forbidden" || access.status === "select-organization") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const searchParams = request.nextUrl.searchParams;
  const filter = validateReportFilters(
    {
      type: searchParams.get("type"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      search: searchParams.get("search"),
      status: searchParams.get("status"),
      range: searchParams.get("range"),
      limit: searchParams.get("limit") || 1000,
    },
    { isExport: true },
  );

  const reportData = await fetchReportData(
    access.context.organizationId,
    filter,
  );

  const csv = buildReportCsv(
    filter.type,
    reportData.records as Array<Record<string, unknown>>,
  );

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `vi-fleet-${filter.type}-report-${dateStr}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
