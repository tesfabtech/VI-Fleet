-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DepartmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMINISTRATOR', 'ORGANIZATION_ADMINISTRATOR', 'VICE_ORGANIZATION_ADMINISTRATOR', 'TRANSPORT_MANAGER', 'VICE_TRANSPORT_MANAGER', 'DEPARTMENT_USER', 'DRIVER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "VehicleAvailability" AS ENUM ('AVAILABLE', 'ASSIGNED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TransportationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GPSDeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "GeofenceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "GeofenceEventType" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" "DepartmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "department_id" UUID,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT,
    "phone" VARCHAR(30),
    "profile_picture_url" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "registration_number" VARCHAR(50) NOT NULL,
    "vin" VARCHAR(17),
    "make" VARCHAR(100),
    "model" VARCHAR(100),
    "year" INTEGER,
    "color" VARCHAR(50),
    "vehicle_type" VARCHAR(100),
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "availability" "VehicleAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "fuel_type" VARCHAR(50),
    "seating_capacity" INTEGER,
    "current_odometer" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "license_number" VARCHAR(100) NOT NULL,
    "license_expiry_date" DATE,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transportation_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "purpose" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "origin" VARCHAR(255) NOT NULL,
    "destination" VARCHAR(255) NOT NULL,
    "passenger_count" INTEGER NOT NULL,
    "requested_start" TIMESTAMPTZ(6) NOT NULL,
    "requested_end" TIMESTAMPTZ(6) NOT NULL,
    "special_requirements" TEXT,
    "notes" TEXT,
    "status" "TransportationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transportation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transportation_request_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "scheduled_start" TIMESTAMPTZ(6) NOT NULL,
    "scheduled_end" TIMESTAMPTZ(6) NOT NULL,
    "actual_start" TIMESTAMPTZ(6),
    "actual_end" TIMESTAMPTZ(6),
    "status" "TripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "start_odometer" DECIMAL(12,2),
    "end_odometer" DECIMAL(12,2),
    "distance_km" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_devices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "device_identifier" VARCHAR(150) NOT NULL,
    "device_model" VARCHAR(100),
    "status" "GPSDeviceStatus" NOT NULL DEFAULT 'INACTIVE',
    "installed_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "gps_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_locations" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "gps_device_id" UUID,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "altitude" DECIMAL(10,2),
    "accuracy" DECIMAL(10,2),
    "speed" DECIMAL(10,2),
    "heading" DECIMAL(6,2),
    "odometer" DECIMAL(12,2),
    "ignition_status" BOOLEAN,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "geometry" JSONB NOT NULL,
    "status" "GeofenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofence_events" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "geofence_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "gps_location_id" BIGINT,
    "event_type" "GeofenceEventType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geofence_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "maintenance_type" "MaintenanceType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "maintenance_date" DATE NOT NULL,
    "odometer" DECIMAL(12,2),
    "cost" DECIMAL(12,2),
    "service_provider" VARCHAR(200),
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "maintenance_type" "MaintenanceType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "interval_km" DECIMAL(12,2),
    "interval_days" INTEGER,
    "last_service_date" DATE,
    "last_service_odometer" DECIMAL(12,2),
    "next_service_date" DATE,
    "next_service_odometer" DECIMAL(12,2),
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "fuel_date" TIMESTAMPTZ(6) NOT NULL,
    "fuel_type" VARCHAR(50),
    "quantity_liters" DECIMAL(12,3) NOT NULL,
    "price_per_liter" DECIMAL(12,3),
    "total_cost" DECIMAL(12,2),
    "odometer" DECIMAL(12,2),
    "station_name" VARCHAR(200),
    "receipt_number" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fuel_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "driver_id" UUID,
    "trip_id" UUID,
    "geofence_id" UUID,
    "alert_type" VARCHAR(100) NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_id_key" ON "departments"("organization_id", "id");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_organization_id_role_idx" ON "users"("organization_id", "role");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_id_key" ON "users"("organization_id", "id");

-- CreateIndex
CREATE INDEX "vehicles_organization_id_idx" ON "vehicles"("organization_id");

-- CreateIndex
CREATE INDEX "vehicles_organization_id_status_idx" ON "vehicles"("organization_id", "status");

-- CreateIndex
CREATE INDEX "vehicles_organization_id_availability_idx" ON "vehicles"("organization_id", "availability");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_organization_id_id_key" ON "vehicles"("organization_id", "id");

-- CreateIndex
CREATE INDEX "drivers_organization_id_idx" ON "drivers"("organization_id");

-- CreateIndex
CREATE INDEX "drivers_organization_id_status_idx" ON "drivers"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_organization_id_id_key" ON "drivers"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_organization_id_user_id_key" ON "drivers"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "transportation_requests_organization_id_status_idx" ON "transportation_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "transportation_requests_organization_id_requested_start_idx" ON "transportation_requests"("organization_id", "requested_start");

-- CreateIndex
CREATE INDEX "transportation_requests_department_id_idx" ON "transportation_requests"("department_id");

-- CreateIndex
CREATE INDEX "transportation_requests_requested_by_id_idx" ON "transportation_requests"("requested_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "transportation_requests_organization_id_id_key" ON "transportation_requests"("organization_id", "id");

-- CreateIndex
CREATE INDEX "trips_organization_id_vehicle_id_scheduled_start_idx" ON "trips"("organization_id", "vehicle_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "trips_organization_id_driver_id_scheduled_start_idx" ON "trips"("organization_id", "driver_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "trips_organization_id_status_scheduled_start_idx" ON "trips"("organization_id", "status", "scheduled_start");

-- CreateIndex
CREATE UNIQUE INDEX "trips_organization_id_id_key" ON "trips"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "trips_organization_id_transportation_request_id_key" ON "trips"("organization_id", "transportation_request_id");

-- CreateIndex
CREATE INDEX "gps_devices_organization_id_idx" ON "gps_devices"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "gps_devices_organization_id_id_key" ON "gps_devices"("organization_id", "id");

-- CreateIndex
CREATE INDEX "gps_locations_organization_id_vehicle_id_recorded_at_idx" ON "gps_locations"("organization_id", "vehicle_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "gps_locations_organization_id_gps_device_id_recorded_at_idx" ON "gps_locations"("organization_id", "gps_device_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "gps_locations_organization_id_recorded_at_idx" ON "gps_locations"("organization_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "geofences_organization_id_status_idx" ON "geofences"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "geofences_organization_id_id_key" ON "geofences"("organization_id", "id");

-- CreateIndex
CREATE INDEX "geofence_events_organization_id_vehicle_id_occurred_at_idx" ON "geofence_events"("organization_id", "vehicle_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "geofence_events_organization_id_geofence_id_occurred_at_idx" ON "geofence_events"("organization_id", "geofence_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "geofence_events_organization_id_occurred_at_idx" ON "geofence_events"("organization_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "maintenance_records_organization_id_vehicle_id_maintenance__idx" ON "maintenance_records"("organization_id", "vehicle_id", "maintenance_date" DESC);

-- CreateIndex
CREATE INDEX "maintenance_records_organization_id_vehicle_id_idx" ON "maintenance_records"("organization_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "maintenance_schedules_organization_id_vehicle_id_idx" ON "maintenance_schedules"("organization_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "maintenance_schedules_organization_id_next_service_date_idx" ON "maintenance_schedules"("organization_id", "next_service_date");

-- CreateIndex
CREATE INDEX "maintenance_schedules_organization_id_next_service_odometer_idx" ON "maintenance_schedules"("organization_id", "next_service_odometer");

-- CreateIndex
CREATE INDEX "fuel_records_organization_id_vehicle_id_fuel_date_idx" ON "fuel_records"("organization_id", "vehicle_id", "fuel_date" DESC);

-- CreateIndex
CREATE INDEX "fuel_records_organization_id_vehicle_id_idx" ON "fuel_records"("organization_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "alerts_organization_id_status_idx" ON "alerts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "alerts_organization_id_severity_idx" ON "alerts"("organization_id", "severity");

-- CreateIndex
CREATE INDEX "alerts_organization_id_occurred_at_idx" ON "alerts"("organization_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "alerts_organization_id_vehicle_id_occurred_at_idx" ON "alerts"("organization_id", "vehicle_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_department_id_fkey" FOREIGN KEY ("organization_id", "department_id") REFERENCES "departments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organization_id_user_id_fkey" FOREIGN KEY ("organization_id", "user_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_requests" ADD CONSTRAINT "transportation_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_requests" ADD CONSTRAINT "transportation_requests_organization_id_department_id_fkey" FOREIGN KEY ("organization_id", "department_id") REFERENCES "departments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_requests" ADD CONSTRAINT "transportation_requests_organization_id_requested_by_id_fkey" FOREIGN KEY ("organization_id", "requested_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_requests" ADD CONSTRAINT "transportation_requests_organization_id_reviewed_by_id_fkey" FOREIGN KEY ("organization_id", "reviewed_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_transportation_request_id_fkey" FOREIGN KEY ("organization_id", "transportation_request_id") REFERENCES "transportation_requests"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_vehicle_id_fkey" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_driver_id_fkey" FOREIGN KEY ("organization_id", "driver_id") REFERENCES "drivers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_devices" ADD CONSTRAINT "gps_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_devices" ADD CONSTRAINT "gps_devices_organization_id_vehicle_id_fkey" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_organization_id_vehicle_id_fkey" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_organization_id_gps_device_id_fkey" FOREIGN KEY ("organization_id", "gps_device_id") REFERENCES "gps_devices"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_organization_id_created_by_id_fkey" FOREIGN KEY ("organization_id", "created_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_organization_id_geofence_id_fkey" FOREIGN KEY ("organization_id", "geofence_id") REFERENCES "geofences"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_organization_id_vehicle_id_fkey" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_gps_location_id_fkey" FOREIGN KEY ("gps_location_id") REFERENCES "gps_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_organization_id_vehicle_id_fkey" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_organization_id_vehicle_id_fkey" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_organization_id_vehicle_id_fkey" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_vehicle_id_fkey" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_driver_id_fkey" FOREIGN KEY ("organization_id", "driver_id") REFERENCES "drivers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_trip_id_fkey" FOREIGN KEY ("organization_id", "trip_id") REFERENCES "trips"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_geofence_id_fkey" FOREIGN KEY ("organization_id", "geofence_id") REFERENCES "geofences"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
