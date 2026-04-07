"use client";

import { useEffect, useState } from "react";
import type { CompletedDeliveryRow } from "@/lib/types/delivery";
import type { DriverCompletedListResponse } from "@/lib/types/delivery";
import { cn } from "@/lib/utils";

export function DriverCompletedClient() {
  const [rows, setRows] = useState<CompletedDeliveryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/driver/deliveries/completed", {
          credentials: "include",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Error ${res.status}`);
        }
        const data = (await res.json()) as DriverCompletedListResponse;
        if (!cancelled) setRows(data.deliveries);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="h-5 w-1/2 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-full rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-base text-red-600" role="alert">
        {error}
      </p>
    );
  }

  if (!rows?.length) {
    return (
      <p className="text-center text-base text-gray-600">
        No completed deliveries yet
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Completed</h1>
      {rows.map((d) => (
        <div
          key={d.deliveryId}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex gap-3">
            {d.photos[0]?.signedUrl ? (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.photos[0].signedUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900">{d.recipientName}</p>
              <p className="text-sm text-gray-600">{d.deliveryAddress}</p>
              <p className="mt-1 text-xs text-gray-500">
                {new Date(d.completedAt).toLocaleString()}
              </p>
              <span
                className={cn(
                  "mt-2 inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                  d.podType === "signed"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-orange-50 text-orange-800",
                )}
              >
                {d.podType === "signed" ? "Signed" : "Unattended"}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
