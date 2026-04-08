"use client";

import { UserButton } from "@clerk/nextjs";
import { CheckCircle2, ListOrdered, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onRun = pathname === "/driver" || pathname === "/driver/";
  const onCompleted = pathname.startsWith("/driver/completed");
  const onProfile = pathname.startsWith("/driver/profile");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
        <span className="text-base font-semibold text-gray-900">Mazati POD</span>
        <UserButton />
      </header>

      <main className="flex-1 px-4 py-4 pb-28">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 bg-white px-2 py-2"
        aria-label="Driver navigation"
      >
        <Link
          href="/driver"
          className={cn(
            "flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-gray-600 transition-colors",
            onRun && "bg-gray-100 text-gray-900",
          )}
          style={onRun ? { boxShadow: `inset 0 0 0 1px #51836D` } : undefined}
        >
          <ListOrdered className="size-6 shrink-0 text-gray-700" aria-hidden />
          <span className="text-center text-xs font-medium leading-tight">
            Today&apos;s Run
          </span>
        </Link>
        <Link
          href="/driver/completed"
          className={cn(
            "flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-gray-600 transition-colors",
            onCompleted && "bg-gray-100 text-gray-900",
          )}
          style={onCompleted ? { boxShadow: `inset 0 0 0 1px #51836D` } : undefined}
        >
          <CheckCircle2 className="size-6 shrink-0 text-gray-700" aria-hidden />
          <span className="text-center text-xs font-medium leading-tight">
            Completed
          </span>
        </Link>
        <Link
          href="/driver/profile"
          className={cn(
            "flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-gray-600 transition-colors",
            onProfile && "bg-gray-100 text-gray-900",
          )}
          style={onProfile ? { boxShadow: `inset 0 0 0 1px #51836D` } : undefined}
        >
          <User className="size-6 shrink-0 text-gray-700" aria-hidden />
          <span className="text-center text-xs font-medium leading-tight">
            Profile
          </span>
        </Link>
      </nav>
    </div>
  );
}
