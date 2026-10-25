
import { Resend } from "resend";

const FROM_EMAIL =
  process.env.EMAIL_FROM ?? "VI-Fleet <onboarding@resend.dev>";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(apiKey);
}

export function getAppUrl(path: string): string {
  const configuredUrl = process.env.APP_URL;

  if (!configuredUrl) {
    throw new Error("APP_URL is not configured.");
  }

  const baseUrl = new URL(configuredUrl);

  if (
    baseUrl.protocol !== "https:" &&
    !(process.env.NODE_ENV === "development" && baseUrl.protocol === "http:")
  ) {
    throw new Error("APP_URL must use HTTPS outside local development.");
  }

  if (baseUrl.username || baseUrl.password) {
    throw new Error("APP_URL must not contain credentials.");
  }

  return new URL(path, baseUrl).toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const resend = getResendClient();

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [input.to],
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  if (error || !data?.id) {
    console.error("VI-Fleet email request failed:", error?.message ?? "No email ID returned.");
    throw new Error("Email delivery could not be confirmed.");
  }
}

export async function sendAdministratorInvitationEmail(input: {
  to: string;
  organizationName: string;
  invitationUrl: string;
}): Promise<void> {
  const organizationName = escapeHtml(input.organizationName);
  const invitationUrl = escapeHtml(input.invitationUrl);

  await sendEmail({
    to: input.to,
    subject: `Set up your VI-Fleet administrator account`,
    text: [
      `Your organization, ${input.organizationName}, has been approved for VI-Fleet.`,
      "",
      "Use the following link to set up your administrator account:",
      input.invitationUrl,
      "",
      "This invitation expires in 48 hours and can only be used once.",
      "If you were not expecting this email, you can ignore it.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:auto">
        <h2>Welcome to VI-Fleet</h2>
        <p>Your organization, <strong>${organizationName}</strong>, has been approved.</p>
        <p>Use the button below to set up your administrator account.</p>
        <p>
          <a href="${invitationUrl}"
             style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px">
            Set up administrator account
          </a>
        </p>
        <p>This invitation expires in 48 hours and can only be used once.</p>
        <p>If you were not expecting this email, you can ignore it.</p>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail(input: {
  to: string;
  name: string;
  verificationUrl: string;
}): Promise<void> {
  const name = escapeHtml(input.name);
  const verificationUrl = escapeHtml(input.verificationUrl);

  await sendEmail({
    to: input.to,
    subject: "Verify your VI-Fleet email address",
    text: [
      `Hello ${input.name},`,
      "",
      "Please verify your email address to activate your VI-Fleet account:",
      input.verificationUrl,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:auto">
        <h2>Verify your email address</h2>
        <p>Hello ${name},</p>
        <p>Verify your email address to activate your VI-Fleet account.</p>
        <p>
          <a href="${verificationUrl}"
             style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px">
            Verify email address
          </a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendDepartmentUserInvitationEmail(input: {
  to: string;
  organizationName: string;
  departmentName: string;
  invitationUrl: string;
}): Promise<void> {
  const organizationName = escapeHtml(input.organizationName);
  const departmentName = escapeHtml(input.departmentName);
  const invitationUrl = escapeHtml(input.invitationUrl);

  await sendEmail({
    to: input.to,
    subject: "Set up your VI-Fleet Department User account",
    text: [
      `Your application to join ${input.organizationName} has been approved.`,
      `Department: ${input.departmentName}`,
      "",
      "Use this link to complete your account setup:",
      input.invitationUrl,
      "",
      "This invitation expires in 48 hours and can only be used once.",
      "Your account will become active after you complete setup and verify your email.",
      "If you were not expecting this email, you can ignore it.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:auto">
        <h2>Welcome to VI-Fleet</h2>
        <p>Your application to join <strong>${organizationName}</strong> has been approved.</p>
        <p>Department: <strong>${departmentName}</strong></p>
        <p>Use the button below to complete your account setup.</p>
        <p>
          <a href="${invitationUrl}"
             style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px">
            Set up your account
          </a>
        </p>
        <p>This invitation expires in 48 hours and can only be used once.</p>
        <p>Your account will become active after setup and email verification.</p>
        <p>If you were not expecting this email, you can ignore it.</p>
      </div>
    `,
  });
}