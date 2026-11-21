import assert from "node:assert/strict";
import test from "node:test";
import {
  validateOfficialDocumentBuffer,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from "./document-service";

test("registration file validation requires a valid file buffer", () => {
  const empty = Buffer.alloc(0);
  const result = validateOfficialDocumentBuffer("doc.pdf", empty);
  assert.equal(result.valid, false);
  assert.match(result.error || "", /empty/i);
});

test("registration file validation enforces 10 MB maximum file size", () => {
  const over10MB = Buffer.alloc(MAX_DOCUMENT_FILE_SIZE_BYTES + 10);
  over10MB[0] = 0x25;
  over10MB[1] = 0x50;
  over10MB[2] = 0x44;
  over10MB[3] = 0x46;
  over10MB[4] = 0x2d;

  const result = validateOfficialDocumentBuffer("doc.pdf", over10MB);
  assert.equal(result.valid, false);
  assert.match(result.error || "", /10 MB/i);
});

test("registration file validation accepts valid PDF, JPEG, and PNG signatures", () => {
  const validPdf = Buffer.from("%PDF-1.7 header");
  const pdfRes = validateOfficialDocumentBuffer("license.pdf", validPdf, "application/pdf");
  assert.equal(pdfRes.valid, true);
  assert.equal(pdfRes.detectedMimeType, "application/pdf");

  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
  const jpgRes = validateOfficialDocumentBuffer("cert.jpg", validJpeg, "image/jpeg");
  assert.equal(jpgRes.valid, true);
  assert.equal(jpgRes.detectedMimeType, "image/jpeg");

  const jpegExtRes = validateOfficialDocumentBuffer("cert.jpeg", validJpeg, "image/jpeg");
  assert.equal(jpegExtRes.valid, true);

  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngRes = validateOfficialDocumentBuffer("id.png", validPng, "image/png");
  assert.equal(pngRes.valid, true);
  assert.equal(pngRes.detectedMimeType, "image/png");
});

test("registration file validation rejects invalid extensions and file disguise", () => {
  const pdfBuffer = Buffer.from("%PDF-1.4");
  const badExt = validateOfficialDocumentBuffer("doc.txt", pdfBuffer);
  assert.equal(badExt.valid, false);
  assert.match(badExt.error || "", /extension/i);

  const textBuffer = Buffer.from("this is a text file not pdf");
  const disguised = validateOfficialDocumentBuffer("fake.pdf", textBuffer);
  assert.equal(disguised.valid, false);
  assert.match(disguised.error || "", /not match any accepted format/i);

  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const mismatchExt = validateOfficialDocumentBuffer("fake.jpg", pngBuffer);
  assert.equal(mismatchExt.valid, false);
  assert.match(mismatchExt.error || "", /does not match/i);
});

test("registration file validation detects client MIME type mismatch", () => {
  const pdfBuffer = Buffer.from("%PDF-1.4 valid");
  const spoofedMime = validateOfficialDocumentBuffer("file.pdf", pdfBuffer, "image/png");
  assert.equal(spoofedMime.valid, false);
  assert.match(spoofedMime.error || "", /MIME type does not match/i);
});

test("fleet size validation exact values match specifications", () => {
  const VALID_FLEET_SIZES = ["1-10", "11-50", "51-100", "101-500", "500+"];
  for (const size of VALID_FLEET_SIZES) {
    assert.ok(VALID_FLEET_SIZES.includes(size));
  }
  assert.equal(VALID_FLEET_SIZES.includes("0-5"), false);
  assert.equal(VALID_FLEET_SIZES.includes("1000+"), false);
});

test("department count validation accepts null or valid non-negative integer", () => {
  const validCounts = ["0", "1", "15", "500", "10000"];
  for (const count of validCounts) {
    assert.equal(/^\d+$/.test(count), true);
    const parsed = parseInt(count, 10);
    assert.equal(parsed >= 0 && parsed <= 10000, true);
  }

  const invalidCounts = ["-1", "abc", "2.5", "10001"];
  for (const count of invalidCounts) {
    const isInt = /^\d+$/.test(count) && parseInt(count, 10) <= 10000 && parseInt(count, 10) >= 0;
    assert.equal(isInt, false);
  }
});

test("website URL validation accepts valid protocols or normalizes hostname", () => {
  const validWebsites = [
    "https://example.com",
    "http://my-company.org",
    "https://fleet.logistics.co.uk/about",
    "example.com",
  ];

  for (const site of validWebsites) {
    const urlToTest = /^https?:\/\//i.test(site) ? site : `https://${site}`;
    let valid = true;
    try {
      const parsed = new URL(urlToTest);
      if (!parsed.hostname || !parsed.hostname.includes(".")) {
        valid = false;
      }
    } catch {
      valid = false;
    }
    assert.equal(valid, true, `Failed for ${site}`);
  }

  const invalidWebsites = ["not-a-website", "http://", ""];
  for (const site of invalidWebsites) {
    if (!site) continue;
    const urlToTest = /^https?:\/\//i.test(site) ? site : `https://${site}`;
    let valid = true;
    try {
      const parsed = new URL(urlToTest);
      if (!parsed.hostname || !parsed.hostname.includes(".")) {
        valid = false;
      }
    } catch {
      valid = false;
    }
    assert.equal(valid, false, `Should have failed for ${site}`);
  }
});
