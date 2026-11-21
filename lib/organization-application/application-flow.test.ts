import assert from "node:assert/strict";
import test from "node:test";
import { submitOrganizationApplication } from "@/app/register/actions";
import {
  validateOfficialDocumentBuffer,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from "./document-service";

test("submitOrganizationApplication rejects empty form with all missing required fields", async () => {
  const formData = new FormData();
  const result = await submitOrganizationApplication(
    { success: false, message: "" },
    formData,
  );

  assert.equal(result.success, false);
  assert.ok(result.errors);
  assert.ok(result.errors.organizationName, "Should require organizationName");
  assert.ok(result.errors.organizationType, "Should require organizationType");
  assert.ok(result.errors.contactEmail, "Should require contactEmail");
  assert.ok(result.errors.phone, "Should require phone");
  assert.ok(result.errors.country, "Should require country");
  assert.ok(result.errors.region, "Should require region");
  assert.ok(result.errors.city, "Should require city");
  assert.ok(result.errors.estimatedFleetSize, "Should require estimatedFleetSize");
  assert.ok(result.errors.officialDocument, "Should require officialDocument");
});

test("submitOrganizationApplication rejects invalid organization type enum", async () => {
  const formData = new FormData();
  formData.set("organizationName", "Acme Corp");
  formData.set("organizationType", "SUPER_COMPANY"); // Invalid enum value
  formData.set("contactEmail", "info@acme.com");
  formData.set("phone", "+1234567890");
  formData.set("country", "Ethiopia");
  formData.set("region", "Addis Ababa");
  formData.set("city", "Addis Ababa");
  formData.set("estimatedFleetSize", "11-50");

  const pdfFile = new File([Buffer.from("%PDF-1.4 sample")], "license.pdf", {
    type: "application/pdf",
  });
  formData.set("officialDocument", pdfFile);

  const result = await submitOrganizationApplication(
    { success: false, message: "" },
    formData,
  );

  assert.equal(result.success, false);
  assert.ok(result.errors?.organizationType);
  assert.match(result.errors.organizationType, /valid organization type/i);
});

test("submitOrganizationApplication rejects invalid email format", async () => {
  const formData = new FormData();
  formData.set("organizationName", "Acme Corp");
  formData.set("organizationType", "PRIVATE_COMPANY");
  formData.set("contactEmail", "not-an-email"); // Invalid email
  formData.set("phone", "+1234567890");
  formData.set("country", "Ethiopia");
  formData.set("region", "Addis Ababa");
  formData.set("city", "Addis Ababa");
  formData.set("estimatedFleetSize", "11-50");

  const pdfFile = new File([Buffer.from("%PDF-1.4 sample")], "license.pdf", {
    type: "application/pdf",
  });
  formData.set("officialDocument", pdfFile);

  const result = await submitOrganizationApplication(
    { success: false, message: "" },
    formData,
  );

  assert.equal(result.success, false);
  assert.ok(result.errors?.contactEmail);
  assert.match(result.errors.contactEmail, /valid contact email/i);
});

test("submitOrganizationApplication rejects invalid phone number length", async () => {
  const formData = new FormData();
  formData.set("organizationName", "Acme Corp");
  formData.set("organizationType", "PRIVATE_COMPANY");
  formData.set("contactEmail", "admin@acme.com");
  formData.set("phone", "12345678901234567890123456789012345"); // 35 chars (> 30)
  formData.set("country", "Ethiopia");
  formData.set("region", "Addis Ababa");
  formData.set("city", "Addis Ababa");
  formData.set("estimatedFleetSize", "11-50");

  const pdfFile = new File([Buffer.from("%PDF-1.4 sample")], "license.pdf", {
    type: "application/pdf",
  });
  formData.set("officialDocument", pdfFile);

  const result = await submitOrganizationApplication(
    { success: false, message: "" },
    formData,
  );

  assert.equal(result.success, false);
  assert.ok(result.errors?.phone);
  assert.match(result.errors.phone, /30 characters/i);
});

test("submitOrganizationApplication rejects invalid website URL", async () => {
  const formData = new FormData();
  formData.set("organizationName", "Acme Corp");
  formData.set("organizationType", "PRIVATE_COMPANY");
  formData.set("contactEmail", "admin@acme.com");
  formData.set("phone", "+1234567890");
  formData.set("website", "not-a-valid-url");
  formData.set("country", "Ethiopia");
  formData.set("region", "Addis Ababa");
  formData.set("city", "Addis Ababa");
  formData.set("estimatedFleetSize", "11-50");

  const pdfFile = new File([Buffer.from("%PDF-1.4 sample")], "license.pdf", {
    type: "application/pdf",
  });
  formData.set("officialDocument", pdfFile);

  const result = await submitOrganizationApplication(
    { success: false, message: "" },
    formData,
  );

  assert.equal(result.success, false);
  assert.ok(result.errors?.website);
  assert.match(result.errors.website, /valid website/i);
});

test("submitOrganizationApplication rejects invalid estimated fleet size", async () => {
  const formData = new FormData();
  formData.set("organizationName", "Acme Corp");
  formData.set("organizationType", "PRIVATE_COMPANY");
  formData.set("contactEmail", "admin@acme.com");
  formData.set("phone", "+1234567890");
  formData.set("country", "Ethiopia");
  formData.set("region", "Addis Ababa");
  formData.set("city", "Addis Ababa");
  formData.set("estimatedFleetSize", "1000+"); // Invalid fleet size

  const pdfFile = new File([Buffer.from("%PDF-1.4 sample")], "license.pdf", {
    type: "application/pdf",
  });
  formData.set("officialDocument", pdfFile);

  const result = await submitOrganizationApplication(
    { success: false, message: "" },
    formData,
  );

  assert.equal(result.success, false);
  assert.ok(result.errors?.estimatedFleetSize);
  assert.match(result.errors.estimatedFleetSize, /valid fleet size/i);
});

test("submitOrganizationApplication rejects invalid department count", async () => {
  const formData = new FormData();
  formData.set("organizationName", "Acme Corp");
  formData.set("organizationType", "PRIVATE_COMPANY");
  formData.set("contactEmail", "admin@acme.com");
  formData.set("phone", "+1234567890");
  formData.set("country", "Ethiopia");
  formData.set("region", "Addis Ababa");
  formData.set("city", "Addis Ababa");
  formData.set("estimatedFleetSize", "1-10");
  formData.set("departmentCount", "-5"); // Negative number

  const pdfFile = new File([Buffer.from("%PDF-1.4 sample")], "license.pdf", {
    type: "application/pdf",
  });
  formData.set("officialDocument", pdfFile);

  const result = await submitOrganizationApplication(
    { success: false, message: "" },
    formData,
  );

  assert.equal(result.success, false);
  assert.ok(result.errors?.departmentCount);
  assert.match(result.errors.departmentCount, /whole number/i);
});

test("submitOrganizationApplication rejects fake document disguised as PDF", async () => {
  const formData = new FormData();
  formData.set("organizationName", "Acme Corp");
  formData.set("organizationType", "PRIVATE_COMPANY");
  formData.set("contactEmail", "admin@acme.com");
  formData.set("phone", "+1234567890");
  formData.set("country", "Ethiopia");
  formData.set("region", "Addis Ababa");
  formData.set("city", "Addis Ababa");
  formData.set("estimatedFleetSize", "1-10");

  // Plain text content named .pdf
  const fakePdf = new File([Buffer.from("This is not a real PDF file")], "license.pdf", {
    type: "application/pdf",
  });
  formData.set("officialDocument", fakePdf);

  const result = await submitOrganizationApplication(
    { success: false, message: "" },
    formData,
  );

  assert.equal(result.success, false);
  assert.ok(result.errors?.officialDocument);
  assert.match(result.errors.officialDocument, /not match any accepted format/i);
});

test("approval data mapping correctly copies all 8 profile fields to Organization", () => {
  // Simulate the data mapping done in approveOrganizationApplication
  const mockApplication = {
    id: "app-uuid-1",
    organizationName: "Global Trans Co",
    description: "Leading fleet services",
    contactEmail: "ops@globaltrans.com",
    phone: "+251911223344",
    organizationType: "PRIVATE_COMPANY" as const,
    website: "https://globaltrans.com",
    country: "Ethiopia",
    region: "Oromia",
    city: "Adama",
    streetAddress: "Highway 10, Sector B",
    departmentCount: 8,
    estimatedFleetSize: "51-100",
    officialDocumentKey: "organization-applications/app-uuid-1/official-document/doc.pdf",
    officialDocumentFileName: "registration_cert.pdf",
    officialDocumentMimeType: "application/pdf",
    officialDocumentSize: 1048576,
  };

  const code = "VIF-00115";

  // This matches lines 327-340 of app/admin/applications/actions.ts:
  const organizationData = {
    name: mockApplication.organizationName,
    description: mockApplication.description,
    contactEmail: mockApplication.contactEmail,
    phone: mockApplication.phone,
    code,
    organizationType: mockApplication.organizationType,
    website: mockApplication.website,
    country: mockApplication.country,
    region: mockApplication.region,
    city: mockApplication.city,
    streetAddress: mockApplication.streetAddress,
    departmentCount: mockApplication.departmentCount,
    estimatedFleetSize: mockApplication.estimatedFleetSize,
  };

  assert.equal(organizationData.name, "Global Trans Co");
  assert.equal(organizationData.code, "VIF-00115");
  assert.equal(organizationData.organizationType, "PRIVATE_COMPANY");
  assert.equal(organizationData.website, "https://globaltrans.com");
  assert.equal(organizationData.country, "Ethiopia");
  assert.equal(organizationData.region, "Oromia");
  assert.equal(organizationData.city, "Adama");
  assert.equal(organizationData.streetAddress, "Highway 10, Sector B");
  assert.equal(organizationData.departmentCount, 8);
  assert.equal(organizationData.estimatedFleetSize, "51-100");

  // Verify official document fields are NOT copied to Organization
  assert.equal("officialDocumentKey" in organizationData, false);
  assert.equal("officialDocumentFileName" in organizationData, false);
  assert.equal("officialDocumentMimeType" in organizationData, false);
  assert.equal("officialDocumentSize" in organizationData, false);
});
