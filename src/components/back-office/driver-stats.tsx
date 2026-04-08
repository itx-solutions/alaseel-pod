import type { DriverDeliveryStats } from "@/lib/types/driver";

function rateLabel(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate}%`;
}

export function DriverStats({
  stats,
  compact = false,
}: {
  stats: DriverDeliveryStats;
  /** Single line for table cells; grid for detail card */
  compact?: boolean;
}) {
  const {
    totalDeliveries,
    completedDeliveries,
    attemptedDeliveries,
    completionRate,
  } = stats;

  if (compact) {
    return (
      <p className="text-xs leading-relaxed text-gray-600">
        <span className="text-gray-500">Total</span>{" "}
        <span className="tabular-nums text-gray-900">{totalDeliveries}</span>
        {" · "}
        <span className="text-gray-500">Done</span>{" "}
        <span className="tabular-nums text-gray-900">{completedDeliveries}</span>
        {" · "}
        <span className="text-gray-500">Attempted</span>{" "}
        <span className="tabular-nums text-gray-900">{attemptedDeliveries}</span>
        {" · "}
        <span className="text-gray-500">Rate</span>{" "}
        <span className="tabular-nums text-gray-900">
          {rateLabel(completionRate)}
        </span>
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Total deliveries
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
          {totalDeliveries}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Completed
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
          {completedDeliveries}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Attempted
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
          {attemptedDeliveries}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Completion rate
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
          {rateLabel(completionRate)}
        </p>
      </div>
    </div>
  );
}
