import { redirect } from "next/navigation";
import { ensureUserRecord } from "@/lib/auth";
import { DashboardShell } from "@/components/back-office/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUserRecord();
  if (user.role !== "back_office") {
    redirect("/driver");
  }
  return <DashboardShell>{children}</DashboardShell>;
}
