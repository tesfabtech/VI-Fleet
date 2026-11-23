-- 1. Create unique index on approval_workflow_versions(workflow_id, id)
CREATE UNIQUE INDEX "approval_workflow_versions_workflow_id_id_key" ON "approval_workflow_versions"("workflow_id", "id");

-- 2. Add composite foreign key from approval_workflows(id, current_version_id) to approval_workflow_versions(workflow_id, id)
ALTER TABLE "approval_workflows"
  ADD CONSTRAINT "approval_workflows_id_current_version_id_fkey"
  FOREIGN KEY ("id", "current_version_id")
  REFERENCES "approval_workflow_versions"("workflow_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Add composite foreign key from approval_workflow_instances(workflow_id, workflow_version_id) to approval_workflow_versions(workflow_id, id)
ALTER TABLE "approval_workflow_instances"
  ADD CONSTRAINT "approval_workflow_instances_workflow_id_workflow_version_i_fkey"
  FOREIGN KEY ("workflow_id", "workflow_version_id")
  REFERENCES "approval_workflow_versions"("workflow_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Trigger to enforce stage instance version integrity on INSERT or UPDATE
CREATE OR REPLACE FUNCTION trg_validate_stage_instance_version()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
LANGUAGE plpgsql AS $$
DECLARE
  v_instance_version_id UUID;
  v_instance_org_id UUID;
  v_stage_version_id UUID;
  v_stage_org_id UUID;
BEGIN
  -- Look up parent workflow instance with organization check
  SELECT workflow_version_id, organization_id
    INTO v_instance_version_id, v_instance_org_id
  FROM approval_workflow_instances
  WHERE id = NEW.instance_id AND organization_id = NEW.organization_id;

  IF v_instance_version_id IS NULL THEN
    RAISE EXCEPTION 'Parent workflow instance % does not exist in organization %',
      NEW.instance_id, NEW.organization_id
      USING ERRCODE = '23503';
  END IF;

  -- Look up referenced workflow stage with organization check
  SELECT version_id, organization_id
    INTO v_stage_version_id, v_stage_org_id
  FROM approval_workflow_stages
  WHERE id = NEW.stage_id AND organization_id = NEW.organization_id;

  IF v_stage_version_id IS NULL THEN
    RAISE EXCEPTION 'Referenced stage % does not exist in organization %',
      NEW.stage_id, NEW.organization_id
      USING ERRCODE = '23503';
  END IF;

  -- Verify stage version matches the parent instance pinned workflow version
  IF v_instance_version_id != v_stage_version_id THEN
    RAISE EXCEPTION 'Stage version mismatch: stage % belongs to version %, but parent instance % is pinned to version %',
      NEW.stage_id, v_stage_version_id, NEW.instance_id, v_instance_version_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_stage_instances_validate_version ON "approval_stage_instances";
CREATE TRIGGER trg_approval_stage_instances_validate_version
  BEFORE INSERT OR UPDATE ON "approval_stage_instances"
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_stage_instance_version();

-- 5. Trigger to prevent changing an instance's pinned workflow version after stage instances exist
CREATE OR REPLACE FUNCTION trg_protect_workflow_instance_pinned_version()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
LANGUAGE plpgsql AS $$
DECLARE
  v_has_stage_instances BOOLEAN;
BEGIN
  IF OLD.workflow_version_id != NEW.workflow_version_id THEN
    SELECT EXISTS (
      SELECT 1 FROM approval_stage_instances
      WHERE instance_id = OLD.id AND organization_id = OLD.organization_id
    ) INTO v_has_stage_instances;

    IF v_has_stage_instances THEN
      RAISE EXCEPTION 'Cannot modify pinned workflow version of workflow instance % after stage instances have been created',
        OLD.id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_instances_protect_pinned_version ON "approval_workflow_instances";
CREATE TRIGGER trg_workflow_instances_protect_pinned_version
  BEFORE UPDATE ON "approval_workflow_instances"
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_workflow_instance_pinned_version();
