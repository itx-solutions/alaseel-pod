import {
  jsonForbidden,
  jsonUnauthorized,
} from "@/lib/api/back-office";
import { requireDriverUser } from "@/lib/api/driver";
import { getAuthenticatedUser } from "@/lib/auth";
import { listCompletedDeliveriesForDriver } from "@/lib/data/deliveries";
import { getSignedR2Url } from "@/lib/r2";
import type {
  CompletedDeliveryRow,
  DriverCompletedListResponse,
} from "@/lib/types/delivery";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireDriverUser(user)) return jsonForbidden();

  const rows = await listCompletedDeliveriesForDriver(user.id, 30);

  const deliveries: CompletedDeliveryRow[] = await Promise.all(
    rows.map(async (row) => {
      let signatureSignedUrl: string | null = null;
      if (row.signatureKey) {
        signatureSignedUrl = await getSignedR2Url(row.signatureKey, 3600);
      }
      const photos = await Promise.all(
        row.photoKeys.map(async (p) => ({
          id: p.id,
          signedUrl: await getSignedR2Url(p.key, 3600),
        })),
      );
      return {
        deliveryId: row.deliveryId,
        orderId: row.orderId,
        recipientName: row.recipientName,
        deliveryAddress: row.deliveryAddress,
        completedAt: row.completedAt,
        podType: row.podType,
        signatureSignedUrl,
        photos,
      };
    }),
  );

  const payload: DriverCompletedListResponse = { deliveries };
  return Response.json(payload);
}
