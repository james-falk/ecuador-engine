// AES-256-GCM at rest for the refresh token. The key (32 bytes hex) lives
// in OAUTH_TOKEN_KEY. Never log plaintext; never log ciphertext alongside
// the key. Encoding: base64(iv || authTag || ciphertext) so the row stores
// one self-contained string.

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.OAUTH_TOKEN_KEY;
  if (!hex) {
    throw new Error(
      "OAUTH_TOKEN_KEY is missing. Set a 64-char hex string in .env.local (32 random bytes)."
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("OAUTH_TOKEN_KEY must be 64 hex chars (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
