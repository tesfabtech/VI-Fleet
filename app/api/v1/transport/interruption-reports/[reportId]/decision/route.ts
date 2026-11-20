import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { decideInterruptionReport } from "@/lib/driver-trip/interruption-review-service";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError, type InterruptionDecisionInput } from "@/lib/driver-trip/types";

type RouteProps = {
  params: Promise<{ reportId: string }>;
};

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const authContext = await resolveAuthContext(req);
    const { reportId } = await params;
    if (!isUuid(reportId)) {
      throw new ValidationError("Invalid report ID format.");
    }

    const body = (await req.json()) as InterruptionDecisionInput;
    if (!body.decision) {
      throw new ValidationError("decision field is required.");
    }

    const result = await decideInterruptionReport(reportId, body, authContext);
    return jsonSuccess(result, `Interruption report resolved with decision: ${body.decision}.`);
  } catch (err) {
    return jsonError(err);
  }
}
