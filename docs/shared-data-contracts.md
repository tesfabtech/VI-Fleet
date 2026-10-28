
# VI-Fleet Shared Data Contracts

## 1. Purpose

This document defines the shared data structures, authorization rules, validation standards, and API conventions used by the VI-Fleet development team.

The goal is to allow team members to develop different features in parallel without creating incompatible database queries, server actions, API responses, or validation rules.

## 2. Sources of Truth

VI-Fleet uses multiple sources of truth for different parts of the application. No single file or tool defines the complete application behavior.

### Database schema

- `prisma/schema.prisma` defines database models, fields, types, relationships, enums, and declared database constraints.
- Reuse existing models and enums before proposing new ones.
- Database constraints do not replace application-level validation or authorization.
- Schema changes must be discussed with the team and include the appropriate Prisma migration.

### Authentication and authorization

- Existing Auth.js configuration and session types define the authentication and session implementation.
- Agreed access-control rules define what each role may do.
- Protected operations must enforce authorization on the server.

### API and shared interfaces

- Existing API routes, server actions, shared types, and agreed contracts define how application features communicate.
- Changes to shared interfaces must be coordinated with affected team members.

### Business rules and workflows

- Approved project requirements define the expected business behavior.
- Application services, server actions, and other relevant server-side code implement those rules.
- Database constraints alone do not define the complete business logic.

### Validation

- Shared validation schemas and server-side validation rules define acceptable application inputs.
- Validation must be consistent with the database schema and business requirements.

### UI and shared components

- Existing shared components and agreed design conventions define reusable UI behavior and presentation.

### Email and onboarding

- Existing email services and onboarding workflows define invitation, verification, and account setup behavior.

### Configuration

- Environment variables and application configuration define environment-specific settings.
- Never commit secrets or expose them to client-side code.

### Keeping sources consistent

- Before changing a shared contract, identify every affected source.
- Coordinate changes that affect multiple features.
- Update relevant documentation and tests when behavior changes.
- If sources conflict, do not silently choose one. Discuss the conflict with the team and agree on the intended behavior before merging.

## 3. Existing Domain Models

The following models already exist in the Prisma schema.

| Area | Existing models |
|---|---|
| Organizations | `Organization`, `OrganizationApplication`, `OrganizationInvitation` |
| Departments | `Department`, `DepartmentRegistrationLink`, `DepartmentUserApplication` |
| Users and authentication | `User`, `EmailVerificationToken`, `PasswordResetToken` |
| Vehicles and drivers | `Vehicle`, `Driver` |
| Transportation | `TransportationRequest`, `Trip` |
| GPS and tracking | `GPSDevice`, `GPSLocation` |
| Geofencing | `Geofence`, `GeofenceEvent` |
| Maintenance | `MaintenanceRecord`, `MaintenanceSchedule` |
| Fuel | `FuelRecord` |
| Notifications | `Alert` |

Before adding a model, check whether an existing model can support the requirement.

## 4. Organization Data Isolation

VI-Fleet supports multiple organizations. Data belonging to one organization must not be accessible to another organization.

### Required rules

1. Obtain the authenticated user's organization ID from the server-side session.
2. Never rely only on an `organizationId` submitted by the browser to authorize access.
3. Scope organization-owned database queries and mutations to the authenticated organization.
4. Verify that related records belong to the same organization before connecting or updating them.
5. Check the user's role and permissions before performing protected operations.
6. Do not expose sensitive information from another organization in API responses, error messages, or logs.

Example:

```ts
const session = await auth();

if (!session?.user?.organizationId) {
  throw new Error("Unauthorized");
}

const vehicles = await prisma.vehicle.findMany({
  where: {
    organizationId: session.user.organizationId,
  },
});
```

Adapt the example to the actual authentication helper and Prisma client used by the feature.

**Important:** The example illustrates organization scoping; it does not replace role checks or other authorization requirements.

## 5. Roles and Permissions

Use the existing `UserRole` enum in `prisma/schema.prisma`.

