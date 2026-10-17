import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  userId: string;
  expiresAt: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken(payload: SessionPayload): string {
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
  now: number
): SessionPayload | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64urlDecode(body)) as SessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.userId !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt < now
  ) {
    return null;
  }

  return payload;
}
