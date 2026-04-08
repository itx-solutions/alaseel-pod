"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DriverStats } from "@/components/back-office/driver-stats";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DriverListItemDto,
  DriversListApiResponse,
} from "@/lib/types/driver";
import { cn, formatRelativePast } from "@/lib/utils";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-gray-200 bg-gray-100 text-gray-600",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function completionCell(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate}%`;
}

export function DriversListClient() {
  const router = useRouter();
  const [data, setData] = useState<DriversListApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/drivers/list", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
        return res.json() as Promise<DriversListApiResponse>;
      })
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load drivers");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.drivers.filter((d) => {
      if (statusFilter === "active" && !d.isActive) return false;
      if (statusFilter === "inactive" && d.isActive) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q)
      );
    });
  }, [data, statusFilter, search]);

  async function patchDeactivate(id: string) {
    const res = await fetch(`/api/drivers/${id}/deactivate`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        typeof err.error === "string" ? err.error : `Error ${res.status}`,
      );
    }
  }

  async function patchReactivate(id: string) {
    const res = await fetch(`/api/drivers/${id}/reactivate`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        typeof err.error === "string" ? err.error : `Error ${res.status}`,
      );
    }
  }

  function confirmDeactivate(d: DriverListItemDto) {
    const ok = window.confirm(
      `Are you sure you want to deactivate ${d.name}? They will no longer be able to sign in.`,
    );
    if (!ok) return;
    void patchDeactivate(d.id)
      .then(() => load())
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to deactivate");
      });
  }

  function onRowNavigate(id: string) {
    router.push(`/dashboard/drivers/${id}`);
  }

  const emptyAll = !loading && data && data.drivers.length === 0;
  const emptyFiltered =
    !loading && data && data.drivers.length > 0 && filtered.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
        <p className="mt-1 text-sm text-gray-600">
          Driver accounts are managed by IT. Contact your administrator to add
          or remove drivers.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-2 sm:w-48">
          <Label htmlFor="driver-status">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="driver-status" className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] flex-1 space-y-2">
          <Label htmlFor="driver-search">Search</Label>
          <Input
            id="driver-search"
            className="bg-white text-base"
            placeholder="Name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-6 w-1/3 animate-pulse rounded bg-gray-200" />
          <div className="h-32 animate-pulse rounded bg-gray-100" />
        </div>
      ) : emptyAll ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600">
          No driver accounts found. Contact IT to set up driver accounts.
        </p>
      ) : emptyFiltered ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600">
          No drivers match your filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-600">Driver</TableHead>
                  <TableHead className="text-gray-600">Status</TableHead>
                  <TableHead className="hidden text-right text-gray-600 md:table-cell">
                    Total deliveries
                  </TableHead>
                  <TableHead className="hidden text-right text-gray-600 md:table-cell">
                    Completed
                  </TableHead>
                  <TableHead className="hidden text-right text-gray-600 md:table-cell">
                    Attempted
                  </TableHead>
                  <TableHead className="hidden text-right text-gray-600 md:table-cell">
                    Completion rate
                  </TableHead>
                  <TableHead className="hidden text-gray-600 md:table-cell">
                    Last delivery
                  </TableHead>
                  <TableHead className="text-right text-gray-600">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow
                    key={d.id}
                    className={cn(
                      "cursor-pointer",
                      !d.isActive && "opacity-50",
                    )}
                    onClick={() => onRowNavigate(d.id)}
                  >
                    <TableCell className="max-w-[240px]">
                      <p className="font-semibold text-gray-900">{d.name}</p>
                      <p className="text-sm text-gray-500">{d.email}</p>
                      <div className="mt-2 md:hidden">
                        <DriverStats
                          compact
                          stats={{
                            totalDeliveries: d.totalDeliveries,
                            completedDeliveries: d.completedDeliveries,
                            attemptedDeliveries: d.attemptedDeliveries,
                            completionRate: d.completionRate,
                            lastDeliveryAt: d.lastDeliveryAt,
                          }}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Last: {formatRelativePast(d.lastDeliveryAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge active={d.isActive} />
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {d.totalDeliveries}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {d.completedDeliveries}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {d.attemptedDeliveries}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {completionCell(d.completionRate)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-gray-600 md:table-cell">
                      {formatRelativePast(d.lastDeliveryAt)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {d.isActive ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => confirmDeactivate(d)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                          onClick={() =>
                            void patchReactivate(d.id)
                              .then(() => load())
                              .catch((e: unknown) => {
                                setError(
                                  e instanceof Error
                                    ? e.message
                                    : "Failed to reactivate",
                                );
                              })
                          }
                        >
                          Reactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </div>
      )}
    </div>
  );
}
