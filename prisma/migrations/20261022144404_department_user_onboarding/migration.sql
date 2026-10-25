-- CreateEnum
CREATE TYPE "DepartmentUserApplicationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "department_registration_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_registration_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_user_applications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "first_name" VARCHAR(150) NOT NULL,
    "middle_name" VARCHAR(150) NOT NULL,
    "last_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "status" "DepartmentUserApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "review_notes" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_user_id" UUID,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "department_user_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_registration_links_token_hash_key" ON "department_registration_links"("token_hash");

-- CreateIndex
CREATE INDEX "department_registration_links_organization_id_created_at_idx" ON "department_registration_links"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "department_registration_links_created_by_id_idx" ON "department_registration_links"("created_by_id");

-- CreateIndex
CREATE INDEX "department_user_applications_organization_id_status_submitt_idx" ON "department_user_applications"("organization_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "department_user_applications_organization_id_department_id_idx" ON "department_user_applications"("organization_id", "department_id");

-- CreateIndex
CREATE INDEX "department_user_applications_organization_id_email_idx" ON "department_user_applications"("organization_id", "email");

-- CreateIndex
CREATE INDEX "department_user_applications_reviewed_by_id_idx" ON "department_user_applications"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_user_applications_organization_id_created_user_i_key" ON "department_user_applications"("organization_id", "created_user_id");

-- AddForeignKey
ALTER TABLE "department_registration_links" ADD CONSTRAINT "department_registration_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_registration_links" ADD CONSTRAINT "department_registration_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_user_applications" ADD CONSTRAINT "department_user_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_user_applications" ADD CONSTRAINT "department_user_applications_organization_id_department_id_fkey" FOREIGN KEY ("organization_id", "department_id") REFERENCES "departments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_user_applications" ADD CONSTRAINT "department_user_applications_organization_id_reviewed_by_i_fkey" FOREIGN KEY ("organization_id", "reviewed_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_user_applications" ADD CONSTRAINT "department_user_applications_organization_id_created_user__fkey" FOREIGN KEY ("organization_id", "created_user_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
