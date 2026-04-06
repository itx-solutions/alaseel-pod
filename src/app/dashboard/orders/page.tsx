import { Suspense } from "react";
import { OrdersListClient } from "./orders-list-client";

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-gray-500">Loading orders…</p>
      }
    >
      <OrdersListClient />
    </Suspense>
  );
}
