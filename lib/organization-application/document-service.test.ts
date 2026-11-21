import assert from "node:assert/strict";
import test from "node:test";
import {
  detectFileSignature,
  validateOfficialDocumentBuffer,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from "./document-service";

test("detectFileSignature correctly identifies PDF, JPEG, and PNG magic bytes", () => {
  const pdfBuffer = Buffer.from("%PDF-1.4 sample content");
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
  const textBuffer = Buffer.from("Hello plain text");

  assert.deepEqual(detectFileSignature(pdfBuffer), {
    mimeType: "application/pdf",
    extension: "pdf",
  });
  assert.deepEqual(detectFileSignature(jpegBuffer), {
    mimeType: "image/jpeg",
    extension: "jpg",
  });
  assert.deepEqual(detectFileSignature(pngBuffer), {
    mimeType: "image/png",
    extension: "png",
  });
  assert.equal(detectFileSignature(textBuffer), null);
});

test("validateOfficialDocumentBuffer accepts valid PDF, JPEG, and PNG files", () => {
  const pdfBuffer = Buffer.from("%PDF-1.5 official registration document");
  const pdfResult = validateOfficialDocumentBuffer(
    "certificate.pdf",
    pdfBuffer,
    "application/pdf",
  );
  assert.equal(pdfResult.valid, true);
  assert.equal(pdfResult.detectedMimeType, "application/pdf");
  assert.equal(pdfResult.extension, "pdf");

  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xee, 0x00]);
  const jpegResult = validateOfficialDocumentBuffer(
    "business_license.jpg",
    jpegBuffer,
    "image/jpeg",
  );
  assert.equal(jpegResult.valid, true);
  assert.equal(jpegResult.detectedMimeType, "image/jpeg");

  const jpegExtResult = validateOfficialDocumentBuffer(
    "business_license.jpeg",
    jpegBuffer,
    "image/jpeg",
  );
  assert.equal(jpegExtResult.valid, true);

  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const pngResult = validateOfficialDocumentBuffer(
    "registration.png",
    pngBuffer,
    "image/png",
  );
  assert.equal(pngResult.valid, true);
  assert.equal(pngResult.detectedMimeType, "image/png");
});

test("validateOfficialDocumentBuffer rejects empty files", () => {
  const emptyBuffer = Buffer.alloc(0);
  const result = validateOfficialDocumentBuffer("doc.pdf", emptyBuffer);
  assert.equal(result.valid, false);
  assert.match(result.error || "", /empty/i);
});

test("validateOfficialDocumentBuffer rejects files exceeding 10 MB", () => {
  // Simulate oversized buffer without allocating 11MB of memory by testing size check
  const oversizedBuffer = Buffer.alloc(MAX_DOCUMENT_FILE_SIZE_BYTES + 1);
  // Give it valid PDF signature
  oversizedBuffer[0] = 0x25;
  oversizedBuffer[1] = 0x50;
  oversizedBuffer[2] = 0x44;
  oversizedBuffer[3] = 0x46;
  oversizedBuffer[4] = 0x2d;

  const result = validateOfficialDocumentBuffer("large.pdf", oversizedBuffer);
  assert.equal(result.valid, false);
  assert.match(result.error || "", /10 MB/i);
});

test("validateOfficialDocumentBuffer rejects unsupported extensions", () => {
  const buffer = Buffer.from("%PDF-1.4");
  const result = validateOfficialDocumentBuffer("document.exe", buffer);
  assert.equal(result.valid, false);
  assert.match(result.error || "", /extension/i);
});

test("validateOfficialDocumentBuffer rejects disguised files (extension mismatch)", () => {
  // Plain text disguised as PDF
  const textBuffer = Buffer.from("This is not a real PDF file");
  const result = validateOfficialDocumentBuffer("fake.pdf", textBuffer);
  assert.equal(result.valid, false);
  assert.match(result.error || "", /not match any accepted format/i);

  // JPEG file with .pdf extension
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const mismatchResult = validateOfficialDocumentBuffer("image.pdf", jpegBuffer);
  assert.equal(mismatchResult.valid, false);
  assert.match(mismatchResult.error || "", /does not match/i);
});

test("validateOfficialDocumentBuffer rejects conflicting client MIME types", () => {
  const pdfBuffer = Buffer.from("%PDF-1.4 valid content");
  const result = validateOfficialDocumentBuffer(
    "valid.pdf",
    pdfBuffer,
    "image/png",
  );
  assert.equal(result.valid, false);
  assert.match(result.error || "", /MIME type does not match/i);
});
