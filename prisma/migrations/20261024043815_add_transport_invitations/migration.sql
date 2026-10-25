-- CreateTable
CREATE TABLE "transport_invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transport_invitations_token_hash_key" ON "transport_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "transport_invitations_organization_id_created_at_idx" ON "transport_invitations"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "transport_invitations_user_id_created_at_idx" ON "transport_invitations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transport_invitations_created_by_id_idx" ON "transport_invitations"("created_by_id");

-- AddForeignKey
ALTER TABLE "transport_invitations" ADD CONSTRAINT "transport_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_invitations" ADD CONSTRAINT "transport_invitations_organization_id_user_id_fkey" FOREIGN KEY ("organization_id", "user_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_invitations" ADD CONSTRAINT "transport_invitations_organization_id_created_by_id_fkey" FOREIGN KEY ("organization_id", "created_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
