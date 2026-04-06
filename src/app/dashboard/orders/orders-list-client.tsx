"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Package } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OrderTable } from "@/components/back-office/order-table";
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
import type { PaginatedOrdersResponse } from "@/lib/types/order";

const PRIMARY = "#51836D";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "in_transit", label: "In transit" },
  { value: "completed", label: "Completed" },
  { value: "attempted", label: "Attempted" },
];

function buildQuery(page: number, search: string, status: string): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (search.trim()) p.set("search", search.trim());
  if (status && status !== "all") p.set("status", status);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function OrdersListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPage = Math.max(
    1,
    Number(searchParams.get("page") ?? "1") || 1,
  );
  const initialSearch = searchParams.get("search") ?? "";
  const initialStatus = searchParams.get("status") ?? "all";

  const [page, setPage] = useState(initialPage);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<PaginatedOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 350);
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
    router.replace(`/dashboard/orders${q}`, { scroll: false });
  }, [page, debouncedSearch, status, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status && status !== "all") params.set("status", status);

    const q = params.toString();
    const url = `/api/orders${q ? `?${q}` : ""}`;

    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
        return res.json() as Promise<PaginatedOrdersResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load orders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, status]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.totalCount / data.pageSize));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-600">
            Search and filter deliveries. Updates are debounced as you type.
          </p>
        </div>
        <Link
          href="/dashboard/orders/new"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          <Package className="mr-2 size-4" aria-hidden />
          New order
        </Link>
      </div>

      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="order-search">Search</Label>
          <Input
            id="order-search"
            placeholder="Recipient name or address"
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
        <p className="text-sm text-gray-500">Loading orders…</p>
      ) : null}

      {data ? (
        <>
          <OrderTable orders={data.orders} />
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              Page {data.page} of {totalPages} · {data.totalCount} total
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
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
