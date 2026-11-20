import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { uploadTripEvidence } from "@/lib/driver-trip/evidence-service";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError, type TripEvidenceType } from "@/lib/driver-trip/types";

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const evidenceType = (formData.get("evidenceType") as TripEvidenceType) || "START_ODOMETER_PHOTO";
    const rawOdo = formData.get("odometerReading");
    const odometerReading = rawOdo ? Number(rawOdo) : null;

    if (!file) {
      throw new ValidationError("No file attached in multipart form data ('file' key).");
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const evidence = await uploadTripEvidence(
      {
        tripId,
        evidenceType,
        fileName: file.name || "evidence.jpg",
        mimeType: file.type || "image/jpeg",
        fileBuffer,
        odometerReading,
      },
      authContext,
    );

    return jsonSuccess(evidence, "Photo evidence uploaded successfully.", 201);
  } catch (err) {
    return jsonError(err);
  }
}
