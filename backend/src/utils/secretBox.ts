import crypto from "node:crypto";
import env from "../config/env.js";

/**
 * Small two-way lock for the few secrets the platform stores for itself - an
 * SMTP password, a provider API key. They cannot be hashed like a user's
 * password, because they have to be handed to the mail server as typed.
 *
 * The key comes from the server's own JWT secret, so there is nothing extra to
 * configure; change that secret and stored credentials stop opening, which is
 * the right way round - they are re-entered rather than silently readable.
 */

const ALGO = "aes-256-gcm";

function key(): Buffer {
  return crypto.createHash("sha256").update(env.jwt.secret).digest();
}

/** iv.tag.ciphertext, base64, in one string. */
export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    body.toString("base64"),
  ].join(".");
}

/** Null for anything that cannot be opened, rather than throwing mid-send. */
export function open(sealed: string | null): string | null {
  if (!sealed) return null;
  const [ivB64, tagB64, bodyB64] = sealed.split(".");
  if (!ivB64 || !tagB64 || !bodyB64) return null;
  try {
    const decipher = crypto.createDecipheriv(
      ALGO,
      key(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(bodyB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** What a stored secret looks like on screen: proof it is set, nothing more. */
export function maskTail(plain: string | null): string | null {
  if (!plain) return null;
  const tail = plain.slice(-4);
  return `${"•".repeat(Math.max(4, Math.min(12, plain.length - 4)))}${tail}`;
}
