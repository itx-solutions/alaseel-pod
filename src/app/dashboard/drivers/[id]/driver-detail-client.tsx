"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DriverStats } from "@/components/back-office/driver-stats";
import { StatusBadge } from "@/components/back-office/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DriverDetailView } from "@/lib/types/driver";
import { formatOrderNumber } from "@/lib/types/order";
import { cn } from "@/lib/utils";

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-gray-200 bg-gray-100 text-gray-600",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function DriverDetailClient({
  initial,
}: {
  initial: DriverDetailView;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [localActive, setLocalActive] = useState(initial.isActive);

  useEffect(() => {
    setLocalActive(initial.isActive);
  }, [initial.isActive]);

  async function patchDeactivate() {
    setPending(true);
    try {
      const res = await fetch(`/api/drivers/${initial.id}/deactivate`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof err.error === "string" ? err.error : `Error ${res.status}`,
        );
      }
      setLocalActive(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function patchReactivate() {
    setPending(true);
    try {
      const res = await fetch(`/api/drivers/${initial.id}/reactivate`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof err.error === "string" ? err.error : `Error ${res.status}`,
        );
      }
      setLocalActive(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function confirmDeactivate() {
    const ok = window.confirm(
      `Are you sure you want to deactivate ${initial.name}? They will no longer be able to sign in.`,
    );
    if (!ok) return;
    void patchDeactivate();
  }

  const created = new Date(initial.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/drivers"
          className="text-sm font-medium text-[#51836D] hover:underline"
        >
          ← Back to Drivers
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{initial.name}</h1>
            <ActiveBadge active={localActive} />
          </div>
        </div>
        <div className="shrink-0">
          {localActive ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={confirmDeactivate}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              onClick={() => void patchReactivate()}
            >
              Reactivate
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="font-medium text-gray-900">{initial.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{initial.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Account created</dt>
            <dd className="text-gray-900">{created}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd>
              <ActiveBadge active={localActive} />
            </dd>
          </div>
        </dl>

        <div className="mt-8 border-t border-gray-100 pt-6">
          <h3 className="text-sm font-semibold text-gray-900">
            Delivery performance
          </h3>
          <div className="mt-4">
            <DriverStats stats={initial.stats} />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Recent deliveries
        </h2>
        {initial.recentDeliveries.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600">
            No deliveries yet
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-600">Order #</TableHead>
                  <TableHead className="text-gray-600">Recipient</TableHead>
                  <TableHead className="min-w-[200px] text-gray-600">
                    Address
                  </TableHead>
                  <TableHead className="text-gray-600">Status</TableHead>
                  <TableHead className="text-gray-600">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.recentDeliveries.map((row) => (
                  <TableRow key={row.deliveryId}>
                    <TableCell className="font-mono text-xs font-medium">
                      <Link
                        href={`/dashboard/orders/${row.orderId}`}
                        className="text-[#51836D] hover:underline"
                      >
                        {formatOrderNumber(row.orderId)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">
                      <Link
                        href={`/dashboard/orders/${row.orderId}`}
                        className="hover:underline"
                      >
                        {row.recipientName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[280px] text-gray-600">
                      {row.deliveryAddress.length > 64
                        ? `${row.deliveryAddress.slice(0, 64)}…`
                        : row.deliveryAddress}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-600">
                      {new Date(row.displayAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
