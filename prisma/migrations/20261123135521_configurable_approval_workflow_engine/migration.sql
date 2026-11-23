-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StageApprovalPolicy" AS ENUM ('ANY_ONE', 'ALL');

-- CreateEnum
CREATE TYPE "StageApproverType" AS ENUM ('USER', 'ROLE');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StageInstanceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'SKIP');

-- CreateEnum
CREATE TYPE "WorkflowEventType" AS ENUM ('WORKFLOW_CREATED', 'WORKFLOW_UPDATED', 'VERSION_CREATED', 'VERSION_PUBLISHED', 'VERSION_ARCHIVED', 'INSTANCE_STARTED', 'STAGE_ENTERED', 'DECISION_RECORDED', 'STAGE_COMPLETED', 'STAGE_SKIPPED', 'CHANGES_REQUESTED', 'REQUEST_RESUBMITTED', 'INSTANCE_APPROVED', 'INSTANCE_REJECTED', 'INSTANCE_CANCELLED');

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "workflow_type" VARCHAR(100) NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_version_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "published_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_stages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "stage_order" INTEGER NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "approval_policy" "StageApprovalPolicy" NOT NULL DEFAULT 'ANY_ONE',
    "required_permission_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_workflow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_stage_approvers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "approver_type" "StageApproverType" NOT NULL,
    "user_id" UUID,
    "role_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_stage_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_instances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "department_id" UUID,
    "requester_id" UUID NOT NULL,
    "current_stage_id" UUID,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_stage_instances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "iteration" INTEGER NOT NULL DEFAULT 1,
    "status" "StageInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "entered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "decision_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_stage_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "stage_instance_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "decision_type" "ApprovalDecisionType" NOT NULL,
    "comment" TEXT,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "stage_instance_id" UUID,
    "event_type" "WorkflowEventType" NOT NULL,
    "actor_id" UUID,
    "from_status" TEXT,
    "to_status" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_workflows_organization_id_workflow_type_idx" ON "approval_workflows"("organization_id", "workflow_type");

-- CreateIndex
CREATE INDEX "approval_workflows_organization_id_status_idx" ON "approval_workflows"("organization_id", "status");

-- CreateIndex
CREATE INDEX "approval_workflows_current_version_id_idx" ON "approval_workflows"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_organization_id_id_key" ON "approval_workflows"("organization_id", "id");

-- CreateIndex
CREATE INDEX "approval_workflow_versions_organization_id_status_idx" ON "approval_workflow_versions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "approval_workflow_versions_workflow_id_status_idx" ON "approval_workflow_versions"("workflow_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_versions_organization_id_id_key" ON "approval_workflow_versions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_versions_workflow_id_version_number_key" ON "approval_workflow_versions"("workflow_id", "version_number");

-- CreateIndex
CREATE INDEX "approval_workflow_stages_organization_id_idx" ON "approval_workflow_stages"("organization_id");

