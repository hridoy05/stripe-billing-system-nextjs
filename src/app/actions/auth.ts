"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, getSession } from "@/lib/session";

export type LoginState = { error: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const validEmail = process.env.AUTH_EMAIL ?? "demo@example.com";
  const validPassword = process.env.AUTH_PASSWORD ?? "password123";

  if (email !== validEmail || password !== validPassword) {
    return { error: "Invalid email or password" };
  }

  await createSession(email);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  await destroySession();
  redirect("/login");
}
