"use client";

import Link from "next/link";
import { useState } from "react";
import { PodPdfDownload } from "@/components/back-office/pod-pdf-download";
import { Button } from "@/components/ui/button";
import type { PodDetailResponse } from "@/lib/types/pod";
import { formatOrderNumber } from "@/lib/types/order";

const DISPLAY_LOCALE = "en-AU";
const DISPLAY_TZ = "Australia/Sydney";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  });
}

export function PodDetailClient({ initial }: { initial: PodDetailResponse }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [sigError, setSigError] = useState(false);

  const d = initial;
  const mapsUrl =
    d.pod.gps_lat != null && d.pod.gps_lng != null
      ? `https://maps.google.com/?q=${d.pod.gps_lat},${d.pod.gps_lng}`
      : null;

  return (
    <div className="space-y-8">
      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Close photo"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/pods"
            className="text-sm font-medium text-[#51836D] hover:underline"
          >
            Back to POD Records
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            {d.order.recipient_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {d.pod.pod_type === "signed" ? (
              <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Signed
              </span>
            ) : (
              <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Unattended
              </span>
            )}
            <span className="text-sm text-gray-600">
              Submitted {formatDateTime(d.pod.submitted_at)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PodPdfDownload detail={d} />
          <Button variant="outline" asChild>
            <Link href={`/dashboard/orders/${d.order.id}`}>Back to order</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">
            Delivery details
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Recipient</dt>
              <dd className="font-medium text-gray-900">{d.order.recipient_name}</dd>
            </div>
            {d.order.recipient_phone ? (
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd>
                  <a
                    href={`tel:${d.order.recipient_phone}`}
                    className="text-[#51836D] hover:underline"
                  >
                    {d.order.recipient_phone}
                  </a>
                </dd>
              </div>
            ) : null}
            {d.order.recipient_email ? (
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd>
                  <a
                    href={`mailto:${d.order.recipient_email}`}
                    className="text-[#51836D] hover:underline"
                  >
                    {d.order.recipient_email}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-gray-500">Address</dt>
              <dd className="text-gray-900">{d.order.delivery_address}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Items delivered</dt>
              <dd>
                <ul className="mt-1 list-inside list-disc space-y-1 text-gray-900">
                  {d.order.items.map((line) => (
                    <li key={`${line.name}-${line.quantity}`}>
                      {line.name} × {line.quantity}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            {d.order.special_instructions ? (
              <div>
                <dt className="text-gray-500">Special instructions</dt>
                <dd className="text-gray-900">{d.order.special_instructions}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-gray-500">Driver</dt>
              <dd className="text-gray-900">{d.driver_name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Order</dt>
              <dd>
                <Link
                  href={`/dashboard/orders/${d.order.id}`}
                  className="font-mono text-sm text-[#51836D] hover:underline"
                >
                  {formatOrderNumber(d.order.id)}
                </Link>
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">POD evidence</h2>
          {d.pod.pod_type === "signed" ? (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm text-gray-500">Receiver name</p>
                <p className="text-sm font-medium text-gray-900">
                  {d.pod.receiver_name ?? "—"}
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-900">
                  Signature
                </p>
                <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
                  {d.signature_signed_url && !sigError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.signature_signed_url}
                      alt="Signature"
                      className="h-auto w-full max-h-64 object-contain"
                      onError={() => setSigError(true)}
                    />
                  ) : (
                    <p className="p-8 text-center text-sm text-gray-500">
                      Signature unavailable
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Unattended delivery — no signature was captured.
              </div>
              {d.delivery.notes ? (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm text-gray-900">{d.delivery.notes}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold text-gray-900">
          Delivery photos
        </h2>
        {d.photo_signed_urls.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No photos captured</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {d.photo_signed_urls.map((p) => (
              <button
                key={p.id}
                type="button"
                className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#51836D] focus:ring-offset-2"
                onClick={() => setLightbox(p.url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">Location</h2>
        {d.pod.gps_lat != null && d.pod.gps_lng != null ? (
          <div className="mt-2 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:gap-4">
            <span>
              Lat: {d.pod.gps_lat} · Lng: {d.pod.gps_lng}
            </span>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#51836D] hover:underline"
              >
                View on Google Maps
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">Location not captured</p>
        )}
      </section>
    </div>
  );
}
