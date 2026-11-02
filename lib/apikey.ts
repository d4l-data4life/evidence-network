// API key minting + verification for site-scoped machine credentials.
//
// Token format: enk_live_<pub>_<secret>
//   - enk_live_<pub>  is the PUBLIC prefix (stored as ApiKey.prefix, unique) —
//     used to look a key up and to identify it in the UI.
//   - <secret>        is the high-entropy part; only sha256(full token) is
//     stored (ApiKey.hashedKey). The plaintext is shown once at creation.
//
// A random 256-bit secret is high-entropy, so a fast hash (sha256) with a
// constant-time compare is the standard, appropriate choice for API tokens
// (unlike user passwords, which need a slow hash).

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const NAMESPACE = "enk";
const ENV = "live";

export interface GeneratedApiKey {
  /** Full plaintext token to show the user exactly once. */
  secret: string;
  /** Public prefix stored on the row (unique, safe to display). */
  prefix: string;
  /** sha256(secret) hex — what we persist. */
  hashedKey: string;
}

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Mint a new key. `prefix` is `enk_live_<12 hex>`; secret adds 32 more bytes. */
export function generateApiKey(): GeneratedApiKey {
  const pub = randomBytes(6).toString("hex"); // 12 hex chars
  const secretPart = randomBytes(32).toString("hex"); // 64 hex chars
  const prefix = `${NAMESPACE}_${ENV}_${pub}`;
  const secret = `${prefix}_${secretPart}`;
  return { secret, prefix, hashedKey: hashApiKey(secret) };
}

/**
 * Extract the public prefix (`enk_live_<pub>`) from a presented token, for the
 * DB lookup in the push endpoint (P2). Returns null if the shape is wrong.
 */
export function prefixFromSecret(secret: string): string | null {
  const parts = secret.split("_");
  if (parts.length !== 4) return null;
  const [ns, env, pub] = parts;
  if (ns !== NAMESPACE || env !== ENV || !/^[0-9a-f]{12}$/.test(pub)) return null;
  return `${ns}_${env}_${pub}`;
}

/** Constant-time check of a presented token against a stored sha256 hash. */
export function verifyApiKey(secret: string, hashedKey: string): boolean {
  const a = Buffer.from(hashApiKey(secret), "hex");
  const b = Buffer.from(hashedKey, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
