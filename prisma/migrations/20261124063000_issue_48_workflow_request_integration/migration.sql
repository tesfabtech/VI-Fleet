-- AlterEnum
ALTER TYPE "TransportationRequestStatus" ADD VALUE 'CHANGES_REQUESTED';

-- AlterEnum
ALTER TYPE "StageInstanceStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX IF EXISTS "approval_workflow_instances_organization_id_entity_type_ent_idx";

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_instances_organization_id_entity_type_ent_key" ON "approval_workflow_instances"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_workflow_per_type" ON "approval_workflows"("organization_id", "workflow_type") WHERE status = 'ACTIVE' AND deleted_at IS NULL;
