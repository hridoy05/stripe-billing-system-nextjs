import { cookies } from "next/headers";
import { io } from "next/cache";
import { cache } from "react";
import {
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = createSessionToken({ userId, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await io();
  return verifySessionToken(token, Date.now());
});
