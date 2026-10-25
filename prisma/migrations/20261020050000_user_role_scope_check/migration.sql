ALTER TABLE "users"
ADD CONSTRAINT "users_role_scope_check"
CHECK (
  (
    "role" = 'SYSTEM_ADMINISTRATOR'
    AND "organization_id" IS NULL
    AND "department_id" IS NULL
  )
  OR
  (
    "role" = 'DEPARTMENT_USER'
    AND "organization_id" IS NOT NULL
    AND "department_id" IS NOT NULL
  )
  OR
  (
    "role" NOT IN ('SYSTEM_ADMINISTRATOR', 'DEPARTMENT_USER')
    AND "organization_id" IS NOT NULL
    AND "department_id" IS NULL
  )
);