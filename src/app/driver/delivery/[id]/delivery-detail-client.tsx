"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PodCapture } from "@/components/driver/pod-capture";
import { getMapsSearchUrl } from "@/lib/maps";
import type { DriverDeliveryRow } from "@/lib/types/delivery";
import { cn } from "@/lib/utils";

const MAZATI = "#51836D";

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

export function DeliveryDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [row, setRow] = useState<DriverDeliveryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/driver/deliveries/${id}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Error ${res.status}`);
        }
        const data = (await res.json()) as { delivery: DriverDeliveryRow };
        if (!cancelled) setRow(data.delivery);
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
  }, [id]);

  async function patchStart() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/driver/deliveries/${id}/start`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Could not start");
      }
      const data = (await res.json()) as { delivery: DriverDeliveryRow };
      setRow(data.delivery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchArrive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/driver/deliveries/${id}/arrive`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Could not mark arrived");
      }
      const data = (await res.json()) as { delivery: DriverDeliveryRow };
      setRow(data.delivery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-1/2 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="space-y-4">
        <p className="text-base text-red-600">{error ?? "Not found"}</p>
        <Link href="/driver" className="text-base text-[#51836D] underline">
          Back to Today&apos;s Run
        </Link>
      </div>
    );
  }

  const o = row.order;
  const mapUrl = getMapsSearchUrl(o.deliveryAddress);
  const phone = o.recipientPhone?.replace(/\s/g, "") ?? "";
  const showStart = row.status === "assigned";
  const showArrive =
    row.status === "in_transit" && !row.arrivedAt;
  const showPod =
    row.arrivedAt != null &&
    row.status === "in_transit";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-gray-200 bg-white"
          onClick={() => router.push("/driver")}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-gray-900">
            {o.recipientName}
          </h1>
          <StatusBadge status={row.status} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-base font-medium text-gray-900">{o.recipientName}</p>
        {o.recipientPhone ? (
          <a
            href={`tel:${phone}`}
            className="mt-1 block text-base text-[#51836D] underline"
          >
            {o.recipientPhone}
          </a>
        ) : null}
        <p className="mt-2 text-base text-gray-800">{o.deliveryAddress}</p>
        <ul className="mt-3 space-y-1">
          {o.items.map((it, idx) => (
            <li key={idx} className="text-base text-gray-700">
              {it.name}{" "}
              <span className="tabular-nums text-gray-500">×{it.quantity}</span>
            </li>
          ))}
        </ul>
        {o.specialInstructions ? (
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm text-gray-700">
            {o.specialInstructions}
          </div>
        ) : null}
      </div>

      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-base font-medium text-white"
        style={{ backgroundColor: MAZATI }}
      >
        Open in Maps
      </a>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {showStart ? (
        <button
          type="button"
          disabled={busy}
          className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-base font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: MAZATI }}
          onClick={() => void patchStart()}
        >
          {busy ? "Please wait…" : "Start delivery"}
        </button>
      ) : null}

      {showArrive ? (
        <button
          type="button"
          disabled={busy}
          className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-base font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: MAZATI }}
          onClick={() => void patchArrive()}
        >
          {busy ? "Please wait…" : "I've arrived"}
        </button>
      ) : null}

      {showPod ? (
        <PodCapture
          deliveryId={id}
          recipientLabel={o.recipientName}
          addressLabel={o.deliveryAddress}
        />
      ) : null}
    </div>
  );
}
