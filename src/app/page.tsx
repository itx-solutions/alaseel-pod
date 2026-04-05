import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Package } from "lucide-react";

export default async function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <main className="flex max-w-lg flex-col items-center gap-6 text-center">
        <Package
          className="size-12 text-zinc-800 dark:text-zinc-200"
          aria-hidden
        />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Alaseel PoD
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Proof of Deliver platform. Configure Clerk and Neon in{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
            .env.local
          </code>
          .
        </p>
        <div className="flex items-center gap-4">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </main>
    </div>
  );
}

