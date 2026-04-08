import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Past time relative to now (e.g. "3 days ago"). */
export function formatRelativePast(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso).getTime();
  const now = Date.now();
  let diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 0) diffSec = 0;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (diffSec < 60) return rtf.format(-diffSec, "second");
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  const years = Math.floor(months / 12);
  return rtf.format(-years, "year");
}
