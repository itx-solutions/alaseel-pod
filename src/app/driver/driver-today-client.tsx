"use client";

import { Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  loadDriverDeliveriesCache,
  saveDriverDeliveriesCache,
} from "@/lib/offline-queue";
import { getMapsSearchUrl } from "@/lib/maps";
import type { DriverDeliveryRow } from "@/lib/types/delivery";
import type { DriverDeliveriesListResponse } from "@/lib/types/delivery";
import { cn } from "@/lib/utils";

const MAZATI = "#51836D";

function itemsSummary(items: DriverDeliveryRow["order"]["items"]): string {
  const n = items.reduce((s, i) => s + i.quantity, 0);
  if (items.length === 0) return "No items";
  if (items.length === 1) return `${n} item${n === 1 ? "" : "s"}`;
  return `${items[0].name} and ${items.length - 1} more`;
}

function StatusBadge({ status }: { status: DriverDeliveryRow["status"] }) {
  const label =
    status === "assigned"
      ? "Assigned"
      : status === "in_transit"
        ? "In transit"
        : status;
  const cls =
    status === "assigned"
      ? "bg-gray-100 text-gray-600"
      : "bg-amber-100 text-amber-800";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border border-transparent px-2 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {label}
    </span>
  );
}

export function DriverTodayClient() {
  const router = useRouter();
  const [rows, setRows] = useState<DriverDeliveryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const cached = await loadDriverDeliveriesCache();
        if (!cancelled && cached?.deliveries?.length) {
          setRows(cached.deliveries);
        }
        const res = await fetch("/api/driver/deliveries", {
          credentials: "include",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Error ${res.status}`);
        }
        const data = (await res.json()) as DriverDeliveriesListResponse;
        if (!cancelled) {
          setRows(data.deliveries);
          await saveDriverDeliveriesCache(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startDelivery(id: string) {
    const res = await fetch(`/api/driver/deliveries/${id}/start`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? "Could not start");
    }
    router.push(`/driver/delivery/${id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Today&apos;s deliveries</h1>
        {rows !== null ? (
          <span
            className="rounded-full px-2 py-0.5 text-sm font-medium text-white"
            style={{ backgroundColor: MAZATI }}
          >
            {rows.length}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading && rows === null ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="h-5 w-2/3 rounded bg-gray-200" />
              <div className="mt-3 h-4 w-full rounded bg-gray-100" />
              <div className="mt-2 h-4 w-5/6 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && rows?.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <Package className="size-12 text-gray-400" aria-hidden />
          <p className="text-base text-gray-600">
            No deliveries assigned for today
          </p>
        </div>
      ) : null}

      {rows?.map((d) => {
        const mapUrl = getMapsSearchUrl(d.order.deliveryAddress);
        return (
          <div
            key={d.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-bold text-gray-900">
                {d.order.recipientName}
              </p>
              <StatusBadge status={d.status} />
            </div>
            <p className="mt-1 text-sm text-gray-700">{d.order.deliveryAddress}</p>
            <p className="mt-2 text-sm text-gray-600">{itemsSummary(d.order.items)}</p>
            {d.order.specialInstructions ? (
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm text-gray-700">
                {d.order.specialInstructions}
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-lg border border-gray-300 px-4 text-center text-base font-medium text-gray-800"
              >
                Navigate
              </a>
              {d.status === "assigned" ? (
                <button
                  type="button"
                  className="inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-lg px-4 text-base font-medium text-white"
                  style={{ backgroundColor: MAZATI }}
                  onClick={() => void startDelivery(d.id)}
                >
                  Start delivery
                </button>
              ) : (
                <Link
                  href={`/driver/delivery/${d.id}`}
                  className="inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-lg px-4 text-base font-medium text-white"
                  style={{ backgroundColor: MAZATI }}
                >
                  Continue
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
