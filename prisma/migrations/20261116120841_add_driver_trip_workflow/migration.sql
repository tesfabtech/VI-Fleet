-- CreateEnum
CREATE TYPE "TripInterruptionReportStatus" AS ENUM ('PENDING_REVIEW', 'IN_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TripInterruptionCategory" AS ENUM ('VEHICLE_BREAKDOWN', 'ACCIDENT_OR_INCIDENT', 'ROAD_BLOCKED', 'WEATHER_CONDITIONS', 'DRIVER_UNAVAILABLE', 'PASSENGER_OR_CARGO_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "TripInterruptionDecision" AS ENUM ('RESUME', 'REASSIGN', 'CANCEL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "TripCompletionOutcome" AS ENUM ('SUCCESSFUL', 'COMPLETED_WITH_ISSUES', 'NOT_COMPLETED');

-- CreateEnum
CREATE TYPE "TripCompletionReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'NEEDS_CLARIFICATION');

-- CreateEnum
CREATE TYPE "TripEvidenceType" AS ENUM ('START_ODOMETER_PHOTO', 'COMPLETION_ODOMETER_PHOTO', 'OTHER');

-- CreateTable
CREATE TABLE "trip_status_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "previous_status" "TripStatus",
    "new_status" "TripStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_interruption_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "reported_by_driver_id" UUID NOT NULL,
    "category" "TripInterruptionCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TripInterruptionReportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "manager_decision" "TripInterruptionDecision",
    "resolution_notes" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trip_interruption_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_completion_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "submitted_by_driver_id" UUID NOT NULL,
    "outcome" "TripCompletionOutcome" NOT NULL,
    "description" TEXT,
    "submitted_end_odometer" DECIMAL(12,2),
    "odometer_unavailable_reason" TEXT,
    "review_status" "TripCompletionReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resubmitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trip_completion_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_evidence" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "evidence_type" "TripEvidenceType" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "original_file_name" VARCHAR(255),
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "odometer_reading" DECIMAL(12,2),
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_completion_report_revisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "completion_report_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "submitted_by_driver_id" UUID NOT NULL,
    "outcome" "TripCompletionOutcome" NOT NULL,
    "description" TEXT,
    "submitted_end_odometer" DECIMAL(12,2),
    "odometer_unavailable_reason" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_completion_report_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_status_history_organization_id_trip_id_created_at_idx" ON "trip_status_history"("organization_id", "trip_id", "created_at");

-- CreateIndex
CREATE INDEX "trip_status_history_organization_id_changed_by_id_created_a_idx" ON "trip_status_history"("organization_id", "changed_by_id", "created_at");

-- CreateIndex
CREATE INDEX "trip_interruption_reports_organization_id_status_reported_a_idx" ON "trip_interruption_reports"("organization_id", "status", "reported_at");

-- CreateIndex
CREATE INDEX "trip_interruption_reports_organization_id_trip_id_reported__idx" ON "trip_interruption_reports"("organization_id", "trip_id", "reported_at");

-- CreateIndex
CREATE INDEX "trip_interruption_reports_organization_id_reported_by_drive_idx" ON "trip_interruption_reports"("organization_id", "reported_by_driver_id");

-- CreateIndex
CREATE INDEX "trip_completion_reports_organization_id_review_status_submi_idx" ON "trip_completion_reports"("organization_id", "review_status", "submitted_at");

-- CreateIndex
CREATE INDEX "trip_completion_reports_organization_id_submitted_by_driver_idx" ON "trip_completion_reports"("organization_id", "submitted_by_driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_completion_reports_organization_id_id_key" ON "trip_completion_reports"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_completion_reports_organization_id_trip_id_key" ON "trip_completion_reports"("organization_id", "trip_id");

-- CreateIndex
CREATE INDEX "trip_evidence_organization_id_trip_id_evidence_type_uploade_idx" ON "trip_evidence"("organization_id", "trip_id", "evidence_type", "uploaded_at");

-- CreateIndex
CREATE INDEX "trip_evidence_organization_id_uploaded_by_id_idx" ON "trip_evidence"("organization_id", "uploaded_by_id");

-- CreateIndex
CREATE INDEX "trip_completion_report_revisions_organization_id_submitted__idx" ON "trip_completion_report_revisions"("organization_id", "submitted_by_driver_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "trip_completion_report_revisions_organization_id_completion_key" ON "trip_completion_report_revisions"("organization_id", "completion_report_id", "revision_number");

-- AddForeignKey
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_organization_id_trip_id_fkey" FOREIGN KEY ("organization_id", "trip_id") REFERENCES "trips"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_organization_id_changed_by_id_fkey" FOREIGN KEY ("organization_id", "changed_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_interruption_reports" ADD CONSTRAINT "trip_interruption_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_interruption_reports" ADD CONSTRAINT "trip_interruption_reports_organization_id_trip_id_fkey" FOREIGN KEY ("organization_id", "trip_id") REFERENCES "trips"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_interruption_reports" ADD CONSTRAINT "trip_interruption_reports_organization_id_reported_by_driv_fkey" FOREIGN KEY ("organization_id", "reported_by_driver_id") REFERENCES "drivers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_interruption_reports" ADD CONSTRAINT "trip_interruption_reports_organization_id_reviewed_by_id_fkey" FOREIGN KEY ("organization_id", "reviewed_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_completion_reports" ADD CONSTRAINT "trip_completion_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_completion_reports" ADD CONSTRAINT "trip_completion_reports_organization_id_trip_id_fkey" FOREIGN KEY ("organization_id", "trip_id") REFERENCES "trips"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_completion_reports" ADD CONSTRAINT "trip_completion_reports_organization_id_submitted_by_drive_fkey" FOREIGN KEY ("organization_id", "submitted_by_driver_id") REFERENCES "drivers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_completion_reports" ADD CONSTRAINT "trip_completion_reports_organization_id_reviewed_by_id_fkey" FOREIGN KEY ("organization_id", "reviewed_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_evidence" ADD CONSTRAINT "trip_evidence_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_evidence" ADD CONSTRAINT "trip_evidence_organization_id_trip_id_fkey" FOREIGN KEY ("organization_id", "trip_id") REFERENCES "trips"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_evidence" ADD CONSTRAINT "trip_evidence_organization_id_uploaded_by_id_fkey" FOREIGN KEY ("organization_id", "uploaded_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_completion_report_revisions" ADD CONSTRAINT "trip_completion_report_revisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_completion_report_revisions" ADD CONSTRAINT "trip_completion_report_revisions_organization_id_completio_fkey" FOREIGN KEY ("organization_id", "completion_report_id") REFERENCES "trip_completion_reports"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_completion_report_revisions" ADD CONSTRAINT "trip_completion_report_revisions_organization_id_submitted_fkey" FOREIGN KEY ("organization_id", "submitted_by_driver_id") REFERENCES "drivers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
