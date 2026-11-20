import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import {
  submitInterruptionReport,
  getTripInterruptionReports,
} from "@/lib/driver-trip/interruption-service";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError, type CreateInterruptionReportInput } from "@/lib/driver-trip/types";

type RouteProps = {
  params: Promise<{ tripId: string }>;
};

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const authContext = await resolveAuthContext(req);
    const { tripId } = await params;
    if (!isUuid(tripId)) {
      throw new ValidationError("Invalid trip ID format.");
    }

    const body = (await req.json()) as CreateInterruptionReportInput;
    if (!body.category || !body.description) {
      throw new ValidationError("category and description fields are required.");
    }

    const report = await submitInterruptionReport(tripId, body, authContext);
    return jsonSuccess(report, "Interruption report submitted and pending manager review.", 201);
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const authContext = await resolveAuthContext(req);
    const { tripId } = await params;
    if (!isUuid(tripId)) {
      throw new ValidationError("Invalid trip ID format.");
    }

    const reports = await getTripInterruptionReports(tripId, authContext);
    return jsonSuccess(reports);
  } catch (err) {
    return jsonError(err);
  }
}
