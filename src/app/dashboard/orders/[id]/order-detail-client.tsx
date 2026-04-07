"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/back-office/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DriverPublicDto,
  DriversListResponse,
  OrderDetailResponse,
} from "@/lib/types/order";
import { formatOrderNumber } from "@/lib/types/order";

const PRIMARY = "#51836D";

/** Fixed locale + zone so SSR and browser Intl output match (avoids hydration mismatch). */
const DISPLAY_LOCALE = "en-AU";
const DISPLAY_TZ = "Australia/Sydney";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  });
}

function isOrderEditable(status: OrderDetailResponse["order"]["status"]) {
  return status === "pending" || status === "assigned";
}

export function OrderDetailClient({
  initial,
  locked,
}: {
  initial: OrderDetailResponse;
  locked: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [drivers, setDrivers] = useState<DriverPublicDto[]>([]);
  const [driverPick, setDriverPick] = useState<string>("__none__");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  useEffect(() => {
    fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json() as Promise<DriversListResponse>)
      .then((d) => setDrivers(d.drivers))
      .catch(() => {});
  }, []);

  const { order, delivery, driver, pod } = data;
  const editable = isOrderEditable(order.status);
  const showAssign =
    order.status === "pending" || order.status === "assigned";

  async function assign() {
    if (driverPick === "__none__") {
      setAssignError("Choose a driver.");
      return;
    }
    setAssignError(null);
    setAssigning(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/assign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverPick }),
      });
      const json = (await res.json()) as OrderDetailResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Assignment failed");
      setData(json);
      setDriverPick("__none__");
      router.refresh();
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-8">
      {locked ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          This order can no longer be edited while it is in the current
          delivery state.
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-gray-500">
            {formatOrderNumber(order.id)}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            {order.recipientName}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Created {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <Link
              href={`/dashboard/orders/${order.id}/edit`}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: PRIMARY }}
            >
              Edit order
            </Link>
          ) : null}
          <Button variant="outline" type="button" asChild>
            <Link href="/dashboard/orders">Back to list</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">Order</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={order.status} />
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Source</dt>
              <dd className="font-medium text-gray-900">{order.source}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900">{order.recipientPhone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{order.recipientEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Address</dt>
              <dd className="whitespace-pre-wrap text-gray-900">
                {order.deliveryAddress}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Instructions</dt>
              <dd className="whitespace-pre-wrap text-gray-900">
                {order.specialInstructions ?? "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900">
              Line items
            </h2>
            <ul className="mt-4 divide-y divide-gray-100 text-sm">
              {order.items.length === 0 ? (
                <li className="py-2 text-gray-500">No items</li>
              ) : (
                order.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between gap-4 py-2">
                    <span className="text-gray-900">{item.name}</span>
                    <span className="tabular-nums text-gray-600">
                      ×{item.quantity}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {showAssign ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900">Driver</h2>
              <p className="mt-1 text-sm text-gray-600">
                {driver
                  ? `Assigned: ${driver.name} (${driver.email})`
                  : "No driver assigned yet."}
              </p>
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label>Assign or reassign</Label>
                  <Select value={driverPick} onValueChange={setDriverPick}>
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select driver…</SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {assignError ? (
                  <p className="text-sm text-red-600">{assignError}</p>
                ) : null}
                <button
                  type="button"
                  disabled={assigning}
                  onClick={assign}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {assigning ? "Saving…" : "Save assignment"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900">Driver</h2>
              <p className="mt-2 text-sm text-gray-700">
                {driver
                  ? `${driver.name} — ${driver.email}`
                  : "No driver on this order."}
              </p>
            </div>
          )}

          {delivery ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900">
                Delivery
              </h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Delivery status</dt>
                  <dd>
                    <StatusBadge status={delivery.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Assigned at</dt>
                  <dd className="text-gray-900">
                    {formatDateTime(delivery.assignedAt)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          {pod ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900">POD</h2>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {pod.podType === "signed" && pod.signature_thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pod.signature_thumbnail_url}
                    alt=""
                    width={50}
                    height={50}
                    className="size-[50px] shrink-0 rounded border border-gray-200 bg-white object-contain"
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {pod.podType === "signed" ? (
                      <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Signed
                      </span>
                    ) : (
                      <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Unattended
                      </span>
                    )}
                    <span className="text-sm text-gray-600">
                      Submitted {formatDateTime(pod.submittedAt)}
                    </span>
                  </div>
                  {pod.podType === "signed" && pod.receiverName ? (
                    <p className="text-sm text-gray-900">
                      Receiver:{" "}
                      <span className="font-medium">{pod.receiverName}</span>
                    </p>
                  ) : null}
                  <p className="text-sm text-gray-600">
                    {pod.photo_count === 1
                      ? "1 photo"
                      : `${pod.photo_count} photos`}
                  </p>
                  <Button className="mt-1" variant="outline" asChild>
                    <Link href={`/dashboard/pods/${pod.id}`}>
                      View full POD
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
