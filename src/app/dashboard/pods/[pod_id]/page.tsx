import { notFound } from "next/navigation";
import { getPodDetailForBackOffice } from "@/lib/data/pods";
import { PodDetailClient } from "./pod-detail-client";

export default async function PodDetailPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const initial = await getPodDetailForBackOffice(pod_id);
  if (!initial) notFound();

  return <PodDetailClient initial={initial} />;
}
