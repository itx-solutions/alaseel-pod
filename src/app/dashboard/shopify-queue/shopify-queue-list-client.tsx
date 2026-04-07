"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import type { PaginatedShopifyQueueResponse } from "@/lib/types/shopify";

const DISPLAY_LOCALE = "en-AU";
const DISPLAY_TZ = "Australia/Sydney";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  });
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending_review", label: "Pending Review" },
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

function queueStatusBadgeClasses(status: string): string {
  switch (status) {
    case "pending_review":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-800";
    case "cancelled":
      return "border-neutral-200 bg-neutral-100 text-neutral-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function queueStatusLabel(status: string): string {
  switch (status) {
    case "pending_review":
      return "Pending Review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function buildQuery(page: number, search: string, status: string): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (search.trim()) p.set("search", search.trim());
  if (status !== "pending_review") p.set("status", status);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function ShopifyQueueListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPage = Math.max(
    1,
    Number(searchParams.get("page") ?? "1") || 1,
  );
  const initialSearch = searchParams.get("search") ?? "";
  const initialStatus = searchParams.get("status") ?? "pending_review";

  const [page, setPage] = useState(initialPage);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<PaginatedShopifyQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const prevDebounced = useRef<string | null>(null);
  useEffect(() => {
    if (prevDebounced.current === null) {
      prevDebounced.current = debouncedSearch;
      return;
    }
    if (prevDebounced.current !== debouncedSearch) {
      prevDebounced.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const q = buildQuery(page, debouncedSearch, status);
    router.replace(`/dashboard/shopify-queue${q}`, { scroll: false });
  }, [page, debouncedSearch, status, router]);

  const fetchSeq = useRef(0);
  useEffect(() => {
    const seq = ++fetchSeq.current;
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status === "all") params.set("status", "all");
    else if (status !== "pending_review") params.set("status", status);
    else params.set("status", "pending_review");

    const q = params.toString();
    const url = `/api/shopify-queue${q ? `?${q}` : ""}`;

    fetch(url, { credentials: "include", signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
        return res.json() as Promise<PaginatedShopifyQueueResponse>;
      })
      .then((json) => {
        if (seq !== fetchSeq.current) return;
        setData(json);
      })
      .catch((e: unknown) => {
        if (seq !== fetchSeq.current) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load queue");
      })
      .finally(() => {
        if (seq !== fetchSeq.current) return;
        setLoading(false);
      });

    return () => ac.abort();
  }, [page, debouncedSearch, status]);

  const isEmptyPending =
    data &&
    data.items.length === 0 &&
    status === "pending_review" &&
    !debouncedSearch.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shopify Orders</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review paid Shopify orders before creating delivery orders.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="sq-search">Search</Label>
          <Input
            id="sq-search"
            placeholder="Recipient, address, or order #"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-gray-500">Loading queue…</p>
      ) : null}

      {isEmptyPending ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <CheckCircle2 className="size-12 text-emerald-500" aria-hidden />
          <p className="mt-4 text-sm font-medium text-gray-900">
            No Shopify orders awaiting review
          </p>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Shopify Order #
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Recipient
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Address
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Items</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Total</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Received
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-mono text-gray-900">
                      {row.shopify_order_number}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.recipient_name}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-gray-700">
                      {row.delivery_address}
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                      {row.items_count}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.order_total ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${queueStatusBadgeClasses(row.status)}`}
                      >
                        {queueStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/shopify-queue/${row.id}`}>
                          Review
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              Page {data.page} of {data.total_pages} · {data.total} total
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page >= data.total_pages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {data && data.items.length === 0 && !isEmptyPending && !loading ? (
        <p className="text-sm text-gray-600">No queue entries match your filters.</p>
      ) : null}
    </div>
  );
}
