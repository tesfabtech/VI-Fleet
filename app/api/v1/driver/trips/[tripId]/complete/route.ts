import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { completeTrip } from "@/lib/driver-trip/trip-execution-service";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError, type CompleteTripInput } from "@/lib/driver-trip/types";

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

    const body = (await req.json()) as CompleteTripInput;
    if (!body.outcome) {
      throw new ValidationError("outcome field is required.");
    }

    const result = await completeTrip(tripId, body, authContext);
    return jsonSuccess(
      result,
      result.alreadyCompleted
        ? "Trip was already completed."
        : "Trip completed and completion report submitted for review.",
      result.alreadyCompleted ? 200 : 201,
    );
  } catch (err) {
    return jsonError(err);
  }
}
