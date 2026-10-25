
import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptRegistrationToken(token: string): string {
  const iv = randomBytes(12);

  const cipher = createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv,
  );

  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptRegistrationToken(
  encryptedToken: string,
): string {
  const parts = encryptedToken.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted registration token.");
  }

  const [ivPart, tagPart, ciphertextPart] = parts;

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  if (
    iv.length !== 12 ||
    authTag.length !== 16 ||
    ciphertext.length === 0
  ) {
    throw new Error("Invalid encrypted registration token.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv,
  );

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
