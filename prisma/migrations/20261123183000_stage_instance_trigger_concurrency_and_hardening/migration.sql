-- 1. Replace trg_validate_stage_instance_version with FOR SHARE row lock on parent instance
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
  -- Look up parent workflow instance with organization check and row lock
  SELECT workflow_version_id, organization_id
    INTO v_instance_version_id, v_instance_org_id
  FROM approval_workflow_instances
  WHERE id = NEW.instance_id AND organization_id = NEW.organization_id
  FOR SHARE;

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

-- 2. Replace trg_protect_workflow_instance_pinned_version with IS DISTINCT FROM comparison
CREATE OR REPLACE FUNCTION trg_protect_workflow_instance_pinned_version()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
LANGUAGE plpgsql AS $$
DECLARE
  v_has_stage_instances BOOLEAN;
BEGIN
  IF OLD.workflow_version_id IS DISTINCT FROM NEW.workflow_version_id THEN
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

-- 3. Explicitly revoke EXECUTE from PUBLIC for least-privilege hardening
REVOKE EXECUTE ON FUNCTION trg_validate_stage_instance_version() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION trg_protect_workflow_instance_pinned_version() FROM PUBLIC;
