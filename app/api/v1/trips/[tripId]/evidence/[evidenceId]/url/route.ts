import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { getEvidenceSignedUrl } from "@/lib/driver-trip/evidence-service";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError } from "@/lib/driver-trip/types";

type RouteProps = {
  params: Promise<{ tripId: string; evidenceId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const authContext = await resolveAuthContext(req);
    const { tripId, evidenceId } = await params;
    if (!isUuid(tripId) || !isUuid(evidenceId)) {
      throw new ValidationError("Invalid trip or evidence ID format.");
    }

    const { searchParams } = new URL(req.url);
    const expiresIn = searchParams.get("expiresIn")
      ? parseInt(searchParams.get("expiresIn")!, 10)
      : 900;

    const result = await getEvidenceSignedUrl(tripId, evidenceId, authContext, expiresIn);

    // If opened directly from browser navigation bar or with ?redirect=true,
    // redirect directly to the signed image URL instead of displaying raw JSON
    const wantsRedirect =
      searchParams.get("redirect") === "true" ||
      searchParams.get("redirect") === "1" ||
      (req.headers.get("accept")?.includes("text/html") &&
        !req.headers.get("accept")?.includes("application/json"));

    if (wantsRedirect) {
      return NextResponse.redirect(result.url);
    }

    return jsonSuccess(result);
  } catch (err) {
    return jsonError(err);
  }
}
