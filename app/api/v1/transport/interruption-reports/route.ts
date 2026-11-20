import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { getManagerInterruptionReports } from "@/lib/driver-trip/driver-trip-query-service";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import type { TripInterruptionReportStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const authContext = await resolveAuthContext(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as TripInterruptionReportStatus | undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined;

    const result = await getManagerInterruptionReports(authContext, { status, limit, offset });
    return jsonSuccess(result);
  } catch (err) {
    return jsonError(err);
  }
}
