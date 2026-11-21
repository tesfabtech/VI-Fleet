import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;
export type AllowedDocumentExtension = (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number];

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
  extension?: string;
}

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Supabase storage credentials are not configured on the server.",
    );
  }

  supabaseInstance = createClient(url, secretKey, {
    auth: { persistSession: false },
  });
  return supabaseInstance;
}

export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "vi-fleet-files";
}

/**
 * Detect file type based on binary signature (magic bytes).
 */
export function detectFileSignature(
  buffer: Buffer,
): { mimeType: string; extension: AllowedDocumentExtension } | null {
  if (!buffer || buffer.length < 3) {
    return null;
  }

  // PDF signature: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { mimeType: "application/pdf", extension: "pdf" };
  }

  // JPEG signature: 0xFF, 0xD8, 0xFF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  // PNG signature: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }

  return null;
}

/**
 * Server-side validation of official organization documents.
 * Validates file size, extension, MIME type, and binary file signatures.
 */
export function validateOfficialDocumentBuffer(
  fileName: string,
  buffer: Buffer,
  clientMimeType?: string,
): DocumentValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: "The uploaded document file is empty.",
    };
  }

  if (buffer.length > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Document file size (${(buffer.length / 1024 / 1024).toFixed(1)} MB) exceeds the maximum allowed limit of 10 MB.`,
    };
  }

  const parts = fileName.split(".");
  if (parts.length < 2) {
    return {
      valid: false,
      error: "The uploaded file must have a valid extension (.pdf, .jpg, .jpeg, or .png).",
    };
  }

  const ext = parts.pop()!.toLowerCase();
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext as AllowedDocumentExtension)) {
    return {
      valid: false,
      error: "Invalid file extension. Only PDF, JPG, JPEG, and PNG files are accepted.",
    };
  }

  const detected = detectFileSignature(buffer);
  if (!detected) {
    return {
      valid: false,
      error: "The file content does not match any accepted format (PDF, JPG, PNG). Upload a valid document file.",
    };
  }

  // Check extension matches detected signature
  if (detected.extension === "pdf" && ext !== "pdf") {
    return {
      valid: false,
      error: "File extension does not match the actual PDF content.",
    };
  }

  if (detected.extension === "jpg" && ext !== "jpg" && ext !== "jpeg") {
    return {
      valid: false,
      error: "File extension does not match the actual JPEG content.",
    };
  }

  if (detected.extension === "png" && ext !== "png") {
    return {
      valid: false,
      error: "File extension does not match the actual PNG content.",
    };
  }

  // Cross-check client MIME type if provided
  if (clientMimeType) {
    const normalizedClientMime = clientMimeType.toLowerCase().trim();
    const validClientMimes: Record<string, string[]> = {
      "application/pdf": ["application/pdf", "application/x-pdf"],
      "image/jpeg": ["image/jpeg", "image/pjpeg", "image/jpg"],
      "image/png": ["image/png", "image/x-png"],
    };

    const allowedMimes = validClientMimes[detected.mimeType] || [];
    if (allowedMimes.length > 0 && !allowedMimes.includes(normalizedClientMime)) {
      return {
        valid: false,
        error: "The file MIME type does not match the detected file content.",
      };
    }
  }

  return {
    valid: true,
    detectedMimeType: detected.mimeType,
    extension: ext,
  };
}

/**
 * Securely uploads an official organization document to private Supabase Storage.
 */
export async function uploadOfficialDocument(params: {
  applicationId: string;
  fileName: string;
  fileBuffer: Buffer;
  clientMimeType?: string;
}): Promise<{
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
}> {
  const validation = validateOfficialDocumentBuffer(
    params.fileName,
    params.fileBuffer,
    params.clientMimeType,
  );

  if (!validation.valid || !validation.detectedMimeType || !validation.extension) {
    throw new Error(validation.error || "Document validation failed.");
  }

  const supabase = getSupabaseClient();
  const bucket = getStorageBucket();

  const sanitizedOriginalName = params.fileName.trim().slice(0, 255);
  const uniqueFileId = randomUUID();
  const storageKey = `organization-applications/${params.applicationId}/official-document/${uniqueFileId}.${validation.extension}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storageKey, params.fileBuffer, {
      contentType: validation.detectedMimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Supabase official document upload error:", uploadError);
    throw new Error("Failed to upload official document. Please try again.");
  }

  return {
    storageKey,
    originalFileName: sanitizedOriginalName,
    mimeType: validation.detectedMimeType,
    fileSize: params.fileBuffer.byteLength,
  };
}

/**
 * Generates a short-lived signed URL for a System Administrator to view or download a document.
 */
export async function getOfficialDocumentSignedUrl(
  storageKey: string,
  options?: { expiresIn?: number; download?: boolean | string },
): Promise<string> {
  const supabase = getSupabaseClient();
  const bucket = getStorageBucket();
  const expiresIn = options?.expiresIn ?? 900; // 15 minutes default

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storageKey, expiresIn, {
      download: options?.download,
    });

  if (error || !data?.signedUrl) {
    console.error("Failed to generate official document signed URL:", error);
    throw new Error("Failed to generate secure document viewing link.");
  }

  return data.signedUrl;
}

/**
 * Best-effort deletion of an uploaded document if subsequent operations fail.
 */
export async function deleteOfficialDocument(storageKey: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const bucket = getStorageBucket();
    await supabase.storage.from(bucket).remove([storageKey]);
  } catch (error) {
    console.error("Failed to delete official document from storage:", error);
  }
}