Existing roles include:

- `SYSTEM_ADMINISTRATOR`
- `ORGANIZATION_ADMINISTRATOR`
- `VICE_ORGANIZATION_ADMINISTRATOR`
- `TRANSPORT_MANAGER`
- `VICE_TRANSPORT_MANAGER`
- `DEPARTMENT_USER`
- `DRIVER`

### Rules

- Do not create alternative role strings for existing roles.
- Enforce permissions on the server, not only by hiding buttons in the UI.
- Verify permissions for each protected read, create, update, and delete operation.
- Apply least-privilege access: users should receive only the permissions required for their role.
- Follow the existing session fields: `id`, `role`, `organizationId`, and `departmentId`.

The specific permissions for each feature must follow the project's agreed authorization rules.

## 6. Existing Status Enums

Use the existing enums instead of inventing status strings.

| Feature | Enum |
|---|---|
| Organization | `OrganizationStatus` |
| Department | `DepartmentStatus` |
| User | `UserStatus` |
| Vehicle status | `VehicleStatus` |
| Vehicle availability | `VehicleAvailability` |
| Driver | `DriverStatus` |
| Transportation request | `TransportationRequestStatus` |
| Trip | `TripStatus` |
| GPS device | `GPSDeviceStatus` |
| Geofence | `GeofenceStatus` |
| Geofence event | `GeofenceEventType` |
| Maintenance type | `MaintenanceType` |
| Maintenance | `MaintenanceStatus` |
| Alert severity | `AlertSeverity` |
| Alert | `AlertStatus` |
| Organization application | `OrganizationApplicationStatus` |
| Organization payment | `OrganizationPaymentStatus` |
| Department user application | `DepartmentUserApplicationStatus` |

Do not assume that two separate status fields mean the same thing. For example, vehicle status and vehicle availability represent different concepts.

## 7. Transportation Request and Trip Contracts

### TransportationRequest

Use the existing `TransportationRequest` model for transportation requests.

Relevant fields include:

- Purpose and description
- Origin and destination
- Passenger count
- Requested start and end times
- Special requirements and notes
- Request status and review information

Use `TransportationRequestStatus` for request states:

- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`

Validate the request before saving it. In particular, check passenger count, required fields, and requested dates.

### Trip

Use the existing `Trip` model for trip scheduling and execution.

A trip is associated with a transportation request, vehicle, driver, and organization. Its fields include scheduled and actual timestamps, status, odometer readings, and distance-related information.

Use `TripStatus` for trip states:

- `SCHEDULED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### Trip assignment rules

- Verify that the transportation request belongs to the current organization.
- Verify that the selected vehicle and driver belong to the correct organization.
- Verify that the vehicle and driver meet the requirements for assignment.
- Validate schedule conflicts and availability before assigning a trip.
- Follow the existing unique constraint on `[organizationId, transportationRequestId]`, which allows at most one trip per transportation request.
- Do not assume that approving a request automatically creates a trip unless that behavior is explicitly implemented and agreed upon.

## 8. Vehicles and Drivers

### Vehicles

Use the existing `Vehicle` model and its fields.

- `VehicleStatus` describes the vehicle's operational status.
- `VehicleAvailability` describes whether the vehicle is available for assignment.

Do not treat these fields as interchangeable.

Before assigning a vehicle, validate its organization, status, availability, and schedule.

### Drivers

Use the existing `Driver` model and `DriverStatus` enum.

Before assigning a driver, validate the driver's organization, status, and schedule.

Driver onboarding and account setup must reuse the existing onboarding flow rather than creating a second invitation or password setup process.

## 9. Dates, Numbers, and Database Types

Follow the types defined in `prisma/schema.prisma`.

### Dates and times

- Use valid date values and validate them on the server.
- Check that end times do not precede start times.
- Respect the existing distinction between timestamp fields and date-only fields.
- Use consistent timezone handling when displaying and storing scheduled events.

### Decimal values

Prisma `Decimal` values may be used for coordinates, distances, fuel quantities, and other measurements.

