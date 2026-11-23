-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('BUILT_IN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RoleScopeAllowed" AS ENUM ('ORGANIZATION_ONLY', 'DEPARTMENT_ONLY', 'ORGANIZATION_OR_DEPARTMENT');

-- CreateEnum
CREATE TYPE "RoleAssignmentStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100) NOT NULL,
    "is_platform_only" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "role_type" "RoleType" NOT NULL DEFAULT 'CUSTOM',
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "scope_allowed" "RoleScopeAllowed" NOT NULL DEFAULT 'ORGANIZATION_ONLY',
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "is_baseline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "department_id" UUID,
    "status" "RoleAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_by_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "organization_roles_organization_id_slug_idx" ON "organization_roles"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "organization_roles_organization_id_status_idx" ON "organization_roles"("organization_id", "status");

-- CreateIndex
CREATE INDEX "organization_roles_created_by_id_idx" ON "organization_roles"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_roles_organization_id_id_key" ON "organization_roles"("organization_id", "id");

-- CreateIndex
CREATE INDEX "role_permissions_organization_id_idx" ON "role_permissions"("organization_id");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_organization_id_user_id_idx" ON "user_role_assignments"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_organization_id_role_id_idx" ON "user_role_assignments"("organization_id", "role_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_organization_id_department_id_idx" ON "user_role_assignments"("organization_id", "department_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_status_idx" ON "user_role_assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_role_assignments_assigned_by_id_idx" ON "user_role_assignments"("assigned_by_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_revoked_by_id_idx" ON "user_role_assignments"("revoked_by_id");

-- AddForeignKey
ALTER TABLE "organization_roles" ADD CONSTRAINT "organization_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_roles" ADD CONSTRAINT "organization_roles_organization_id_created_by_id_fkey" FOREIGN KEY ("organization_id", "created_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "organization_roles"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_user_id_fkey" FOREIGN KEY ("organization_id", "user_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "organization_roles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_department_id_fkey" FOREIGN KEY ("organization_id", "department_id") REFERENCES "departments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_assigned_by_id_fkey" FOREIGN KEY ("organization_id", "assigned_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_revoked_by_id_fkey" FOREIGN KEY ("organization_id", "revoked_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 1. DEDICATED PROVISIONER ROLE AND TABLE PRIVILEGES
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vifleet_rbac_provisioner') THEN
    CREATE ROLE vifleet_rbac_provisioner WITH NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO vifleet_rbac_provisioner;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_roles, role_permissions, permissions, organizations, departments, users, user_role_assignments TO vifleet_rbac_provisioner;

-- ============================================================
-- 2. CHECK CONSTRAINTS & PARTIAL UNIQUE INDEXES
-- ============================================================

-- Bidirectional revocation check constraint
ALTER TABLE "user_role_assignments"
  ADD CONSTRAINT "user_role_assignments_revocation_check" CHECK (
    ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL AND "revocation_reason" IS NOT NULL)
    OR
    ("status" <> 'REVOKED' AND "revoked_at" IS NULL AND "revocation_reason" IS NULL)
  );

-- Built-in role system role check constraint
ALTER TABLE "organization_roles"
  ADD CONSTRAINT "organization_roles_built_in_check" CHECK (
    ("role_type" = 'BUILT_IN' AND "is_system_role" = TRUE)
    OR
    ("role_type" = 'CUSTOM' AND "is_system_role" = FALSE)
  );

-- Partial unique indexes for active assignments and roles
CREATE UNIQUE INDEX "user_role_assignments_org_scope_active_uniq"
  ON "user_role_assignments" ("organization_id", "user_id", "role_id")
  WHERE "status" = 'ACTIVE' AND "department_id" IS NULL;

CREATE UNIQUE INDEX "user_role_assignments_dept_scope_active_uniq"
  ON "user_role_assignments" ("organization_id", "user_id", "role_id", "department_id")
  WHERE "status" = 'ACTIVE' AND "department_id" IS NOT NULL;

CREATE UNIQUE INDEX "organization_roles_org_slug_active_uniq"
  ON "organization_roles" ("organization_id", lower("slug"))
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "organization_roles_org_name_active_uniq"
  ON "organization_roles" ("organization_id", lower("name"))
  WHERE "deleted_at" IS NULL;

-- ============================================================
-- 3. TRIGGER FUNCTIONS & TRIGGERS
-- ============================================================

-- Protect built-in organization roles from mutation, deactivation, or deletion
CREATE OR REPLACE FUNCTION trg_protect_built_in_organization_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role_type = 'BUILT_IN' AND CURRENT_USER <> 'vifleet_rbac_provisioner' THEN
      RAISE EXCEPTION 'Built-in roles can only be provisioned by trusted system provisioning';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role_type = 'BUILT_IN' THEN
      RAISE EXCEPTION 'Built-in roles cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role_type <> NEW.role_type THEN
      RAISE EXCEPTION 'Cannot convert between role types (BUILT_IN and CUSTOM)';
    END IF;

    IF OLD.role_type = 'BUILT_IN' AND CURRENT_USER <> 'vifleet_rbac_provisioner' THEN
      IF NEW.organization_id <> OLD.organization_id OR
         NEW.name <> OLD.name OR
         NEW.slug <> OLD.slug OR
         NEW.scope_allowed <> OLD.scope_allowed OR
         NEW.is_system_role <> OLD.is_system_role OR
         (NEW.created_by_id IS DISTINCT FROM OLD.created_by_id) OR
         NEW.status <> OLD.status OR
         (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
        RAISE EXCEPTION 'Built-in organization roles are immutable and cannot be modified, deactivated, or soft-deleted';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organization_roles_protect_built_in
  BEFORE INSERT OR UPDATE OR DELETE ON organization_roles
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_built_in_organization_roles();

-- Validate role permission modifications and prevent assigning platform permissions to org roles
CREATE OR REPLACE FUNCTION trg_validate_role_permission_modifications()
RETURNS TRIGGER AS $$
DECLARE
  v_role_type "RoleType";
  v_old_role_type "RoleType";
  v_is_platform_only BOOLEAN;
  v_role_org_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT role_type INTO v_role_type FROM organization_roles WHERE id = OLD.role_id;
    IF v_role_type = 'BUILT_IN' AND CURRENT_USER <> 'vifleet_rbac_provisioner' THEN
      RAISE EXCEPTION 'Permissions of built-in roles cannot be removed or modified';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT role_type INTO v_old_role_type FROM organization_roles WHERE id = OLD.role_id;
    SELECT role_type INTO v_role_type FROM organization_roles WHERE id = NEW.role_id;
    IF (v_old_role_type = 'BUILT_IN' OR v_role_type = 'BUILT_IN') AND CURRENT_USER <> 'vifleet_rbac_provisioner' THEN
      RAISE EXCEPTION 'Permissions of built-in roles cannot be modified';
    END IF;
  END IF;

  -- For INSERT or UPDATE:
  SELECT role_type, organization_id INTO v_role_type, v_role_org_id FROM organization_roles WHERE id = NEW.role_id;

  IF TG_OP = 'INSERT' AND v_role_type = 'BUILT_IN' AND CURRENT_USER <> 'vifleet_rbac_provisioner' THEN
    RAISE EXCEPTION 'Cannot add permissions to built-in roles outside trusted provisioning';
  END IF;

  -- Tenant check
  IF NEW.organization_id <> v_role_org_id THEN
    RAISE EXCEPTION 'RolePermission organization_id must match OrganizationRole organization_id';
  END IF;

  -- Platform permission check
  SELECT is_platform_only INTO v_is_platform_only FROM permissions WHERE id = NEW.permission_id;
  IF v_is_platform_only = TRUE THEN
    RAISE EXCEPTION 'Platform-only permissions cannot be assigned to organization roles';
  END IF;

  -- Baseline flag check
  IF v_role_type = 'BUILT_IN' THEN
    IF NEW.is_baseline <> TRUE THEN
      RAISE EXCEPTION 'Built-in role permission associations must have is_baseline = TRUE';
    END IF;
  ELSE
    IF NEW.is_baseline = TRUE THEN
      RAISE EXCEPTION 'Custom role permission associations cannot have is_baseline = TRUE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_role_permissions_validate
  BEFORE INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_role_permission_modifications();

-- Protect permission classification from invalid changes
CREATE OR REPLACE FUNCTION trg_protect_permission_classification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM role_permissions WHERE permission_id = OLD.id) THEN
      RAISE EXCEPTION 'Cannot delete permission that is assigned to organization roles';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_platform_only = TRUE AND OLD.is_platform_only = FALSE THEN
      IF EXISTS (SELECT 1 FROM role_permissions WHERE permission_id = NEW.id) THEN
        RAISE EXCEPTION 'Cannot reclassify permission as platform-only while assigned to organization roles';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permissions_protect_classification
  BEFORE UPDATE OR DELETE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_permission_classification();

-- Validate user role assignment scope, driver eligibility, and tenant isolation
CREATE OR REPLACE FUNCTION trg_validate_user_role_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_user_org_id UUID;
  v_user_status "UserStatus";
  v_user_deleted_at TIMESTAMPTZ;
  v_user_role "UserRole";
  v_user_dept_id UUID;

  v_role_org_id UUID;
  v_role_status "RoleStatus";
  v_role_deleted_at TIMESTAMPTZ;
  v_role_scope "RoleScopeAllowed";
  v_role_slug VARCHAR;

  v_dept_org_id UUID;
  v_dept_status "DepartmentStatus";
  v_dept_deleted_at TIMESTAMPTZ;
BEGIN
  -- 1. Validate User
  SELECT organization_id, status, deleted_at, role, department_id
    INTO v_user_org_id, v_user_status, v_user_deleted_at, v_user_role, v_user_dept_id
    FROM users WHERE id = NEW.user_id;

  IF v_user_org_id IS NULL OR v_user_org_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'User does not belong to the assignment organization';
  END IF;

  IF v_user_role = 'SYSTEM_ADMINISTRATOR' THEN
    RAISE EXCEPTION 'System Administrator users cannot be assigned organization roles';
  END IF;

  -- 2. Validate Role
  SELECT organization_id, status, deleted_at, scope_allowed, slug
    INTO v_role_org_id, v_role_status, v_role_deleted_at, v_role_scope, v_role_slug
    FROM organization_roles WHERE id = NEW.role_id;

  IF v_role_org_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Role does not belong to the assignment organization';
  END IF;

  -- 3. Scope validation
  IF v_role_scope = 'ORGANIZATION_ONLY' AND NEW.department_id IS NOT NULL THEN
    RAISE EXCEPTION 'Role % only permits organization-wide scope (department_id must be NULL)', v_role_slug;
  END IF;

  IF v_role_scope = 'DEPARTMENT_ONLY' AND NEW.department_id IS NULL THEN
    RAISE EXCEPTION 'Role % requires department scope (department_id cannot be NULL)', v_role_slug;
  END IF;

  IF v_role_slug = 'department-user' AND NEW.department_id IS NULL THEN
    RAISE EXCEPTION 'Department User role requires a specific department scope';
  END IF;

  -- 4. Validate Department if department_id is set
  IF NEW.department_id IS NOT NULL THEN
    SELECT organization_id, status, deleted_at
      INTO v_dept_org_id, v_dept_status, v_dept_deleted_at
      FROM departments WHERE id = NEW.department_id;

    IF v_dept_org_id IS NULL OR v_dept_org_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'Department does not belong to the assignment organization';
    END IF;
  END IF;

  -- 5. Terminal state protection: REVOKED assignments cannot be reactivated or modified in status
  IF TG_OP = 'UPDATE' AND OLD.status = 'REVOKED' AND NEW.status <> 'REVOKED' THEN
    RAISE EXCEPTION 'Cannot reactivate or modify the status of a permanently revoked role assignment';
  END IF;

  -- 6. PENDING_VERIFICATION Assignment Preconditions:
  IF NEW.status = 'PENDING_VERIFICATION' THEN
    IF v_user_deleted_at IS NOT NULL OR v_user_status = 'SUSPENDED' THEN
      RAISE EXCEPTION 'Cannot create or set pending role assignment for a suspended or deleted user';
    END IF;

    IF v_role_deleted_at IS NOT NULL OR v_role_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Cannot create or set pending role assignment for an inactive or deleted role';
    END IF;

    IF NEW.department_id IS NOT NULL THEN
      IF v_dept_deleted_at IS NOT NULL OR v_dept_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Cannot create or set pending role assignment for an inactive or deleted department';
      END IF;
    END IF;
  END IF;

  -- 7. ACTIVE Assignment Preconditions:
  -- Only enforce active entity checks when the assignment is or becomes ACTIVE.
  IF NEW.status = 'ACTIVE' THEN
    IF v_user_deleted_at IS NOT NULL OR v_user_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Cannot activate role assignment for an inactive or deleted user';
    END IF;

    IF v_role_deleted_at IS NOT NULL OR v_role_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Cannot activate role assignment for an inactive or deleted role';
    END IF;

    IF NEW.department_id IS NOT NULL THEN
      IF v_dept_deleted_at IS NOT NULL OR v_dept_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Cannot activate role assignment for an inactive or deleted department';
      END IF;
    END IF;

    -- Driver profile check: active driver role assignment requires active driver profile
    IF v_role_slug = 'driver' THEN
      IF NOT EXISTS (
        SELECT 1 FROM drivers
        WHERE user_id = NEW.user_id
          AND organization_id = NEW.organization_id
          AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Active Driver role assignment requires an active driver profile linked to the user';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_role_assignments_validate
  BEFORE INSERT OR UPDATE ON user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_user_role_assignment();

-- ============================================================
-- 4. TRUSTED PROVISIONING FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION provision_organization_built_in_roles(p_organization_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_missing_count INT;
  v_role_id UUID;
  rec_role RECORD;
  rec_perm RECORD;
BEGIN
  -- 1. Check organization exists
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization % not found', p_organization_id;
  END IF;

  -- 2. Verify all 28 required baseline permissions exist in catalog
  SELECT COUNT(*) INTO v_missing_count
  FROM (
    VALUES
      ('org:view'), ('org:update'), ('org:roles:manage'), ('org:roles:assign'),
      ('org:users:manage'), ('org:departments:manage'),
      ('vehicles:view'), ('vehicles:create'), ('vehicles:update'), ('vehicles:delete'),
      ('drivers:view'), ('drivers:create'), ('drivers:update'), ('drivers:delete'),
      ('requests:view'), ('requests:create'), ('requests:cancel'), ('requests:approve'), ('requests:reject'),
      ('trips:view'), ('trips:dispatch'), ('trips:cancel'), ('trips:execute'),
      ('maintenance:view'), ('maintenance:create'), ('maintenance:update'), ('maintenance:delete'),
      ('fuel:manage')
  ) AS req(code)
  WHERE NOT EXISTS (
    SELECT 1 FROM permissions perm WHERE perm.code = req.code AND perm.is_platform_only = FALSE
  );

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION 'Cannot provision built-in roles: % required baseline permissions are missing from the catalog', v_missing_count;
  END IF;

  -- 3. Define and provision the 6 built-in roles
  FOR rec_role IN
    SELECT * FROM (VALUES
      ('Organization Administrator', 'org-admin', 'Full administrative access to organization resources, settings, and role management.', 'ORGANIZATION_ONLY'::"RoleScopeAllowed"),
      ('Vice Organization Administrator', 'vice-org-admin', 'Administrative support with operational delegation, excluding role and permission management.', 'ORGANIZATION_ONLY'::"RoleScopeAllowed"),
      ('Transport Manager', 'transport-manager', 'Full management of fleet operations, vehicles, drivers, requests, trips, and maintenance.', 'ORGANIZATION_ONLY'::"RoleScopeAllowed"),
      ('Vice Transport Manager', 'vice-transport-manager', 'Operational fleet management assisting the Transport Manager with matching baseline operational access.', 'ORGANIZATION_ONLY'::"RoleScopeAllowed"),
      ('Department User', 'department-user', 'Department-scoped member who submits and tracks transportation requests.', 'DEPARTMENT_ONLY'::"RoleScopeAllowed"),
      ('Driver', 'driver', 'Assigned vehicle operator who views trips, records trip progress, and reports incidents.', 'ORGANIZATION_ONLY'::"RoleScopeAllowed")
    ) AS t(name, slug, description, scope_allowed)
  LOOP
    -- Insert or get existing built-in role
    INSERT INTO organization_roles (
      id, organization_id, name, slug, description, role_type, status, scope_allowed, is_system_role, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), p_organization_id, rec_role.name, rec_role.slug, rec_role.description, 'BUILT_IN', 'ACTIVE', rec_role.scope_allowed, TRUE, NOW(), NOW()
    )
    ON CONFLICT (organization_id, lower(slug)) WHERE deleted_at IS NULL
    DO UPDATE SET
      description = EXCLUDED.description,
      updated_at = NOW()
    RETURNING id INTO v_role_id;

    IF v_role_id IS NULL THEN
      SELECT id INTO v_role_id FROM organization_roles
      WHERE organization_id = p_organization_id AND lower(slug) = lower(rec_role.slug) AND deleted_at IS NULL;
    END IF;

    -- Assign baseline permissions based on role slug
    FOR rec_perm IN
      SELECT perm.id
      FROM permissions perm
      WHERE (
        -- org-admin: all 28 org permissions
        (rec_role.slug = 'org-admin' AND perm.is_platform_only = FALSE)
        OR
        -- vice-org-admin: all org permissions except org:roles:manage
        (rec_role.slug = 'vice-org-admin' AND perm.is_platform_only = FALSE AND perm.code <> 'org:roles:manage')
        OR
        -- transport-manager: 17 operational permissions
        (rec_role.slug = 'transport-manager' AND perm.code IN (
          'org:view',
          'vehicles:view', 'vehicles:create', 'vehicles:update', 'vehicles:delete',
          'drivers:view', 'drivers:create', 'drivers:update', 'drivers:delete',
          'requests:view', 'requests:approve', 'requests:reject',
          'trips:view', 'trips:dispatch', 'trips:cancel', 'trips:execute',
          'maintenance:view', 'maintenance:create', 'maintenance:update', 'maintenance:delete',
          'fuel:manage'
        ))
        OR
        -- vice-transport-manager: same 17 operational permissions
        (rec_role.slug = 'vice-transport-manager' AND perm.code IN (
          'org:view',
          'vehicles:view', 'vehicles:create', 'vehicles:update', 'vehicles:delete',
          'drivers:view', 'drivers:create', 'drivers:update', 'drivers:delete',
          'requests:view', 'requests:approve', 'requests:reject',
          'trips:view', 'trips:dispatch', 'trips:cancel', 'trips:execute',
          'maintenance:view', 'maintenance:create', 'maintenance:update', 'maintenance:delete',
          'fuel:manage'
        ))
        OR
        -- department-user: 3 request permissions
        (rec_role.slug = 'department-user' AND perm.code IN (
          'requests:view', 'requests:create', 'requests:cancel'
        ))
        OR
        -- driver: 2 trip execution permissions
        (rec_role.slug = 'driver' AND perm.code IN (
          'trips:view', 'trips:execute'
        ))
      )
    LOOP
      INSERT INTO role_permissions (id, organization_id, role_id, permission_id, is_baseline, created_at)
      VALUES (gen_random_uuid(), p_organization_id, v_role_id, rec_perm.id, TRUE, NOW())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;

  END LOOP;
END;
$$;

ALTER FUNCTION provision_organization_built_in_roles(UUID) OWNER TO vifleet_rbac_provisioner;
REVOKE ALL ON FUNCTION provision_organization_built_in_roles(UUID) FROM PUBLIC;

DO $$
BEGIN
  EXECUTE format('GRANT EXECUTE ON FUNCTION provision_organization_built_in_roles(UUID) TO %I', CURRENT_USER);
END $$;

-- ============================================================
-- 5. PERMISSION CATALOG SEED (30 PERMISSIONS)
-- ============================================================

INSERT INTO permissions (id, code, name, description, category, is_platform_only, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'org:view', 'View Organization', 'View organization profile, contact information, and overview details.', 'Organization Profile & Settings', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'org:update', 'Update Organization', 'Update organization details, settings, and contact information.', 'Organization Profile & Settings', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'org:roles:manage', 'Manage Organization Roles', 'Create, update, and manage custom organization roles and their permissions.', 'Role & Access Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'org:roles:assign', 'Assign Organization Roles', 'Assign and revoke organization roles to members.', 'Role & Access Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'org:users:manage', 'Manage Organization Users', 'Invite, update, and manage organization user accounts and status.', 'User & Membership Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'org:departments:manage', 'Manage Departments', 'Create, update, and manage departments within the organization.', 'Department Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'vehicles:view', 'View Vehicles', 'View vehicles, specifications, availability, and vehicle details.', 'Vehicle & Fleet Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'vehicles:create', 'Create Vehicles', 'Add and register new vehicles to the fleet.', 'Vehicle & Fleet Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'vehicles:update', 'Update Vehicles', 'Update vehicle specifications, status, and metadata.', 'Vehicle & Fleet Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'vehicles:delete', 'Delete Vehicles', 'Archive or delete vehicles from the fleet.', 'Vehicle & Fleet Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'drivers:view', 'View Drivers', 'View driver profiles, license information, and status.', 'Driver Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'drivers:create', 'Create Drivers', 'Register new drivers and assign driver profiles.', 'Driver Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'drivers:update', 'Update Drivers', 'Update driver details, license information, and preferences.', 'Driver Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'drivers:delete', 'Delete Drivers', 'Archive or delete driver profiles.', 'Driver Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'requests:view', 'View Transportation Requests', 'View submitted and department transportation requests.', 'Transportation Requests', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'requests:create', 'Create Transportation Requests', 'Submit new transportation requests.', 'Transportation Requests', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'requests:cancel', 'Cancel Transportation Requests', 'Cancel own or department transportation requests.', 'Transportation Requests', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'requests:approve', 'Approve Transportation Requests', 'Approve pending transportation requests.', 'Transportation Requests', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'requests:reject', 'Reject Transportation Requests', 'Reject pending transportation requests.', 'Transportation Requests', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'trips:view', 'View Trips', 'View scheduled, active, and completed trips and dispatch board.', 'Trip & Dispatch Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'trips:dispatch', 'Dispatch Trips', 'Create trip dispatches, assign vehicles, drivers, and schedules.', 'Trip & Dispatch Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'trips:cancel', 'Cancel Trips', 'Cancel scheduled or active trips.', 'Trip & Dispatch Management', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'trips:execute', 'Execute Trips', 'Start trips, report interruptions, upload evidence, and complete trips.', 'Trip Execution & Driving', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'maintenance:view', 'View Maintenance Records', 'View vehicle maintenance history, schedules, and alerts.', 'Maintenance & Service', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'maintenance:create', 'Create Maintenance Records', 'Log new maintenance services and create maintenance schedules.', 'Maintenance & Service', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'maintenance:update', 'Update Maintenance Records', 'Update maintenance entries and service schedule statuses.', 'Maintenance & Service', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'maintenance:delete', 'Delete Maintenance Records', 'Delete or archive maintenance records and schedules.', 'Maintenance & Service', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'fuel:manage', 'Manage Fuel Records', 'Log and view vehicle fuel entries, receipts, and efficiency records.', 'Fuel & Expenses', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'platform:organizations:manage', 'Manage Platform Organizations', 'Review, approve, reject, and manage platform tenant organizations.', 'Platform Administration', TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'platform:users:manage', 'Manage Platform Users', 'Manage platform-level system administrators and global configurations.', 'Platform Administration', TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

-- ============================================================
-- 6. PROVISION EXISTING ORGANIZATIONS
-- ============================================================

DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    PERFORM provision_organization_built_in_roles(org.id);
  END LOOP;
END $$;

-- ============================================================
-- 7. SAFE IDEMPOTENT BACKFILL OF EXISTING USER ROLES
-- ============================================================

INSERT INTO user_role_assignments (
  id,
  organization_id,
  user_id,
  role_id,
  department_id,
  status,
  assigned_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.organization_id,
  u.id,
  r.id,
  CASE WHEN u.role = 'DEPARTMENT_USER' THEN u.department_id ELSE NULL END,
  CASE
    WHEN u.status = 'ACTIVE' AND (
      u.role <> 'DRIVER' OR EXISTS (
        SELECT 1 FROM drivers d
        WHERE d.user_id = u.id AND d.organization_id = u.organization_id AND d.deleted_at IS NULL
      )
    ) THEN 'ACTIVE'::"RoleAssignmentStatus"
    WHEN u.status = 'INACTIVE' AND (
      EXISTS (
        SELECT 1 FROM organization_invitations oi
        WHERE oi.user_id = u.id AND oi.consumed_at IS NULL AND oi.revoked_at IS NULL AND oi.expires_at > NOW()
      )
      OR EXISTS (
        SELECT 1 FROM email_verification_tokens evt
        WHERE evt.user_id = u.id AND evt.expires_at > NOW()
      )
    ) THEN 'PENDING_VERIFICATION'::"RoleAssignmentStatus"
    ELSE 'INACTIVE'::"RoleAssignmentStatus"
  END,
  NOW(),
  NOW(),
  NOW()
FROM users u
JOIN organization_roles r ON r.organization_id = u.organization_id
  AND r.slug = CASE u.role
    WHEN 'ORGANIZATION_ADMINISTRATOR' THEN 'org-admin'
    WHEN 'VICE_ORGANIZATION_ADMINISTRATOR' THEN 'vice-org-admin'
    WHEN 'TRANSPORT_MANAGER' THEN 'transport-manager'
    WHEN 'VICE_TRANSPORT_MANAGER' THEN 'vice-transport-manager'
    WHEN 'DEPARTMENT_USER' THEN 'department-user'
    WHEN 'DRIVER' THEN 'driver'
  END
  AND r.deleted_at IS NULL
WHERE u.organization_id IS NOT NULL
  AND u.role <> 'SYSTEM_ADMINISTRATOR'
  AND (u.role <> 'DEPARTMENT_USER' OR u.department_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM user_role_assignments ura
    WHERE ura.organization_id = u.organization_id
      AND ura.user_id = u.id
      AND ura.role_id = r.id
      AND (
        (CASE WHEN u.role = 'DEPARTMENT_USER' THEN u.department_id ELSE NULL END IS NULL AND ura.department_id IS NULL)
        OR
        (CASE WHEN u.role = 'DEPARTMENT_USER' THEN u.department_id ELSE NULL END = ura.department_id)
      )
  );
