import type {
  TripStatus,
  TripInterruptionCategory,
  TripInterruptionReportStatus,
  TripInterruptionDecision,
  TripCompletionOutcome,
  TripCompletionReviewStatus,
  TripEvidenceType,
  UserRole,
  DriverStatus,
  VehicleAvailability,
} from "@prisma/client";

export type {
  TripStatus,
  TripInterruptionCategory,
  TripInterruptionReportStatus,
  TripInterruptionDecision,
  TripCompletionOutcome,
  TripCompletionReviewStatus,
  TripEvidenceType,
  UserRole,
  DriverStatus,
  VehicleAvailability,
};

export const TRANSPORT_MANAGERS: UserRole[] = [
  "SYSTEM_ADMINISTRATOR",
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
];

export const ALLOWED_EVIDENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_EVIDENCE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface AuthenticatedDriverProfile {
  id: string;
  userId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  licenseNumber: string;
  status: DriverStatus;
  preferredVehicleId: string | null;
}

export interface AuthContext {
  userId: string;
  userName: string;
  userEmail: string | null;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  driver?: AuthenticatedDriverProfile | null;
}

export class ServiceError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends ServiceError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends ServiceError {
  constructor(message = "Conflicting state or duplicate operation") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class ValidationError extends ServiceError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 422, "UNPROCESSABLE_ENTITY", details);
    this.name = "ValidationError";
  }
}

// Input DTOs
export interface StartTripInput {
  startOdometer: number;
  notes?: string | null;
  evidenceId?: string | null;
  idempotencyKey?: string | null;
}

export interface CompleteTripInput {
  outcome: TripCompletionOutcome;
  endOdometer?: number | null;
  odometerUnavailableReason?: string | null;
  description?: string | null;
  evidenceId?: string | null;
  idempotencyKey?: string | null;
}

export interface CreateInterruptionReportInput {
  category: TripInterruptionCategory;
  description: string;
}

export interface InterruptionDecisionInput {
  decision: TripInterruptionDecision;
  resolutionNotes?: string | null;
  newVehicleId?: string | null;
  newDriverId?: string | null;
  cancellationReason?: string | null;
}

export interface CompletionReviewInput {
  action: "APPROVE" | "REQUEST_CLARIFICATION";
  reviewNotes?: string | null;
}

export interface CreateRevisionInput {
  outcome: TripCompletionOutcome;
  endOdometer?: number | null;
  odometerUnavailableReason?: string | null;
  description?: string | null;
}

export interface EvidenceUploadParams {
  tripId: string;
  evidenceType: TripEvidenceType;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  odometerReading?: number | null;
}
