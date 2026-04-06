import { NewOrderForm } from "@/app/dashboard/orders/new/new-order-form";

export default function NewOrderPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New order</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a manual delivery order. You can assign a driver now or later.
        </p>
      </div>
      <NewOrderForm />
    </div>
  );
}
