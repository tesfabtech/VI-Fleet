-- AlterTable
ALTER TABLE "department_registration_links" ADD COLUMN     "token_encrypted" TEXT;
-- Keep the most recently created unrevoked link per organization.
-- Older unrevoked links must be revoked to enforce one link per org.
WITH ranked_links AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM department_registration_links
  WHERE revoked_at IS NULL
)
UPDATE department_registration_links AS link
SET revoked_at = CURRENT_TIMESTAMP
FROM ranked_links
WHERE link.id = ranked_links.id
  AND ranked_links.row_number > 1;

-- Enforce one unrevoked link per organization, even during
-- concurrent creation requests.
CREATE UNIQUE INDEX
  "department_registration_links_one_unrevoked_per_org"
ON department_registration_links (organization_id)
WHERE revoked_at IS NULL;