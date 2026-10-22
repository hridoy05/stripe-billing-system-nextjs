import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

async function AlreadySignedIn() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-sm flex-col gap-6 rounded-xl bg-white p-8 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <Suspense fallback={null}>
          <AlreadySignedIn />
        </Suspense>
      </main>
    </div>
  );
}
