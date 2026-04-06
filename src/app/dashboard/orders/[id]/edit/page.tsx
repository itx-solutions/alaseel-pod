import { notFound, redirect } from "next/navigation";
import { EditOrderForm } from "@/app/dashboard/orders/[id]/edit/edit-order-form";
import { getOrderDetailData } from "@/lib/data/orders";

function isEditable(status: string) {
  return status === "pending" || status === "assigned";
}

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getOrderDetailData(id);
  if (!data) notFound();
  if (!isEditable(data.order.status)) {
    redirect(`/dashboard/orders/${id}?locked=1`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit order</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update recipient details and line items. Assignment is managed from the
          order page.
        </p>
      </div>
      <EditOrderForm initial={data} />
    </div>
  );
}
