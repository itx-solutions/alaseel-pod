/**
 * IndexedDB queue for offline POD submissions. Client-only.
 */

import type { DriverDeliveriesListResponse } from "@/lib/types/delivery";

const DB_NAME = "alaseel-pod-driver";
const DB_VERSION = 1;
const POD_STORE = "pod-queue";
const DELIVERIES_STORE = "driver-deliveries-cache";
const POD_KEY = "queued";

export interface QueuedPod {
  id: string;
  deliveryId: string;
  podType: "signed" | "unattended";
  receiverName?: string;
  signatureDataUrl?: string;
  photoDataUrls: string[];
  gpsLat?: number;
  gpsLng?: number;
  notes?: string;
  queuedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(POD_STORE)) {
        db.createObjectStore(POD_STORE);
      }
      if (!db.objectStoreNames.contains(DELIVERIES_STORE)) {
        db.createObjectStore(DELIVERIES_STORE);
      }
    };
  });
}

export async function queuePodSubmission(pod: QueuedPod): Promise<void> {
  const db = await openDb();
  const existing = await getQueuedPods();
  existing.push(pod);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(POD_STORE, "readwrite");
    tx.objectStore(POD_STORE).put(existing, POD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getQueuedPods(): Promise<QueuedPod[]> {
  const db = await openDb();
  const rows = await new Promise<QueuedPod[] | undefined>((resolve, reject) => {
    const tx = db.transaction(POD_STORE, "readonly");
    const req = tx.objectStore(POD_STORE).get(POD_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows ?? [];
}

export async function removeQueuedPod(id: string): Promise<void> {
  const db = await openDb();
  const existing = await getQueuedPods();
  const filtered = existing.filter((p) => p.id !== id);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(POD_STORE, "readwrite");
    tx.objectStore(POD_STORE).put(filtered, POD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const binary = atob(b64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function syncQueuedPods(): Promise<void> {
  const queued = await getQueuedPods();
  if (queued.length === 0) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  for (const q of [...queued]) {
    try {
      const fd = new FormData();
      fd.set("pod_type", q.podType);
      if (q.receiverName) fd.set("receiver_name", q.receiverName);
      if (q.notes) fd.set("notes", q.notes);
      if (q.gpsLat != null) fd.set("gps_lat", String(q.gpsLat));
      if (q.gpsLng != null) fd.set("gps_lng", String(q.gpsLng));

      if (q.podType === "signed" && q.signatureDataUrl) {
        const blob = dataUrlToBlob(q.signatureDataUrl);
        fd.set("signature", blob, "signature.png");
      }

      for (let i = 0; i < q.photoDataUrls.length; i++) {
        const blob = dataUrlToBlob(q.photoDataUrls[i]);
        fd.append("photos", blob, `photo-${i}.jpg`);
      }

      const res = await fetch(`/api/driver/deliveries/${q.deliveryId}/pod`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (res.ok) {
        await removeQueuedPod(q.id);
      }
    } catch {
      // keep in queue for next sync
    }
  }
}

const DELIVERIES_CACHE_KEY = "today";

export async function saveDriverDeliveriesCache(
  data: DriverDeliveriesListResponse,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DELIVERIES_STORE, "readwrite");
    tx.objectStore(DELIVERIES_STORE).put(data, DELIVERIES_CACHE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDriverDeliveriesCache(): Promise<DriverDeliveriesListResponse | null> {
  const db = await openDb();
  const row = await new Promise<DriverDeliveriesListResponse | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(DELIVERIES_STORE, "readonly");
      const req = tx.objectStore(DELIVERIES_STORE).get(DELIVERIES_CACHE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    },
  );
  db.close();
  return row ?? null;
}
