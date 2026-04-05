import { redirect } from "next/navigation";
import { ensureUserRecord } from "@/lib/auth";
import { DriverShell } from "@/components/driver/driver-shell";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUserRecord();
  if (user.role !== "driver") {
    redirect("/dashboard");
  }
  return <DriverShell>{children}</DriverShell>;
}