- Validate numeric ranges and units.
- Do not assume every decimal field is a JavaScript `number`.
- Convert values deliberately when preparing data for JSON responses.

### BigInt values

Some records, including GPS-related records, use `BigInt` identifiers.

- Do not assume every database ID is a UUID string.
- Convert `BigInt` values to strings before returning them in JSON where necessary.
- Avoid converting large `BigInt` values to JavaScript numbers, which may lose precision.

### Counts and measurements

- Passenger counts and other integer fields must be valid integers.
- Coordinates must be within valid latitude and longitude ranges.
- Validate measurements before saving them.

## 10. GPS and Geofence Contracts

Reuse the existing `GPSDevice`, `GPSLocation`, `Geofence`, and `GeofenceEvent` models.

### Rules

- Validate incoming GPS coordinates and timestamps.
- Check that GPS devices and related records belong to the expected organization.
- Preserve the distinction between the time a location was recorded and the time it was received, where those fields are used.
- Ensure that a GPS location associated with a geofence event belongs to the same organization as the event.

**Important implementation note:** The current `GeofenceEvent` to `GPSLocation` relationship references the GPS location by its ID without a composite organization relationship. Application code must verify organization ownership before connecting these records.

## 11. API and Server Action Conventions

All team members must follow consistent conventions for server actions and API routes.

### Inputs

- Validate all input on the server.
- Reject invalid or missing required fields.
- Do not trust client-supplied organization IDs, user IDs, roles, or permission claims.
- Use the existing model and enum names.

### Successful responses

- Return only the data needed by the client.
- Use consistent response shapes within the same feature.
- Serialize `Decimal`, `BigInt`, and date values deliberately.
- Avoid returning password hashes, verification tokens, reset tokens, or other secrets.

### Errors

Use consistent error handling for:

- Unauthenticated requests
- Unauthorized operations
- Invalid input
- Missing records
- Duplicate or conflicting records
- Unexpected server errors

Do not expose stack traces, database internals, or sensitive information to users.

Before introducing a shared response wrapper or error format, discuss it with the team so existing features remain compatible.

## 12. Validation and Data Integrity

- Enforce required-field validation on the server.
- Check related records before creating or updating relationships.
- Prevent cross-organization relationships.
- Respect existing unique constraints and foreign-key relationships.
- Use database transactions when a multi-step operation must succeed or fail as one unit.
- Handle concurrent updates where two users might attempt to assign the same vehicle or driver.
- Do not bypass Prisma constraints without a documented reason.

## 13. Team Development Rules

Before implementing a feature:

1. Read the relevant models and enums in `prisma/schema.prisma`.
2. Check this document for shared rules.
3. Confirm any unclear API contracts with the team.
4. Reuse existing models, authentication helpers, and validation patterns.
5. Avoid changing files owned by another feature unless coordination is agreed upon.

Before opening a pull request:

1. Confirm the feature follows organization-scoping and authorization rules.
2. Confirm it uses existing enums and relationships.
3. Test validation and error cases.
4. Run the relevant tests and type checks.
5. Document any new or changed shared contract.
6. Include screenshots or API examples when useful.

## 14. Changes Requiring Team Agreement

Discuss these changes before merging:

- Renaming or removing shared fields
- Changing existing enum values
- Changing model relationships or unique constraints
- Adding or changing shared API response formats
- Changing session fields or authorization conventions
- Changing date, Decimal, or BigInt serialization rules
- Introducing a new shared model used by multiple features

Schema changes must include the required Prisma migration.

## 15. Definition of Done

A feature is ready for review when:

- [ ] It reuses the existing schema wherever appropriate.
- [ ] Inputs are validated on the server.
- [ ] Authentication and authorization are enforced.
- [ ] Organization data is properly isolated.
- [ ] Related records are validated before use.
- [ ] Responses serialize database values correctly.
- [ ] Errors are handled without exposing sensitive details.
- [ ] Tests and type checks pass.
- [ ] Any shared contract changes are documented.
