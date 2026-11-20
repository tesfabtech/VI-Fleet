-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('PRIVATE_COMPANY', 'GOVERNMENT', 'NGO', 'OTHER');

-- AlterTable
ALTER TABLE "organization_applications" ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "country" VARCHAR(100),
ADD COLUMN     "departmentCount" INTEGER,
ADD COLUMN     "estimatedFleetSize" VARCHAR(50),
ADD COLUMN     "officialDocumentFileName" VARCHAR(255),
ADD COLUMN     "officialDocumentKey" VARCHAR(500),
ADD COLUMN     "officialDocumentMimeType" VARCHAR(100),
ADD COLUMN     "officialDocumentSize" INTEGER,
ADD COLUMN     "organizationType" "OrganizationType",
ADD COLUMN     "region" VARCHAR(100),
ADD COLUMN     "streetAddress" VARCHAR(255),
ADD COLUMN     "website" VARCHAR(255);

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "country" VARCHAR(100),
ADD COLUMN     "departmentCount" INTEGER,
ADD COLUMN     "estimatedFleetSize" VARCHAR(50),
ADD COLUMN     "organizationType" "OrganizationType",
ADD COLUMN     "region" VARCHAR(100),
ADD COLUMN     "streetAddress" VARCHAR(255),
ADD COLUMN     "website" VARCHAR(255);
