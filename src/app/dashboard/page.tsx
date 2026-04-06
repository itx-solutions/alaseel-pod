import Link from "next/link";
import { Package } from "lucide-react";
import { StatsCard } from "@/components/back-office/stats-card";
import { getDashboardStatsData } from "@/lib/data/orders";

const PRIMARY = "#51836D";

export default async function DashboardHomePage() {
  const stats = await getDashboardStatsData();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Today&apos;s delivery overview (UTC).
          </p>
        </div>
        <Link
          href="/dashboard/orders/new"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          <Package className="mr-2 size-4" aria-hidden />
          New order
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Orders today"
          value={stats.total_today}
          description="Created today (UTC)"
        />
        <StatsCard
          title="Completed today"
          value={stats.completed_today}
          description="Deliveries completed today"
        />
        <StatsCard
          title="In transit"
          value={stats.in_transit}
          description="Orders currently out for delivery"
        />
        <StatsCard
          title="Pending assignment"
          value={stats.pending_assignment}
          description="Awaiting a driver"
        />
      </div>
    </div>
  );
}
