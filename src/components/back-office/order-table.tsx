import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderListRow } from "@/lib/types/order";
import { formatOrderNumber } from "@/lib/types/order";
import { StatusBadge } from "@/components/back-office/status-badge";

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function OrderTable({
  orders,
  emptyMessage = "No orders match your filters.",
}: {
  orders: OrderListRow[];
  emptyMessage?: string;
}) {
  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[100px] text-gray-600">Order</TableHead>
            <TableHead className="text-gray-600">Recipient</TableHead>
            <TableHead className="min-w-[200px] text-gray-600">Address</TableHead>
            <TableHead className="text-gray-600">Status</TableHead>
            <TableHead className="text-gray-600">Driver</TableHead>
            <TableHead className="text-right text-gray-600">Items</TableHead>
            <TableHead className="text-gray-600">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs font-medium">
                <Link
                  href={`/dashboard/orders/${row.id}`}
                  className="text-[#51836D] hover:underline"
                >
                  {formatOrderNumber(row.id)}
                </Link>
              </TableCell>
              <TableCell className="font-medium text-gray-900">
                <Link
                  href={`/dashboard/orders/${row.id}`}
                  className="hover:underline"
                >
                  {row.recipientName}
                </Link>
              </TableCell>
              <TableCell className="max-w-[280px] text-gray-600">
                {truncate(row.deliveryAddress, 64)}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-gray-700">
                {row.driverName ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-gray-700">
                {row.itemsCount}
              </TableCell>
              <TableCell className="whitespace-nowrap text-gray-600">
                {new Date(row.createdAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
