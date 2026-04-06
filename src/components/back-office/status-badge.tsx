import type { DeliveryStatus, OrderStatus } from "@/lib/types/order";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<OrderStatus | DeliveryStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  assigned: "bg-blue-100 text-blue-700",
  in_transit: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  attempted: "bg-orange-100 text-orange-700",
};

const STATUS_LABEL: Record<OrderStatus | DeliveryStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_transit: "In transit",
  completed: "Completed",
  attempted: "Attempted",
};

export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatus | DeliveryStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border border-transparent px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
