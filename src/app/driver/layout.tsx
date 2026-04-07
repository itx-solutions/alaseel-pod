import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { DriverEffects } from "@/components/driver/driver-effects";
import { DriverShell } from "@/components/driver/driver-shell";
import { OfflineIndicator } from "@/components/driver/offline-indicator";
import { ensureUserRecord } from "@/lib/auth";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mazati POD",
  },
};

export const viewport: Viewport = {
  themeColor: "#51836D",
};

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUserRecord();
  if (user.role !== "driver") {
    redirect("/dashboard");
  }
  return (
    <>
      <DriverEffects />
      <OfflineIndicator />
      <DriverShell>{children}</DriverShell>
    </>
  );
}
