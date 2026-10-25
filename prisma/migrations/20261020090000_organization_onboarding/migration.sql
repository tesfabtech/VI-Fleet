/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OrganizationApplicationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrganizationPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "code" VARCHAR(20),
ADD COLUMN     "contact_email" VARCHAR(255),
ADD COLUMN     "phone" VARCHAR(30);

-- CreateTable
CREATE TABLE "organization_applications" (
    "id" UUID NOT NULL,
    "organization_name" VARCHAR(150) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "description" TEXT,
    "status" "OrganizationApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "OrganizationPaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "review_notes" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "organization_id" UUID,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_applications_organization_id_key" ON "organization_applications"("organization_id");

-- CreateIndex
CREATE INDEX "organization_applications_status_submitted_at_idx" ON "organization_applications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "organization_applications_contact_email_idx" ON "organization_applications"("contact_email");

-- CreateIndex
CREATE INDEX "organization_applications_reviewed_by_id_idx" ON "organization_applications"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_hash_key" ON "organization_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "organization_invitations_user_id_created_at_idx" ON "organization_invitations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "organization_invitations_created_by_id_idx" ON "organization_invitations"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- AddForeignKey
ALTER TABLE "organization_applications" ADD CONSTRAINT "organization_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_applications" ADD CONSTRAINT "organization_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
