"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-md border border-black/[.08] bg-white px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="rounded-md border border-black/[.08] bg-white px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-80"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