-- CreateIndex
CREATE INDEX "approval_workflow_stages_version_id_idx" ON "approval_workflow_stages"("version_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_stages_organization_id_id_key" ON "approval_workflow_stages"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_stages_version_id_stage_order_key" ON "approval_workflow_stages"("version_id", "stage_order");

-- CreateIndex
CREATE INDEX "approval_stage_approvers_stage_id_idx" ON "approval_stage_approvers"("stage_id");

-- CreateIndex
CREATE INDEX "approval_stage_approvers_organization_id_user_id_idx" ON "approval_stage_approvers"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "approval_stage_approvers_organization_id_role_id_idx" ON "approval_stage_approvers"("organization_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_stage_approvers_organization_id_id_key" ON "approval_stage_approvers"("organization_id", "id");

-- CreateIndex
CREATE INDEX "approval_workflow_instances_organization_id_entity_type_ent_idx" ON "approval_workflow_instances"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "approval_workflow_instances_organization_id_status_idx" ON "approval_workflow_instances"("organization_id", "status");

-- CreateIndex
CREATE INDEX "approval_workflow_instances_organization_id_requester_id_idx" ON "approval_workflow_instances"("organization_id", "requester_id");

-- CreateIndex
CREATE INDEX "approval_workflow_instances_workflow_version_id_idx" ON "approval_workflow_instances"("workflow_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_instances_organization_id_id_key" ON "approval_workflow_instances"("organization_id", "id");

-- CreateIndex
CREATE INDEX "approval_stage_instances_instance_id_status_idx" ON "approval_stage_instances"("instance_id", "status");

-- CreateIndex
CREATE INDEX "approval_stage_instances_organization_id_status_idx" ON "approval_stage_instances"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_stage_instances_organization_id_id_key" ON "approval_stage_instances"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_stage_instances_instance_id_stage_id_iteration_key" ON "approval_stage_instances"("instance_id", "stage_id", "iteration");

-- CreateIndex
CREATE INDEX "approval_decisions_organization_id_approver_id_idx" ON "approval_decisions"("organization_id", "approver_id");

-- CreateIndex
CREATE INDEX "approval_decisions_instance_id_idx" ON "approval_decisions"("instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_organization_id_id_key" ON "approval_decisions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_stage_instance_id_approver_id_key" ON "approval_decisions"("stage_instance_id", "approver_id");

-- CreateIndex
CREATE INDEX "approval_workflow_events_instance_id_created_at_idx" ON "approval_workflow_events"("instance_id", "created_at");

-- CreateIndex
CREATE INDEX "approval_workflow_events_organization_id_event_type_idx" ON "approval_workflow_events"("organization_id", "event_type");

-- CreateIndex
CREATE INDEX "approval_workflow_events_actor_id_idx" ON "approval_workflow_events"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_events_organization_id_id_key" ON "approval_workflow_events"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_organization_id_created_by_id_fkey" FOREIGN KEY ("organization_id", "created_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_organization_id_current_version_id_fkey" FOREIGN KEY ("organization_id", "current_version_id") REFERENCES "approval_workflow_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_versions" ADD CONSTRAINT "approval_workflow_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_versions" ADD CONSTRAINT "approval_workflow_versions_organization_id_workflow_id_fkey" FOREIGN KEY ("organization_id", "workflow_id") REFERENCES "approval_workflows"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_versions" ADD CONSTRAINT "approval_workflow_versions_organization_id_published_by_id_fkey" FOREIGN KEY ("organization_id", "published_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_stages" ADD CONSTRAINT "approval_workflow_stages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_stages" ADD CONSTRAINT "approval_workflow_stages_organization_id_version_id_fkey" FOREIGN KEY ("organization_id", "version_id") REFERENCES "approval_workflow_versions"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_approvers" ADD CONSTRAINT "approval_stage_approvers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_approvers" ADD CONSTRAINT "approval_stage_approvers_organization_id_stage_id_fkey" FOREIGN KEY ("organization_id", "stage_id") REFERENCES "approval_workflow_stages"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_approvers" ADD CONSTRAINT "approval_stage_approvers_organization_id_user_id_fkey" FOREIGN KEY ("organization_id", "user_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_approvers" ADD CONSTRAINT "approval_stage_approvers_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "organization_roles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_instances" ADD CONSTRAINT "approval_workflow_instances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_instances" ADD CONSTRAINT "approval_workflow_instances_organization_id_workflow_id_fkey" FOREIGN KEY ("organization_id", "workflow_id") REFERENCES "approval_workflows"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_instances" ADD CONSTRAINT "approval_workflow_instances_organization_id_workflow_versi_fkey" FOREIGN KEY ("organization_id", "workflow_version_id") REFERENCES "approval_workflow_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_instances" ADD CONSTRAINT "approval_workflow_instances_organization_id_department_id_fkey" FOREIGN KEY ("organization_id", "department_id") REFERENCES "departments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_instances" ADD CONSTRAINT "approval_workflow_instances_organization_id_requester_id_fkey" FOREIGN KEY ("organization_id", "requester_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_instances" ADD CONSTRAINT "approval_workflow_instances_organization_id_cancelled_by_i_fkey" FOREIGN KEY ("organization_id", "cancelled_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_instances" ADD CONSTRAINT "approval_stage_instances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_instances" ADD CONSTRAINT "approval_stage_instances_organization_id_instance_id_fkey" FOREIGN KEY ("organization_id", "instance_id") REFERENCES "approval_workflow_instances"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_instances" ADD CONSTRAINT "approval_stage_instances_organization_id_stage_id_fkey" FOREIGN KEY ("organization_id", "stage_id") REFERENCES "approval_workflow_stages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_organization_id_instance_id_fkey" FOREIGN KEY ("organization_id", "instance_id") REFERENCES "approval_workflow_instances"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_organization_id_stage_instance_id_fkey" FOREIGN KEY ("organization_id", "stage_instance_id") REFERENCES "approval_stage_instances"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_organization_id_approver_id_fkey" FOREIGN KEY ("organization_id", "approver_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_events" ADD CONSTRAINT "approval_workflow_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_events" ADD CONSTRAINT "approval_workflow_events_organization_id_instance_id_fkey" FOREIGN KEY ("organization_id", "instance_id") REFERENCES "approval_workflow_instances"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_events" ADD CONSTRAINT "approval_workflow_events_organization_id_stage_instance_id_fkey" FOREIGN KEY ("organization_id", "stage_instance_id") REFERENCES "approval_stage_instances"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_events" ADD CONSTRAINT "approval_workflow_events_organization_id_actor_id_fkey" FOREIGN KEY ("organization_id", "actor_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 1. CHECK CONSTRAINTS & PARTIAL UNIQUE INDEXES
ALTER TABLE "approval_stage_approvers"
  ADD CONSTRAINT "approval_stage_approvers_target_check" CHECK (
    ("approver_type" = 'USER' AND "user_id" IS NOT NULL AND "role_id" IS NULL) OR
    ("approver_type" = 'ROLE' AND "role_id" IS NOT NULL AND "user_id" IS NULL)
  );

CREATE UNIQUE INDEX "approval_stage_approvers_stage_user_idx"
  ON "approval_stage_approvers" ("stage_id", "user_id")
  WHERE "user_id" IS NOT NULL;

CREATE UNIQUE INDEX "approval_stage_approvers_stage_role_idx"
  ON "approval_stage_approvers" ("stage_id", "role_id")
  WHERE "role_id" IS NOT NULL;

-- 2. IMMUTABILITY TRIGGERS
CREATE OR REPLACE FUNCTION trg_protect_workflow_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('PUBLISHED', 'ARCHIVED') AND NEW.status = 'DRAFT' THEN
    RAISE EXCEPTION 'Immutable workflow version: Cannot revert a % version back to DRAFT', OLD.status
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Immutable workflow version: Cannot modify an ARCHIVED workflow version'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'PUBLISHED' AND NEW.status = 'PUBLISHED' THEN
    IF OLD.version_number != NEW.version_number OR OLD.workflow_id != NEW.workflow_id OR OLD.organization_id != NEW.organization_id THEN
      RAISE EXCEPTION 'Immutable workflow version: Cannot modify version number or parent workflow of a PUBLISHED version'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workflow_versions_protect_immutability
  BEFORE UPDATE ON "approval_workflow_versions"
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_workflow_version_immutability();

CREATE OR REPLACE FUNCTION trg_protect_published_stage_modifications()
RETURNS TRIGGER AS $$
DECLARE
  v_version_status "WorkflowVersionStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "status" INTO v_version_status
    FROM "approval_workflow_versions"
    WHERE "id" = OLD.version_id;
  ELSE
    SELECT "status" INTO v_version_status
    FROM "approval_workflow_versions"
    WHERE "id" = NEW.version_id;
  END IF;

  IF v_version_status IS NOT NULL AND v_version_status != 'DRAFT' THEN
    RAISE EXCEPTION 'Immutable workflow: Cannot % stages on a % workflow version', TG_OP, v_version_status
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workflow_stages_protect_published
  BEFORE INSERT OR UPDATE OR DELETE ON "approval_workflow_stages"
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_published_stage_modifications();

CREATE OR REPLACE FUNCTION trg_protect_published_approver_modifications()
RETURNS TRIGGER AS $$
DECLARE
  v_version_status "WorkflowVersionStatus";
  v_stage_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_stage_id := OLD.stage_id;
  ELSE
    v_stage_id := NEW.stage_id;
  END IF;

  SELECT v."status" INTO v_version_status
  FROM "approval_workflow_stages" s
  JOIN "approval_workflow_versions" v ON v."id" = s."version_id"
  WHERE s."id" = v_stage_id;

  IF v_version_status IS NOT NULL AND v_version_status != 'DRAFT' THEN
    RAISE EXCEPTION 'Immutable workflow: Cannot % approvers on a % workflow version', TG_OP, v_version_status
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stage_approvers_protect_published
  BEFORE INSERT OR UPDATE OR DELETE ON "approval_stage_approvers"
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_published_approver_modifications();
