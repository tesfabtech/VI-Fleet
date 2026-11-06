import assert from "node:assert/strict";

try {
  process.loadEnvFile?.(".env");
} catch {
  // Ignore if .env is absent during pure unit checks
}
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/vi_fleet";

async function runReviewVerification() {
  const {
    canReviewTransportationRequest,
    decodeSpecialRequirements,
    encodeSpecialRequirements,
    formatWaitingDuration,
    isUuid,
  } = await import("../lib/department-auth");

  console.log(
    "=== VI-Fleet Issue #8: Transportation Request Review & Approval Verification ===",
  );

  // 1. Verify Eligible Review States (Strictly active PENDING requests)
  assert.equal(canReviewTransportationRequest("PENDING", null), true);
  assert.equal(canReviewTransportationRequest("PENDING", new Date()), false);
  assert.equal(canReviewTransportationRequest("APPROVED", null), false);
  assert.equal(canReviewTransportationRequest("REJECTED", null), false);
  assert.equal(canReviewTransportationRequest("CANCELLED", null), false);
  console.log(
    "✔ Review eligibility state machine verified (strictly active PENDING only).",
  );

  // 2. Verify Separate Storage of Admin Dispatch Note & Transport Escalation Flag
  const encoded = encodeSpecialRequirements({
    tripType: "ROUND_TRIP",
    priority: "URGENT",
    vehiclePreference: "BUS",
    contactName: "Prof.Bekele Tadesse",
    contactPhone: "+251 911 998877",
    cargoDetails: "Field research kits",
    extraRequirements: "Depart promptly at 7:00 AM",
    adminReviewNote: "Approved by Org Admin: assign 45-seat Coaster bus.",
    transportFlagReason: "Coaster bus in maintenance until 10:00 AM",
  });

  const decoded = decodeSpecialRequirements(encoded);
  assert.equal(
    decoded.adminReviewNote,
    "Approved by Org Admin: assign 45-seat Coaster bus.",
  );
  assert.equal(
    decoded.transportFlagReason,
    "Coaster bus in maintenance until 10:00 AM",
  );
  assert.equal(decoded.extraRequirements, "Depart promptly at 7:00 AM");
  console.log(
    "✔ Separate Admin Dispatch Note and Transport Flag serialization verified.",
  );

  // 3. Verify Waiting Duration Badge Calculation
  const base = new Date("2026-11-06T10:00:00Z");
  const plus45m = new Date("2026-11-06T10:45:00Z");
  const plus5h = new Date("2026-11-06T15:00:00Z");
  const plus2d3h = new Date("2026-11-08T13:00:00Z");

  assert.equal(formatWaitingDuration(base, plus45m), "45m");
  assert.equal(formatWaitingDuration(base, plus5h), "5h");
  assert.equal(formatWaitingDuration(base, plus2d3h), "2d 3h");
  console.log("✔ Waiting duration badge calculation verified.");

  // 4. Verify UUID Guard
  assert.equal(isUuid("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(isUuid("invalid-id"), false);
  console.log("✔ UUID parameter validation verified.");

  console.log("\nAll Issue #8 Request Review & Approval checks passed!");
}

runReviewVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
