import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { startTrip } from "@/lib/driver-trip/trip-execution-service";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError, type StartTripInput } from "@/lib/driver-trip/types";

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

    const body = (await req.json()) as StartTripInput;
    if (body.startOdometer === undefined || body.startOdometer === null) {
      throw new ValidationError("startOdometer field is required.");
    }

    const result = await startTrip(tripId, body, authContext);
    return jsonSuccess(
      result,
      result.alreadyStarted ? "Trip was already started." : "Trip started successfully.",
      result.alreadyStarted ? 200 : 201,
    );
  } catch (err) {
    return jsonError(err);
  }
}
