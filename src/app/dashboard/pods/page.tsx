import { Suspense } from "react";
import { PodsListClient } from "./pods-list-client";

export default function PodsPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-gray-500">Loading POD records…</p>}
    >
      <PodsListClient />
    </Suspense>
  );
}
