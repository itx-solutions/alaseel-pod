"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderDetailResponse } from "@/lib/types/order";
import type { ShopifyQueueDetailDto } from "@/lib/types/shopify";

const DISPLAY_LOCALE = "en-AU";
const DISPLAY_TZ = "Australia/Sydney";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  });
}

function queueStatusLabel(status: ShopifyQueueDetailDto["status"]): string {
  switch (status) {
    case "pending_review":
      return "Pending Review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function ShopifyQueueReviewClient({
  initial,
}: {
  initial: ShopifyQueueDetailDto;
}) {
  const router = useRouter();
  const [rejectNotes, setRejectNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = initial.status === "pending_review";

  async function approve() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/shopify-queue/${initial.id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as OrderDetailResponse | { error?: string };
      if (!res.ok) {
        setError(
          typeof (json as { error?: string }).error === "string"
            ? (json as { error: string }).error
            : "Could not approve",
        );
        return;
      }
      const detail = json as OrderDetailResponse;
      router.push(
        `/dashboard/orders/${detail.order.id}?shopify=approved`,
      );
      router.refresh();
    } catch {
      setError("Could not approve");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/shopify-queue/${initial.id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: rejectNotes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(
          typeof json.error === "string" ? json.error : "Could not reject",
        );
        return;
      }
      router.push("/dashboard/shopify-queue");
      router.refresh();
    } catch {
      setError("Could not reject");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            <Link
              href="/dashboard/shopify-queue"
              className="text-gray-600 underline-offset-2 hover:underline"
            >
              Shopify Orders
            </Link>
            <span className="mx-1.5 text-gray-400">/</span>
            <span className="font-mono text-gray-900">
              {initial.shopify_order_number}
            </span>
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Review Shopify order
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Status:{" "}
            <span className="font-medium text-gray-900">
              {queueStatusLabel(initial.status)}
            </span>
          </p>
        </div>
        {initial.created_order_id ? (
          <Button variant="outline" asChild>
            <Link href={`/dashboard/orders/${initial.created_order_id}`}>
              Open delivery order
            </Link>
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Delivery</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Recipient</dt>
              <dd className="font-medium text-gray-900">
                {initial.recipient_name}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900">{initial.recipient_phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{initial.recipient_email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Address</dt>
              <dd className="whitespace-pre-wrap text-gray-900">
                {initial.delivery_address}
              </dd>
            </div>
            {initial.notes &&
            initial.status !== "rejected" ? (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                role="region"
                aria-label="Delivery window"
              >
                <p className="font-medium text-amber-800">Delivery window</p>
                <p className="mt-1 whitespace-pre-wrap">{initial.notes}</p>
              </div>
            ) : null}
            <div>
              <dt className="text-gray-500">Order total</dt>
              <dd className="text-gray-900">{initial.order_total ?? "—"}</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Line items</h3>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {initial.items.map((line, i) => (
                <li
                  key={`${line.name}-${i}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-gray-900">{line.name}</span>
                  <span className="tabular-nums text-gray-700">
                    ×{line.quantity}
                    {line.variant_title ? (
                      <span className="ml-2 text-gray-500">
                        ({line.variant_title})
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Review</h2>
            {!pending ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Reviewed</dt>
                  <dd className="text-gray-900">
                    {initial.reviewed_at
                      ? formatDateTime(initial.reviewed_at)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Reviewer</dt>
                  <dd className="text-gray-900">
                    {initial.reviewer_name ?? "—"}
                  </dd>
                </div>
                {initial.notes ? (
                  <div>
                    <dt className="text-gray-500">Notes</dt>
                    <dd className="whitespace-pre-wrap text-gray-900">
                      {initial.notes}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reject-notes">Rejection notes (optional)</Label>
                  <Textarea
                    id="reject-notes"
                    placeholder="Reason if rejecting…"
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    rows={3}
                    className="resize-y"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    style={{ backgroundColor: "#51836D" }}
                    className="text-white hover:opacity-90"
                    disabled={busy}
                    onClick={() => void approve()}
                  >
                    Approve &amp; create order
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void reject()}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Raw webhook payload
            </h2>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-white p-3 text-xs text-gray-800 ring-1 ring-gray-200">
              {JSON.stringify(initial.raw_payload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
