import { notFound } from "next/navigation";
import { getEmailQueueEntry } from "@/lib/data/email-queue";
import { EmailQueueReviewClient } from "./email-queue-review-client";

type PageProps = { params: Promise<{ id: string }> };

export default async function EmailQueueReviewPage({ params }: PageProps) {
  const { id } = await params;
  const entry = await getEmailQueueEntry(id);
  if (!entry) notFound();

  return <EmailQueueReviewClient initial={entry} />;
}
