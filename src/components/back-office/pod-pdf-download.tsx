"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PodDetailResponse } from "@/lib/types/pod";

const DISPLAY_LOCALE = "en-AU";
const DISPLAY_TZ = "Australia/Sydney";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  });
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "POD";
}

function dateForFile(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

type Props = { detail: PodDetailResponse };

export function PodPdfDownload({ detail }: Props) {
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    const el = printRef.current;
    if (!el) return;
    setBusy(true);
    try {
      await Promise.all(
        Array.from(el.querySelectorAll("img")).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }),
      );

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const ratio = canvas.width / canvas.height;
      let drawW = maxW;
      let drawH = drawW / ratio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * ratio;
      }
      pdf.addImage(imgData, "PNG", margin, margin, drawW, drawH);

      const recipient = sanitizeFileName(detail.order.recipient_name);
      const date = dateForFile(detail.pod.submitted_at);
      pdf.save(`POD-${recipient}-${date}.pdf`);
    } finally {
      setBusy(false);
    }
  }, [detail]);

  const photos = detail.photo_signed_urls.slice(0, 4);
  const mapsUrl =
    detail.pod.gps_lat != null && detail.pod.gps_lng != null
      ? `https://maps.google.com/?q=${detail.pod.gps_lat},${detail.pod.gps_lng}`
      : null;

  return (
    <>
      <Button
        type="button"
        style={{ backgroundColor: "#51836D" }}
        className="text-white hover:opacity-90"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "Generating…" : "Download PDF"}
      </Button>

      <div
        ref={printRef}
        className="pointer-events-none fixed left-0 top-0 z-[-1] w-[794px] bg-white p-8 text-gray-900"
        aria-hidden
      >
        <h1 className="text-center text-lg font-bold text-gray-900">
          Proof of Delivery — Mazati / Al Aseel Food Services
        </h1>
        <div className="mt-6 space-y-2 text-sm">
          <p>
            <span className="font-semibold">Recipient:</span>{" "}
            {detail.order.recipient_name}
          </p>
          <p>
            <span className="font-semibold">Address:</span>{" "}
            {detail.order.delivery_address}
          </p>
          <p>
            <span className="font-semibold">Date / time:</span>{" "}
            {formatDateTime(detail.pod.submitted_at)}
          </p>
          <p>
            <span className="font-semibold">Driver:</span> {detail.driver_name}
          </p>
          <p>
            <span className="font-semibold">POD type:</span>{" "}
            {detail.pod.pod_type === "signed" ? "Signed" : "Unattended"}
          </p>
          {detail.pod.pod_type === "signed" && detail.pod.receiver_name ? (
            <p>
              <span className="font-semibold">Receiver name (typed):</span>{" "}
              {detail.pod.receiver_name}
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold">Items delivered</p>
            <ul className="mt-1 list-inside list-disc text-sm">
            {detail.order.items.map((line, idx) => (
              <li key={`${idx}-${line.name}-${line.quantity}`}>
                {line.name} × {line.quantity}
              </li>
            ))}
          </ul>
        </div>

        {detail.pod.pod_type === "signed" && detail.signature_signed_url ? (
          <div className="mt-6">
            <p className="text-sm font-semibold">Signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL for PDF capture */}
            <img
              src={detail.signature_signed_url}
              alt=""
              crossOrigin="anonymous"
              className="mt-2 max-h-60 max-w-full border border-gray-200 object-contain"
            />
          </div>
        ) : null}

        {detail.pod.pod_type === "unattended" && detail.delivery.notes ? (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span className="font-semibold">Notes:</span> {detail.delivery.notes}
          </div>
        ) : null}

        {photos.length > 0 ? (
          <div className="mt-6">
            <p className="text-sm font-semibold">Photos (up to 4)</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL for PDF capture
                <img
                  key={p.id}
                  src={p.url}
                  alt=""
                  crossOrigin="anonymous"
                  className="h-40 w-full border border-gray-200 object-cover"
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 text-sm">
          <p className="font-semibold">Location</p>
          {detail.pod.gps_lat != null && detail.pod.gps_lng != null ? (
            <p>
              Lat: {detail.pod.gps_lat} · Lng: {detail.pod.gps_lng}
              {mapsUrl ? (
                <>
                  {" "}
                  — {mapsUrl}
                </>
              ) : null}
            </p>
          ) : (
            <p>Location not captured</p>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          Generated by alaseel-pod · pod.mazati.au
        </p>
      </div>
    </>
  );
}
