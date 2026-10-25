/*
  Warnings:

  - You are about to drop the `transport_invitations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "transport_invitations" DROP CONSTRAINT "transport_invitations_organization_id_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "transport_invitations" DROP CONSTRAINT "transport_invitations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "transport_invitations" DROP CONSTRAINT "transport_invitations_organization_id_user_id_fkey";

-- DropTable
DROP TABLE "transport_invitations";
