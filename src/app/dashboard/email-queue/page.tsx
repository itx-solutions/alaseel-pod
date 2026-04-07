import { Suspense } from "react";
import { EmailQueueListClient } from "./email-queue-list-client";

export default function EmailQueuePage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-gray-500">Loading email queue…</p>}
    >
      <EmailQueueListClient />
    </Suspense>
  );
}
