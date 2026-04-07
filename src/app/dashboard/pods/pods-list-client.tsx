"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
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
import type { PaginatedPodsResponse } from "@/lib/types/pod";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "signed", label: "Signed" },
  { value: "unattended", label: "Unattended" },
];

function buildQuery(
  page: number,
  search: string,
  type: string,
  dateFrom: string,
  dateTo: string,
): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (search.trim()) p.set("search", search.trim());
  if (type && type !== "all") p.set("type", type);
  if (dateFrom.trim()) p.set("date_from", dateFrom.trim());
  if (dateTo.trim()) p.set("date_to", dateTo.trim());
  const q = p.toString();
  return q ? `?${q}` : "";
}

const DISPLAY_LOCALE = "en-AU";
const DISPLAY_TZ = "Australia/Sydney";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  });
}

export function PodsListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPage = Math.max(
    1,
    Number(searchParams.get("page") ?? "1") || 1,
  );
  const initialSearch = searchParams.get("search") ?? "";
  const initialType = searchParams.get("type") ?? "all";
  const initialDateFrom = searchParams.get("date_from") ?? "";
  const initialDateTo = searchParams.get("date_to") ?? "";

  const [page, setPage] = useState(initialPage);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [type, setType] = useState(initialType);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);

  const [data, setData] = useState<PaginatedPodsResponse | null>(null);
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
    const q = buildQuery(page, debouncedSearch, type, dateFrom, dateTo);
    router.replace(`/dashboard/pods${q}`, { scroll: false });
  }, [page, debouncedSearch, type, dateFrom, dateTo, router]);

  const fetchSeq = useRef(0);

  useEffect(() => {
    const seq = ++fetchSeq.current;
    const ac = new AbortController();

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (type && type !== "all") params.set("type", type);
    if (dateFrom.trim()) params.set("date_from", dateFrom.trim());
    if (dateTo.trim()) params.set("date_to", dateTo.trim());

    const q = params.toString();
    const url = `/api/pods${q ? `?${q}` : ""}`;

    fetch(url, { credentials: "include", signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
        return res.json() as Promise<PaginatedPodsResponse>;
      })
      .then((json) => {
        if (seq !== fetchSeq.current) return;
        setData(json);
      })
      .catch((e: unknown) => {
        if (seq !== fetchSeq.current) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load POD records");
      })
      .finally(() => {
        if (seq !== fetchSeq.current) return;
        setLoading(false);
      });

    return () => {
      ac.abort();
    };
  }, [page, debouncedSearch, type, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">POD Records</h1>
        <p className="mt-1 text-sm text-gray-600">
          Proof of delivery submissions. Search is debounced as you type.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pod-search">Search</Label>
          <Input
            id="pod-search"
            placeholder="Recipient name or address"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>POD type</Label>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-from">Date from</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-to">Date to</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-gray-500">Loading POD records…</p>
      ) : null}

      {data && data.items.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <ClipboardList className="size-12 text-gray-400" aria-hidden />
          <p className="mt-4 text-sm font-medium text-gray-900">
            No POD records found
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Try adjusting filters or search.
          </p>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Date/Time
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Recipient
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Address
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Driver
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Photos
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatDateTime(row.submitted_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.order_recipient_name}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-gray-700">
                      {row.delivery_address}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.driver_name}</td>
                    <td className="px-4 py-3">
                      {row.pod_type === "signed" ? (
                        <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Signed
                        </span>
                      ) : (
                        <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Unattended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.photo_count === 1
                        ? "1 photo"
                        : `${row.photo_count} photos`}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/pods/${row.id}`}>View</Link>
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
    </div>
  );
}
