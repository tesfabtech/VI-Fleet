import assert from "node:assert/strict";

// Automatically load .env in Node 20.12+ / Node 24+ and provide a safe fallback for unit verification
try {
  process.loadEnvFile?.(".env");
} catch {
  // Ignore if .env is not present during offline unit checks
}
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/vi_fleet";

async function runVerification() {
  const {
    canCancelTransportationRequest,
    canEditTransportationRequest,
    canHardDeleteTransportationRequest,
    canSoftDeleteTransportationRequest,
    decodeSpecialRequirements,
    encodeSpecialRequirements,
    formatAddisDateTime,
    isUuid,
    toAddisDateTimeLocalValue,
  } = await import("../lib/department-auth");

  console.log("=== VI-Fleet Department Transportation Requests Verification ===");

  // 1. Verify UUID Guard
  assert.equal(isUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  console.log("✔ UUID format guard verified.");

  // 2. Verify Edit State Machine (Only active PENDING is editable)
  assert.equal(canEditTransportationRequest("PENDING", null), true);
  assert.equal(canEditTransportationRequest("PENDING", new Date()), false);
  assert.equal(canEditTransportationRequest("APPROVED", null), false);
  assert.equal(canEditTransportationRequest("REJECTED", null), false);
  assert.equal(canEditTransportationRequest("CANCELLED", null), false);
  console.log("✔ Edit state machine verified (strictly active PENDING only).");

  // 3. Verify Cancel State Machine (PENDING, or APPROVED when Trip is null or SCHEDULED)
  assert.equal(canCancelTransportationRequest("PENDING", null, null), true);
  assert.equal(canCancelTransportationRequest("PENDING", null, new Date()), false);
  assert.equal(canCancelTransportationRequest("APPROVED", null, null), true);
  assert.equal(canCancelTransportationRequest("APPROVED", "SCHEDULED", null), true);
  assert.equal(canCancelTransportationRequest("APPROVED", "IN_PROGRESS", null), false);
  assert.equal(canCancelTransportationRequest("APPROVED", "COMPLETED", null), false);
  assert.equal(canCancelTransportationRequest("REJECTED", null, null), false);
  assert.equal(canCancelTransportationRequest("CANCELLED", null, null), false);
  console.log(
    "✔ Cancel state machine verified (blocks soft-deleted, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED).",
  );

  // 4. Verify Soft Delete & Permanent Delete (Recycle Bin) State Machine
  assert.equal(canSoftDeleteTransportationRequest("PENDING", null, null), true);
  assert.equal(canSoftDeleteTransportationRequest("REJECTED", null, null), true);
  assert.equal(canSoftDeleteTransportationRequest("CANCELLED", "CANCELLED", null), true);
  assert.equal(canSoftDeleteTransportationRequest("APPROVED", "SCHEDULED", null), false);
  assert.equal(canSoftDeleteTransportationRequest("APPROVED", "IN_PROGRESS", null), false);
  assert.equal(canSoftDeleteTransportationRequest("APPROVED", "COMPLETED", null), true);
  assert.equal(canSoftDeleteTransportationRequest("PENDING", null, new Date()), false);

  assert.equal(canHardDeleteTransportationRequest(null, null), false);
  assert.equal(canHardDeleteTransportationRequest(null, new Date()), true);
  assert.equal(canHardDeleteTransportationRequest("CANCELLED", new Date()), true);
  assert.equal(canHardDeleteTransportationRequest("COMPLETED", new Date()), false);
  console.log("✔ Soft delete & Recycle Bin permanent delete rules verified.");

  // 5. Verify Structured Fleet Manager Metadata Encoding/Decoding
  const encoded = encodeSpecialRequirements({
    tripType: "ONE_WAY",
    priority: "URGENT",
    vehiclePreference: "SUV_4X4",
    contactName: "Dr. Abebe Kebede",
    contactPhone: "+251 911 223344",
    cargoDetails: "2 boxes of network switches (~35 kg)",
    extraRequirements: "Rough terrain clearance needed for field site.",
  });

  const decoded = decodeSpecialRequirements(encoded);
  assert.equal(decoded.tripType, "ONE_WAY");
  assert.equal(decoded.priority, "URGENT");
  assert.equal(decoded.vehiclePreference, "SUV_4X4");
  assert.equal(decoded.contactName, "Dr. Abebe Kebede");
  assert.equal(decoded.contactPhone, "+251 911 223344");
  assert.equal(decoded.cargoDetails, "2 boxes of network switches (~35 kg)");
  assert.equal(
    decoded.extraRequirements,
    "Rough terrain clearance needed for field site.",
  );
  console.log("✔ Structured Fleet Manager metadata encode/decode verified.");

  // 6. Verify Africa/Addis_Ababa (UTC+3) Date Formatting
  const sampleUtc = new Date("2026-11-10T06:30:00.000Z");
  const localInput = toAddisDateTimeLocalValue(sampleUtc);
  assert.equal(localInput, "2026-11-10T09:30");
  assert.ok(formatAddisDateTime(sampleUtc).includes("2026"));
  console.log("✔ Africa/Addis_Ababa (UTC+3) date conversion verified.");

  console.log("\nAll Department Transportation Request & Recycle Bin checks passed!");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
