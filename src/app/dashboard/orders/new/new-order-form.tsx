"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  DriverPublicDto,
  DriversListResponse,
  OrderDetailResponse,
  OrderItemLine,
  PostOrderRequestBody,
} from "@/lib/types/order";

const PRIMARY = "#51836D";

function emptyLine(): OrderItemLine {
  return { name: "", quantity: 1 };
}

export function NewOrderForm() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<DriverPublicDto[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [driverId, setDriverId] = useState<string>("__none__");
  const [lines, setLines] = useState<OrderItemLine[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json() as Promise<DriversListResponse>)
      .then((d) => setDrivers(d.drivers))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const items: OrderItemLine[] = lines
      .map((l) => ({
        name: l.name.trim(),
        quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
        notes: l.notes?.trim() || undefined,
      }))
      .filter((l) => l.name.length > 0);

    const body: PostOrderRequestBody = {
      recipient_name: recipientName.trim(),
      delivery_address: deliveryAddress.trim(),
      recipient_phone: recipientPhone.trim() || null,
      recipient_email: recipientEmail.trim() || null,
      special_instructions: specialInstructions.trim() || null,
      items: items.length ? items : undefined,
      driver_id: driverId === "__none__" ? null : driverId,
    };

    if (!body.recipient_name || !body.delivery_address) {
      setError("Recipient name and delivery address are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as OrderDetailResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not create order");
      }
      router.push(`/dashboard/orders/${json.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-xl border border-gray-200 bg-white p-6"
    >
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="recipient_name">Recipient name</Label>
          <Input
            id="recipient_name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recipient_phone">Phone</Label>
          <Input
            id="recipient_phone"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recipient_email">Email</Label>
          <Input
            id="recipient_email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="delivery_address">Delivery address</Label>
          <Textarea
            id="delivery_address"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            required
            rows={3}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="special_instructions">Special instructions</Label>
          <Textarea
            id="special_instructions"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Assign driver (optional)</Label>
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="No driver yet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No driver yet</SelectItem>
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base">Line items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            Add line
          </Button>
        </div>
        <div className="space-y-3">
          {lines.map((line, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 p-3"
            >
              <div className="min-w-[160px] flex-1 space-y-1">
                <Label className="text-xs text-gray-500">Description</Label>
                <Input
                  value={line.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, name: v } : x)),
                    );
                  }}
                  placeholder="Item name"
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs text-gray-500">Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setLines((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, quantity: v } : x,
                      ),
                    );
                  }}
                />
              </div>
              <div className="min-w-[120px] flex-1 space-y-1">
                <Label className="text-xs text-gray-500">Notes</Label>
                <Input
                  value={line.notes ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, notes: v || undefined } : x,
                      ),
                    );
                  }}
                  placeholder="Optional"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600"
                disabled={lines.length <= 1}
                onClick={() =>
                  setLines((prev) => prev.filter((_, j) => j !== i))
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: PRIMARY }}
        >
          {submitting ? "Creating…" : "Create order"}
        </button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/orders")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
