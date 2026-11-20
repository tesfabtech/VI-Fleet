import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ServiceError,
  type AuthContext,
  type EvidenceUploadParams,
  TRANSPORT_MANAGERS,
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
} from "./types";
import { Prisma } from "@prisma/client";

const ALLOWED_MIME_TYPES = ALLOWED_EVIDENCE_MIME_TYPES;
const MAX_FILE_SIZE_BYTES = MAX_EVIDENCE_FILE_SIZE_BYTES;

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new ServiceError(
      "Supabase storage credentials are not configured on the server.",
      500,
      "STORAGE_CONFIG_ERROR",
    );
  }

  supabaseInstance = createClient(url, secretKey, {
    auth: { persistSession: false },
  });
  return supabaseInstance;
}

export function getBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "vi-fleet-files";
}

export async function uploadTripEvidence(
  params: EvidenceUploadParams,
  authContext: AuthContext,
) {
  const { tripId, evidenceType, fileName, mimeType, fileBuffer, odometerReading } = params;

  // 1. Validation
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new ValidationError(
      `Unsupported image type "${mimeType}". Allowed types: JPEG, PNG, WEBP.`,
    );
  }

  if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `Image size (${(fileBuffer.byteLength / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size of 5 MB.`,
    );
  }

  if (fileBuffer.byteLength === 0) {
    throw new ValidationError("Uploaded file is empty.");
  }

  // 2. Validate Trip and Authorization
  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      organizationId: authContext.organizationId,
      deletedAt: null,
    },
    select: { id: true, driverId: true, status: true },
  });

  if (!trip) {
    throw new NotFoundError("Trip not found or does not belong to your organization.");
  }

  const isAssignedDriver =
    authContext.role === "DRIVER" && authContext.driver?.id === trip.driverId;
  const isManager = TRANSPORT_MANAGERS.includes(authContext.role);

  if (!isAssignedDriver && !isManager) {
    throw new ForbiddenError("Only the assigned driver or a transport manager can upload evidence for this trip.");
  }

  // 3. Generate secure scoped storage key
  const sanitizedName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "_")
    .slice(0, 100);
  const fileExt = sanitizedName.split(".").pop() || "jpg";
  const uniqueId = randomUUID();
  const storageKey = `organizations/${authContext.organizationId}/trips/${tripId}/evidence/${uniqueId}.${fileExt}`;

  // 4. Upload to private Supabase Storage bucket
  const supabase = getSupabaseClient();
  const bucket = getBucketName();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storageKey, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Supabase storage upload error:", uploadError);
    throw new ServiceError(
      `Failed to upload photo evidence: ${uploadError.message}`,
      502,
      "STORAGE_UPLOAD_ERROR",
    );
  }

  // 5. Save metadata in TripEvidence
  try {
    const evidence = await prisma.tripEvidence.create({
      data: {
        organizationId: authContext.organizationId,
        tripId,
        uploadedById: authContext.userId,
        evidenceType,
        storageKey,
        originalFileName: fileName.slice(0, 255),
        mimeType,
        fileSizeBytes: fileBuffer.byteLength,
        odometerReading:
          odometerReading !== null && odometerReading !== undefined
            ? new Prisma.Decimal(odometerReading)
            : null,
      },
    });

    return evidence;
  } catch (dbError) {
    // Attempt cleanup if DB insert fails
    await supabase.storage.from(bucket).remove([storageKey]).catch(() => {});
    throw dbError;
  }
}

export async function getEvidenceSignedUrl(
  tripId: string,
  evidenceId: string,
  authContext: AuthContext,
  expiresInSeconds = 900, // 15 minutes
): Promise<{ url: string; evidence: { id: string; evidenceType: string; originalFileName: string | null } }> {
  const evidence = await prisma.tripEvidence.findFirst({
    where: {
      id: evidenceId,
      tripId,
      organizationId: authContext.organizationId,
    },
    include: {
      trip: {
        select: {
          driverId: true,
        },
      },
    },
  });

  if (!evidence) {
    throw new NotFoundError("Evidence record not found.");
  }

  const isAssignedDriver =
    authContext.role === "DRIVER" && authContext.driver?.id === evidence.trip.driverId;
  const isManager = TRANSPORT_MANAGERS.includes(authContext.role);

  if (!isAssignedDriver && !isManager) {
    throw new ForbiddenError("You are not authorized to view evidence for this trip.");
  }

  const supabase = getSupabaseClient();
  const bucket = getBucketName();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(evidence.storageKey, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error("Failed to generate signed URL:", error);
    throw new ServiceError("Failed to generate secure image viewing URL.", 502, "STORAGE_URL_ERROR");
  }

  return {
    url: data.signedUrl,
    evidence: {
      id: evidence.id,
      evidenceType: evidence.evidenceType,
      originalFileName: evidence.originalFileName,
    },
  };
}
