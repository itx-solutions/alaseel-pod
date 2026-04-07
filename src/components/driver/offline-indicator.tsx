"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sync = () => {
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!offline) setDismissed(false);
  }, [offline]);

  if (!offline || dismissed) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950",
      )}
      role="status"
    >
      <span>
        You&apos;re offline — deliveries will sync when connected
      </span>
      <button
        type="button"
        className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-md p-2 text-amber-900 hover:bg-amber-100"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
