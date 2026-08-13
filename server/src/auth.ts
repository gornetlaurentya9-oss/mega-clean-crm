import crypto from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

/** Creates an opaque, stateless session token: "<expiry>.<hmac>". */
export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const signature = sign(String(expires));
  return `${expires}.${signature}`;
}

export function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const [expiresStr, signature] = token.split(".");
  if (!expiresStr || !signature) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = sign(expiresStr);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "changeme123";
  // Constant-time-ish compare via timingSafeEqual with padded buffers.
  const a = Buffer.from(password.padEnd(256, "\0"));
  const b = Buffer.from(expected.padEnd(256, "\0"));
  return crypto.timingSafeEqual(a, b) && password.length === expected.length;
}
