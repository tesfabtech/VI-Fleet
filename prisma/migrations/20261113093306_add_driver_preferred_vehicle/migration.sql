-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "preferred_vehicle_id" UUID;

-- CreateIndex
CREATE INDEX "drivers_organization_id_preferred_vehicle_id_idx" ON "drivers"("organization_id", "preferred_vehicle_id");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organization_id_preferred_vehicle_id_fkey" FOREIGN KEY ("organization_id", "preferred_vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
