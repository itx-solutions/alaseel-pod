import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/back-office/dashboard-shell";
import { ensureUserRecord } from "@/lib/auth";
import { countPendingShopifyQueue } from "@/lib/data/shopify-queue";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUserRecord();
  if (user.role !== "back_office") {
    redirect("/driver");
  }
  const shopifyPendingCount = await countPendingShopifyQueue();
  return (
    <DashboardShell shopifyPendingCount={shopifyPendingCount}>
      {children}
    </DashboardShell>
  );
}
