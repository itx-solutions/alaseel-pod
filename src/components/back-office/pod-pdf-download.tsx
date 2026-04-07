"use client";

import { jsPDF } from "jspdf";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PodDetailResponse, PodImagesPdfResponse } from "@/lib/types/pod";

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
  return (
    name
      .replace(/[^a-zA-Z0-9\-_.]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "POD"
  );
}

function dateForFile(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function detectImageFormat(
  dataUrl: string,
): "PNG" | "JPEG" | "WEBP" | "GIF" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (
    dataUrl.startsWith("data:image/jpeg") ||
    dataUrl.startsWith("data:image/jpg")
  )
    return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  if (dataUrl.startsWith("data:image/gif")) return "GIF";
  return "JPEG";
}

type Props = { detail: PodDetailResponse };

export function PodPdfDownload({ detail }: Props) {
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/pods/${detail.pod.id}/images`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string"
            ? err.error
            : `Failed to load images (${res.status})`,
        );
      }
      const images = (await res.json()) as PodImagesPdfResponse;

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const left = margin;
      const maxW = pageW - margin * 2;
      let y = margin;
      const lineGap = 5;

      const ensureSpace = (neededMm: number) => {
        if (y + neededMm > pageH - margin - 12) {
          pdf.addPage();
          y = margin;
        }
      };

      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      const titleLines = pdf.splitTextToSize(
        "Proof of Delivery — Mazati / Al Aseel Food Services",
        maxW,
      );
      for (const tl of titleLines) {
        ensureSpace(lineGap);
        pdf.text(tl, left, y);
        y += lineGap;
      }
      y += 4;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);

      const textBlocks: string[] = [
        `Recipient: ${detail.order.recipient_name}`,
        `Address: ${detail.order.delivery_address}`,
        `Date / time: ${formatDateTime(detail.pod.submitted_at)}`,
        `Driver: ${detail.driver_name}`,
        `POD type: ${detail.pod.pod_type === "signed" ? "Signed" : "Unattended"}`,
      ];
      if (detail.pod.pod_type === "signed" && detail.pod.receiver_name) {
        textBlocks.push(`Receiver name: ${detail.pod.receiver_name}`);
      }

      for (const block of textBlocks) {
        const lines = pdf.splitTextToSize(block, maxW);
        for (const line of lines) {
          ensureSpace(lineGap);
          pdf.text(line, left, y);
          y += lineGap * 0.85;
        }
        y += 2;
      }

      pdf.setFont("helvetica", "bold");
      ensureSpace(lineGap + 2);
      pdf.text("Items delivered", left, y);
      y += lineGap + 1;
      pdf.setFont("helvetica", "normal");
      for (const item of detail.order.items) {
        const lines = pdf.splitTextToSize(
          `${item.name} × ${item.quantity}`,
          maxW,
        );
        for (const line of lines) {
          ensureSpace(lineGap);
          pdf.text(line, left, y);
          y += lineGap * 0.85;
        }
      }
      y += 4;

      if (detail.pod.pod_type === "unattended" && detail.delivery.notes) {
        const lines = pdf.splitTextToSize(
          `Notes: ${detail.delivery.notes}`,
          maxW,
        );
        for (const line of lines) {
          ensureSpace(lineGap);
          pdf.text(line, left, y);
          y += lineGap * 0.85;
        }
        y += 4;
      }

      if (detail.pod.pod_type === "signed" && images.signature) {
        pdf.setFont("helvetica", "bold");
        ensureSpace(lineGap);
        pdf.text("Signature", left, y);
        y += lineGap;
        pdf.setFont("helvetica", "normal");
        const fmt = detectImageFormat(images.signature);
        const props = pdf.getImageProperties(images.signature);
        const imgMaxW = maxW;
        let drawW = imgMaxW;
        let drawH = (props.height * drawW) / props.width;
        const maxSigH = 55;
        if (drawH > maxSigH) {
          drawH = maxSigH;
          drawW = (props.width * drawH) / props.height;
        }
        ensureSpace(drawH + 4);
        pdf.addImage(images.signature, fmt, left, y, drawW, drawH);
        y += drawH + 6;
      }

      const gridPhotos = images.photos.slice(0, 4);
      if (gridPhotos.length > 0) {
        pdf.setFont("helvetica", "bold");
        ensureSpace(8);
        pdf.text("Delivery photos", left, y);
        y += 8;
        pdf.setFont("helvetica", "normal");

        const gap = 4;
        const cellW = (maxW - gap) / 2;
        const maxCellH = 48;
        let cursorY = y;

        for (let row = 0; row < 2; row++) {
          if (row * 2 >= gridPhotos.length) break;
          ensureSpace(maxCellH + gap + 4);
          const rowY = cursorY;
          for (let col = 0; col < 2; col++) {
            const idx = row * 2 + col;
            if (idx >= gridPhotos.length) break;
            const dataUrl = gridPhotos[idx]!;
            const fmt = detectImageFormat(dataUrl);
            const props = pdf.getImageProperties(dataUrl);
            let w = cellW;
            let h = (props.height * w) / props.width;
            if (h > maxCellH) {
              h = maxCellH;
              w = (props.width * h) / props.height;
            }
            const x = left + col * (cellW + gap);
            pdf.addImage(dataUrl, fmt, x, rowY, w, h);
          }
          cursorY = rowY + maxCellH + gap;
        }
        y = cursorY + 4;
      }

      pdf.setFont("helvetica", "bold");
      ensureSpace(lineGap);
      pdf.text("Location", left, y);
      y += lineGap;
      pdf.setFont("helvetica", "normal");
      if (detail.pod.gps_lat != null && detail.pod.gps_lng != null) {
        const mapsUrl = `https://maps.google.com/?q=${detail.pod.gps_lat},${detail.pod.gps_lng}`;
        const locLines = pdf.splitTextToSize(
          `Lat: ${detail.pod.gps_lat} · Lng: ${detail.pod.gps_lng}\n${mapsUrl}`,
          maxW,
        );
        for (const line of locLines) {
          ensureSpace(lineGap);
          pdf.text(line, left, y);
          y += lineGap * 0.85;
        }
      } else {
        ensureSpace(lineGap);
        pdf.text("Location not captured", left, y);
        y += lineGap;
      }

      ensureSpace(18);
      pdf.setFontSize(8);
      pdf.setTextColor(90, 90, 90);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        "Generated by alaseel-pod · pod.mazati.au",
        pageW / 2,
        pageH - 10,
        { align: "center" },
      );

      const recipient = sanitizeFileName(detail.order.recipient_name);
      const date = dateForFile(detail.pod.submitted_at);
      pdf.save(`POD-${recipient}-${date}.pdf`);
    } finally {
      setBusy(false);
    }
  }, [detail]);

  return (
    <Button
      type="button"
      style={{ backgroundColor: "#51836D" }}
      className="text-white hover:opacity-90"
      disabled={busy}
      onClick={() => void run()}
    >
      {busy ? "Generating…" : "Download PDF"}
    </Button>
  );
}
