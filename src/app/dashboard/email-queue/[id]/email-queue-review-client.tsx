"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderDetailResponse } from "@/lib/types/order";
import type { EmailQueueDetailDto, ParsedEmailConfidence } from "@/lib/types/email";

const PRIMARY = "#51836D";

const DISPLAY_LOCALE = "en-AU";
const DISPLAY_TZ = "Australia/Sydney";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  });
}

function queueStatusLabel(status: EmailQueueDetailDto["status"]): string {
  switch (status) {
    case "pending_review":
      return "Pending Review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

function confidenceBadgeClasses(c: ParsedEmailConfidence | null): string {
  switch (c) {
    case "high":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "low":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-gray-200 bg-gray-100 text-gray-600";
  }
}

type Line = { name: string; quantity: number };

function emptyLine(): Line {
  return { name: "", quantity: 1 };
}

function linesFromParsed(p: EmailQueueDetailDto["parsed_data"]): Line[] {
  if (!p?.items?.length) return [emptyLine()];
  return p.items.map((i) => ({
    name: i.name,
    quantity: Math.max(1, Math.floor(i.quantity)),
  }));
}

export function EmailQueueReviewClient({
  initial,
}: {
  initial: EmailQueueDetailDto;
}) {
  const router = useRouter();
  const pending = initial.status === "pending_review";
  const p = initial.parsed_data;

  const [recipientName, setRecipientName] = useState(
    p?.recipient_name ?? "",
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    p?.delivery_address ?? "",
  );
  const [recipientPhone, setRecipientPhone] = useState(
    p?.recipient_phone ?? "",
  );
  const [recipientEmail, setRecipientEmail] = useState(
    p?.recipient_email ?? "",
  );
  const [specialInstructions, setSpecialInstructions] = useState(
    p?.special_instructions ?? "",
  );
  const [lines, setLines] = useState<Line[]>(() => linesFromParsed(p));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createdOrderId = p?._created_order_id;

  async function approve() {
    setError(null);
    setBusy(true);
    try {
      const items = lines
        .map((l) => ({
          name: l.name.trim(),
          quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
        }))
        .filter((l) => l.name.length > 0);

      const res = await fetch(`/api/email-queue/${initial.id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_name: recipientName.trim(),
          delivery_address: deliveryAddress.trim(),
          recipient_phone: recipientPhone.trim() || null,
          recipient_email: recipientEmail.trim() || null,
          special_instructions: specialInstructions.trim() || null,
          items: items.length ? items : undefined,
        }),
      });
      const json = (await res.json()) as OrderDetailResponse & { error?: string };
      if (!res.ok) {
        setError(
          typeof json.error === "string" ? json.error : "Could not approve",
        );
        return;
      }
      const detail = json as OrderDetailResponse;
      router.push(`/dashboard/orders/${detail.order.id}?email=approved`);
      router.refresh();
    } catch {
      setError("Could not approve");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/email-queue/${initial.id}/reject`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(
          typeof json.error === "string" ? json.error : "Could not reject",
        );
        return;
      }
      router.push("/dashboard/email-queue");
      router.refresh();
    } catch {
      setError("Could not reject");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            <Link
              href="/dashboard/email-queue"
              className="text-gray-600 underline-offset-2 hover:underline"
            >
              Back to Email Queue
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            {initial.raw_subject}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            <span
              className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${pending ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-200 bg-gray-100 text-gray-700"}`}
            >
              {queueStatusLabel(initial.status)}
            </span>
            <span className="ml-3 text-gray-500">
              Received {formatDateTime(initial.created_at)}
            </span>
          </p>
        </div>
        {createdOrderId ? (
          <Button variant="outline" asChild>
            <Link href={`/dashboard/orders/${createdOrderId}`}>
              Open delivery order
            </Link>
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Raw email</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">From</dt>
              <dd className="font-mono text-gray-900">{initial.raw_from}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Subject</dt>
              <dd className="text-gray-900">{initial.raw_subject}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Body</p>
            <pre className="max-h-[min(480px,50vh)] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 font-mono text-xs text-gray-800 ring-1 ring-gray-200">
              {initial.raw_body}
            </pre>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Parsed fields
              </h2>
              <span
                className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${confidenceBadgeClasses(p?.confidence ?? null)}`}
              >
                {p?.confidence
                  ? `Confidence: ${p.confidence}`
                  : "Confidence: —"}
              </span>
            </div>

            {!pending ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Reviewed</dt>
                  <dd className="text-gray-900">
                    {initial.reviewed_at
                      ? formatDateTime(initial.reviewed_at)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Reviewer</dt>
                  <dd className="text-gray-900">
                    {initial.reviewer_name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Recipient</dt>
                  <dd className="text-gray-900">{p?.recipient_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Address</dt>
                  <dd className="whitespace-pre-wrap text-gray-900">
                    {p?.delivery_address ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="text-gray-900">{p?.recipient_phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="text-gray-900">{p?.recipient_email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Items</dt>
                  <dd>
                    <ul className="list-inside list-disc text-gray-900">
                      {(p?.items ?? []).map((i, idx) => (
                        <li key={`${i.name}-${idx}`}>
                          {i.name} ×{i.quantity}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Special instructions</dt>
                  <dd className="whitespace-pre-wrap text-gray-900">
                    {p?.special_instructions ?? "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="eq-recipient">Recipient name</Label>
                  <Input
                    id="eq-recipient"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-address">Delivery address</Label>
                  <Textarea
                    id="eq-address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={3}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-phone">Phone</Label>
                  <Input
                    id="eq-phone"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-email">Email</Label>
                  <Input
                    id="eq-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="text-base"
                  />
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
                  {lines.map((line, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="min-w-[160px] flex-1 space-y-1">
                        <Label className="text-xs text-gray-500">Name</Label>
                        <Input
                          value={line.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLines((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, name: v } : x,
                              ),
                            );
                          }}
                          placeholder="Item name"
                          className="text-base"
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
                          className="text-base"
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
                <div className="space-y-2">
                  <Label htmlFor="eq-notes">Special instructions</Label>
                  <Textarea
                    id="eq-notes"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    rows={2}
                    className="text-base"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    style={{ backgroundColor: PRIMARY }}
                    className="text-white hover:opacity-90"
                    disabled={busy}
                    onClick={() => void approve()}
                  >
                    Approve &amp; create order
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => void reject()}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
