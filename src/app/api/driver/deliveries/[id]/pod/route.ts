import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
} from "@/lib/api/back-office";
import { requireDriverUser } from "@/lib/api/driver";
import { getAuthenticatedUser } from "@/lib/auth";
import { createPodForDriver } from "@/lib/data/deliveries";
import type { PodType } from "@/lib/types/order";
import type { DriverPodCreatedResponse } from "@/lib/types/delivery";

type RouteContext = { params: Promise<{ id: string }> };

async function fileToUint8(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer());
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireDriverUser(user)) return jsonForbidden();

  const { id: deliveryId } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonBadRequest("Expected multipart/form-data");
  }

  const podTypeRaw = formData.get("pod_type");
  if (podTypeRaw !== "signed" && podTypeRaw !== "unattended") {
    return jsonBadRequest("pod_type must be signed or unattended");
  }
  const podType = podTypeRaw as PodType;

  const receiverName =
    typeof formData.get("receiver_name") === "string"
      ? (formData.get("receiver_name") as string)
      : null;

  const notes =
    typeof formData.get("notes") === "string"
      ? (formData.get("notes") as string)
      : null;

  const gpsLat =
    typeof formData.get("gps_lat") === "string"
      ? (formData.get("gps_lat") as string)
      : null;
  const gpsLng =
    typeof formData.get("gps_lng") === "string"
      ? (formData.get("gps_lng") as string)
      : null;

  const signatureEntry = formData.get("signature");
  const signatureFile =
    signatureEntry instanceof File && signatureEntry.size > 0
      ? signatureEntry
      : null;

  const photoEntries = formData.getAll("photos");
  const photoFiles = photoEntries.filter(
    (p): p is File => p instanceof File && p.size > 0,
  );

  const photos: Uint8Array[] = [];
  for (const f of photoFiles) {
    photos.push(await fileToUint8(f));
  }

  let signaturePng: Uint8Array | null = null;
  if (podType === "signed") {
    if (!signatureFile) return jsonBadRequest("signature image is required for signed POD");
    signaturePng = await fileToUint8(signatureFile);
  }

  try {
    const result = await createPodForDriver(deliveryId, user.id, {
      podType,
      receiverName,
      signaturePng,
      photos,
      gpsLat: gpsLat?.trim() || null,
      gpsLng: gpsLng?.trim() || null,
      notes: notes?.trim() ?? null,
    });

    if (!result) return jsonNotFound();

    const payload: DriverPodCreatedResponse = result;
    return Response.json(payload, { status: 201 });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "INVALID_STATE") {
        return jsonBadRequest("POD cannot be submitted in the current state");
      }
      if (e.message === "POD_EXISTS") {
        return Response.json(
          { error: "POD already exists for this delivery" },
          { status: 409 },
        );
      }
      if (e.message === "VALIDATION") {
        return jsonBadRequest("Missing required fields for this POD type");
      }
    }
    throw e;
  }
}
