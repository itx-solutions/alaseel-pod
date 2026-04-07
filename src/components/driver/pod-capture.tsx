"use client";

import { CheckCircle2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  queuePodSubmission,
  type QueuedPod,
} from "@/lib/offline-queue";
import { cn } from "@/lib/utils";
const MAZATI = "#51836D";

type Props = {
  deliveryId: string;
  recipientLabel: string;
  addressLabel: string;
};

export function PodCapture({ deliveryId, recipientLabel, addressLabel }: Props) {
  const router = useRouter();
  const [unattended, setUnattended] = useState(false);
  const [signedStep, setSignedStep] = useState<1 | 2 | 3>(1);

  const [receiverName, setReceiverName] = useState("");
  const [notes, setNotes] = useState("");
  const [gpsLat, setGpsLat] = useState<number | undefined>();
  const [gpsLng, setGpsLng] = useState<number | undefined>();

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [doneAt] = useState(() => new Date());

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [photoPreviews]);

  const getCtx = () => canvasRef.current?.getContext("2d");

  const startDraw = (x: number, y: number) => {
    drawingRef.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveDraw = (x: number, y: number) => {
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    startDraw(e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    moveDraw(e.clientX - rect.left, e.clientY - rect.top);
  };

  const clearCanvas = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) {
      ctx.clearRect(0, 0, c.width, c.height);
    }
    setHasSignature(false);
  };

  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next: File[] = [...photoFiles];
    const previews: string[] = [...photoPreviews];
    for (let i = 0; i < files.length; i++) {
      if (next.length >= 5) break;
      const f = files[i];
      if (!f.type.startsWith("image/")) continue;
      next.push(f);
      previews.push(URL.createObjectURL(f));
    }
    setPhotoFiles(next);
    setPhotoPreviews(previews);
  };

  const removePhoto = (index: number) => {
    const url = photoPreviews[index];
    if (url) URL.revokeObjectURL(url);
    setPhotoFiles((p) => p.filter((_, i) => i !== index));
    setPhotoPreviews((p) => p.filter((_, i) => i !== index));
  };

  const filesToDataUrls = useCallback(async (files: File[]): Promise<string[]> => {
    const out: string[] = [];
    for (const f of files) {
      const buf = await f.arrayBuffer();
      const b64 = btoa(
        new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""),
      );
      out.push(`data:${f.type || "image/jpeg"};base64,${b64}`);
    }
    return out;
  }, []);

  const submitSigned = async () => {
    setError(null);
    setSubmitting(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      setSubmitting(false);
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) {
      setError("Could not read signature");
      setSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.set("pod_type", "signed");
    fd.set("receiver_name", receiverName.trim());
    fd.set("signature", blob, "signature.png");
    if (gpsLat != null) fd.set("gps_lat", String(gpsLat));
    if (gpsLng != null) fd.set("gps_lng", String(gpsLng));
    if (notes.trim()) fd.set("notes", notes.trim());
    photoFiles.forEach((f) => fd.append("photos", f));

    const offline =
      typeof navigator !== "undefined" && !navigator.onLine;

    if (offline) {
      const sigDataUrl = canvas.toDataURL("image/png");
      const photoDataUrls = await filesToDataUrls(photoFiles);
      const q: QueuedPod = {
        id: crypto.randomUUID(),
        deliveryId,
        podType: "signed",
        receiverName: receiverName.trim(),
        signatureDataUrl: sigDataUrl,
        photoDataUrls,
        gpsLat,
        gpsLng,
        notes: notes.trim() || undefined,
        queuedAt: new Date().toISOString(),
      };
      await queuePodSubmission(q);
      setDone(true);
      setSubmitting(false);
      window.setTimeout(() => router.push("/driver"), 2000);
      return;
    }

    try {
      const res = await fetch(`/api/driver/deliveries/${deliveryId}/pod`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      setDone(true);
      window.setTimeout(() => router.push("/driver"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const submitUnattended = async () => {
    setError(null);
    if (photoFiles.length === 0) {
      setError("Take at least one photo");
      return;
    }
    setSubmitting(true);

    const fd = new FormData();
    fd.set("pod_type", "unattended");
    if (receiverName.trim()) fd.set("receiver_name", receiverName.trim());
    if (gpsLat != null) fd.set("gps_lat", String(gpsLat));
    if (gpsLng != null) fd.set("gps_lng", String(gpsLng));
    if (notes.trim()) fd.set("notes", notes.trim());
    photoFiles.forEach((f) => fd.append("photos", f));

    const offline =
      typeof navigator !== "undefined" && !navigator.onLine;

    if (offline) {
      const photoDataUrls = await filesToDataUrls(photoFiles);
      const q: QueuedPod = {
        id: crypto.randomUUID(),
        deliveryId,
        podType: "unattended",
        receiverName: receiverName.trim() || undefined,
        photoDataUrls,
        gpsLat,
        gpsLng,
        notes: notes.trim() || undefined,
        queuedAt: new Date().toISOString(),
      };
      await queuePodSubmission(q);
      setDone(true);
      setSubmitting(false);
      window.setTimeout(() => router.push("/driver"), 2000);
      return;
    }

    try {
      const res = await fetch(`/api/driver/deliveries/${deliveryId}/pod`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      setDone(true);
      window.setTimeout(() => router.push("/driver"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#51836D] p-6 text-white"
        role="status"
      >
        <CheckCircle2 className="size-16 text-white" aria-hidden />
        <p className="text-xl font-semibold">Delivery recorded</p>
        <p className="text-center text-sm opacity-90">{recipientLabel}</p>
        <p className="text-center text-sm opacity-90">{addressLabel}</p>
        <p className="text-sm opacity-80">
          {doneAt.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        <p className="text-sm">
          {typeof navigator !== "undefined" && !navigator.onLine
            ? "Saved locally — will sync when online"
            : "Redirecting…"}
        </p>
      </div>
    );
  }

  if (unattended) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Unattended delivery
        </h3>
        <p className="text-sm text-gray-600">
          Take a photo of the delivery location. Add optional notes.
        </p>
        <div>
          <Label className="text-base">Photo</Label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-2 block w-full text-base"
            onChange={(e) => addPhotos(e.target.files)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {photoPreviews.map((src, i) => (
            <div key={src} className="relative h-20 w-20 overflow-hidden rounded border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-0 top-0 inline-flex min-h-12 min-w-12 items-center justify-center bg-black/50 text-white"
                onClick={() => removePhoto(i)}
                aria-label="Remove photo"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <div>
          <Label htmlFor="un-notes" className="text-base">
            Notes (optional)
          </Label>
          <Textarea
            id="un-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 min-h-[96px] text-base"
            rows={3}
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={submitting || photoFiles.length === 0}
          className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-base font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: MAZATI }}
          onClick={() => void submitUnattended()}
        >
          {submitting ? "Submitting…" : "Submit attempted delivery"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="min-h-12 rounded-lg border border-gray-300 px-4 text-base text-gray-800"
          onClick={() => {
            setUnattended(true);
            setPhotoFiles([]);
            setPhotoPreviews([]);
          }}
        >
          No one home
        </button>
      </div>

      {signedStep === 1 && (
        <div className="space-y-3">
          <Label htmlFor="recv" className="text-base">
            Receiver&apos;s full name
          </Label>
          <Input
            id="recv"
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            className="text-base"
            autoComplete="name"
          />
          <Button
            type="button"
            className="min-h-12 w-full text-base"
            style={{ backgroundColor: MAZATI, color: "white" }}
            disabled={!receiverName.trim()}
            onClick={() => setSignedStep(2)}
          >
            Next
          </Button>
        </div>
      )}

      {signedStep >= 2 && (
        <div className={signedStep === 2 ? "space-y-3" : "sr-only"}>
          <p className="text-sm text-gray-500">
            {hasSignature ? "" : "Sign here"}
          </p>
          <canvas
            ref={canvasRef}
            width={800}
            height={240}
            className={cn(
              "min-h-[200px] w-full touch-none rounded border border-gray-300 bg-white",
              signedStep === 3 && "hidden",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
          />
        </div>
      )}

      {signedStep === 2 && (
        <>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full"
            onClick={clearCanvas}
          >
            Clear signature
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 flex-1"
              onClick={() => setSignedStep(1)}
            >
              Back
            </Button>
            <Button
              type="button"
              className="min-h-12 flex-1 text-base text-white"
              style={{ backgroundColor: MAZATI }}
              disabled={!hasSignature}
              onClick={() => setSignedStep(3)}
            >
              Next
            </Button>
          </div>
        </>
      )}

      {signedStep === 3 && (
        <div className="space-y-4">
          <Label className="text-base">Photos</Label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="block w-full text-base"
            onChange={(e) => addPhotos(e.target.files)}
          />
          <div className="flex flex-wrap gap-2">
            {photoPreviews.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="relative h-20 w-20 overflow-hidden rounded border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-0 top-0 inline-flex min-h-12 min-w-12 items-center justify-center bg-black/50 text-white"
                  onClick={() => removePhoto(i)}
                  aria-label="Remove photo"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <div>
            <Label htmlFor="sig-notes" className="text-base">
              Notes (optional)
            </Label>
            <Textarea
              id="sig-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 text-base"
              rows={2}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 flex-1"
              onClick={() => setSignedStep(2)}
            >
              Back
            </Button>
            <button
              type="button"
              disabled={
                submitting ||
                !receiverName.trim() ||
                !hasSignature ||
                photoFiles.length === 0
              }
              className="flex min-h-12 flex-1 items-center justify-center rounded-lg text-base font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: MAZATI }}
              onClick={() => void submitSigned()}
            >
              {submitting ? "Submitting…" : "Confirm delivery"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
