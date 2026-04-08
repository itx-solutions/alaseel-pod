import { notFound } from "next/navigation";
import { DriverDetailClient } from "./driver-detail-client";
import { getDriverDetailView } from "@/lib/data/drivers";

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getDriverDetailView(id);
  if (!data) notFound();

  return <DriverDetailClient initial={data} />;
}
