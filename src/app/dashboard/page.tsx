import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { getSession } from "@/lib/session";

async function SessionInfo() {
  const session = await getSession();

  if (!session) {
    return <p className="text-zinc-600 dark:text-zinc-400">Not signed in.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-zinc-600 dark:text-zinc-400">
        Signed in as <strong>{session.userId}</strong>
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-background"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-sm flex-col gap-6 rounded-xl bg-white p-8 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Suspense fallback={<p>Loading session…</p>}>
          <SessionInfo />
        </Suspense>
      </main>
    </div>
  );
}
