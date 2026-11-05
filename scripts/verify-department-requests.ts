import assert from "node:assert/strict";
import {
  canCancelTransportationRequest,
  canEditTransportationRequest,
  decodeSpecialRequirements,
  encodeSpecialRequirements,
  formatAddisDateTime,
  toAddisDateTimeLocalValue,
} from "../lib/department-auth";

async function runVerification() {
  console.log("=== VI-Fleet Department Transportation Requests Verification ===");

  // 1. Verify Edit State Machine (Only PENDING is editable)
  assert.equal(canEditTransportationRequest("PENDING"), true);
  assert.equal(canEditTransportationRequest("APPROVED"), false);
  assert.equal(canEditTransportationRequest("REJECTED"), false);
  assert.equal(canEditTransportationRequest("CANCELLED"), false);
  console.log("✔ Edit state machine verified (strictly PENDING only).");

  // 2. Verify Cancel State Machine (PENDING, or APPROVED when Trip is null or SCHEDULED)
  assert.equal(canCancelTransportationRequest("PENDING", null), true);
  assert.equal(canCancelTransportationRequest("APPROVED", null), true);
  assert.equal(canCancelTransportationRequest("APPROVED", "SCHEDULED"), true);
  assert.equal(canCancelTransportationRequest("APPROVED", "IN_PROGRESS"), false);
  assert.equal(canCancelTransportationRequest("APPROVED", "COMPLETED"), false);
  assert.equal(canCancelTransportationRequest("REJECTED", null), false);
  assert.equal(canCancelTransportationRequest("CANCELLED", null), false);
  console.log(
    "✔ Cancel state machine verified (blocks IN_PROGRESS, COMPLETED, REJECTED, CANCELLED).",
  );

  // 3. Verify Structured Fleet Manager Metadata Encoding/Decoding
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

  // 4. Verify Plain Legacy specialRequirements Fallback
  const legacyDecoded = decodeSpecialRequirements("Wheelchair accessible van");
  assert.equal(legacyDecoded.tripType, "ROUND_TRIP");
  assert.equal(legacyDecoded.priority, "STANDARD");
  assert.equal(legacyDecoded.vehiclePreference, "ANY");
  assert.equal(legacyDecoded.extraRequirements, "Wheelchair accessible van");
  console.log("✔ Legacy specialRequirements fallback verified.");

  // 5. Verify Africa/Addis_Ababa (UTC+3) Date Formatting
  const sampleUtc = new Date("2026-11-10T06:30:00.000Z"); // 09:30 in Addis Ababa (+03:00)
  const localInput = toAddisDateTimeLocalValue(sampleUtc);
  assert.equal(localInput, "2026-11-10T09:30");
  assert.ok(formatAddisDateTime(sampleUtc).includes("2026"));
  console.log("✔ Africa/Addis_Ababa (UTC+3) date conversion verified.");

  console.log("\nAll Department Transportation Request checks passed!");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});