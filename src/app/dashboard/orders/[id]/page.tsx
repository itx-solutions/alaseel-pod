import { notFound } from "next/navigation";
import { OrderDetailClient } from "@/app/dashboard/orders/[id]/order-detail-client";
import { getOrderDetailData } from "@/lib/data/orders";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ locked?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getOrderDetailData(id);
  if (!data) notFound();

  return (
    <OrderDetailClient initial={data} locked={sp.locked === "1"} />
  );
}
