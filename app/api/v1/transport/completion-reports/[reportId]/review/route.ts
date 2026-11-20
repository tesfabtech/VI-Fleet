import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { reviewCompletionReport } from "@/lib/driver-trip/completion-review-service";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError, type CompletionReviewInput } from "@/lib/driver-trip/types";

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

    const body = (await req.json()) as CompletionReviewInput;
    if (!body.action) {
      throw new ValidationError("action field (APPROVE or REQUEST_CLARIFICATION) is required.");
    }

    const result = await reviewCompletionReport(reportId, body, authContext);
    return jsonSuccess(
      result,
      body.action === "APPROVE"
        ? "Completion report approved."
        : "Clarification requested from driver.",
    );
  } catch (err) {
    return jsonError(err);
  }
}
