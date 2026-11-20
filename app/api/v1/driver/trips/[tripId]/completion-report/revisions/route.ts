import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { submitCompletionRevision } from "@/lib/driver-trip/completion-review-service";
import { prisma } from "@/lib/prisma";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError, NotFoundError, type CreateRevisionInput } from "@/lib/driver-trip/types";

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

    const report = await prisma.tripCompletionReport.findFirst({
      where: {
        tripId,
        organizationId: authContext.organizationId,
      },
      select: { id: true },
    });

    if (!report) {
      throw new NotFoundError("Completion report not found for this trip.");
    }

    const body = (await req.json()) as CreateRevisionInput;
    if (!body.outcome) {
      throw new ValidationError("outcome field is required.");
    }

    const result = await submitCompletionRevision(report.id, body, authContext);
    return jsonSuccess(result, "Revision submitted successfully and is now pending review.", 201);
  } catch (err) {
    return jsonError(err);
  }
}
