"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Loader2,
  Percent,
  XCircle,
} from "lucide-react";
import { StatsCard } from "@/components/back-office/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportSummaryDto } from "@/lib/types/report";

const MAZATI = "#51836D";

function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDaysUtc(n: number): { from: string; to: string } {
  const now = new Date();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (n - 1));
  return { from: formatISODate(start), to: formatISODate(end) };
}

function thisMonthUtc(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1),
  );
  return { from: formatISODate(from), to: formatISODate(to) };
}

function lastMonthUtc(): { from: string; to: string } {
  const now = new Date();
  const firstThis = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const lastPrev = new Date(firstThis);
  lastPrev.setUTCDate(0);
  const firstPrev = new Date(
    Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1),
  );
  return { from: formatISODate(firstPrev), to: formatISODate(lastPrev) };
}

function defaultLast30(): { from: string; to: string } {
  return lastNDaysUtc(30);
}

function completionPct(c: number, a: number): string {
  const den = c + a;
  if (den === 0) return "0%";
  return `${Math.round((c / den) * 1000) / 10}%`;
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows: ReportSummaryDto["daily_breakdown"]): string {
  const header = [
    "Date",
    "Total Orders",
    "Completed",
    "Attempted",
    "Completion Rate",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const rate = completionPct(row.completed, row.attempted);
    lines.push(
      [
        escapeCsvCell(row.date),
        String(row.total),
        String(row.completed),
        String(row.attempted),
        escapeCsvCell(rate),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function daysInRangeInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00.000Z`);
  const b = new Date(`${to}T12:00:00.000Z`);
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

export function ReportsClient() {
  const def = useMemo(() => defaultLast30(), []);
  const [dateFrom, setDateFrom] = useState(def.from);
  const [dateTo, setDateTo] = useState(def.to);
  const [hasFetched, setHasFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportSummaryDto | null>(null);

  const fetchReport = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/summary?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`,
        { method: "GET", credentials: "same-origin" },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      const json = (await res.json()) as ReportSummaryDto;
      setData(json);
      setHasFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onGenerate = () => {
    void fetchReport(dateFrom, dateTo);
  };

  const applyQuick = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    void fetchReport(from, to);
  };

  const sourceRows = useMemo(() => {
    if (!data) return [];
    const t = data.total_orders;
    const pct = (n: number) =>
      t === 0 ? "0%" : `${Math.round((n / t) * 1000) / 10}%`;
    return [
      { label: "Manual", count: data.orders_by_source.manual, pct: pct(data.orders_by_source.manual) },
      { label: "Shopify", count: data.orders_by_source.shopify, pct: pct(data.orders_by_source.shopify) },
      { label: "Email", count: data.orders_by_source.email, pct: pct(data.orders_by_source.email) },
    ];
  }, [data]);

  const dailyDisplay = useMemo(() => {
    if (!data) return { rows: [] as ReportSummaryDto["daily_breakdown"], showLongNote: false };
    const withActivity = data.daily_breakdown.filter((d) => d.total > 0);
    const sorted = [...withActivity].sort((a, b) => b.date.localeCompare(a.date));
    const rows = sorted.slice(0, 14);
    const rangeDays = daysInRangeInclusive(dateFrom, dateTo);
    const showLongNote = rangeDays > 14 || sorted.length > 14;
    return { rows, showLongNote };
  }, [data, dateFrom, dateTo]);

  const completionDisplay =
    data === null ? "—" : `${Math.round(data.completion_rate)}%`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Order metrics by creation date (UTC).
        </p>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-900">
            Date range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="report-from"
                className="text-sm font-medium text-gray-700"
              >
                From
              </label>
              <Input
                id="report-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px] text-base"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="report-to"
                className="text-sm font-medium text-gray-700"
              >
                To
              </label>
              <Input
                id="report-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px] text-base"
              />
            </div>
            <Button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="text-white"
              style={{ backgroundColor: MAZATI }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Generating…
                </>
              ) : (
                "Generate report"
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-gray-300"
              onClick={() => {
                const r = lastNDaysUtc(7);
                applyQuick(r.from, r.to);
              }}
              disabled={loading}
            >
              Last 7 days
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-300"
              onClick={() => {
                const r = lastNDaysUtc(30);
                applyQuick(r.from, r.to);
              }}
              disabled={loading}
            >
              Last 30 days
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-300"
              onClick={() => {
                const r = thisMonthUtc();
                applyQuick(r.from, r.to);
              }}
              disabled={loading}
            >
              This month
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-300"
              onClick={() => {
                const r = lastMonthUtc();
                applyQuick(r.from, r.to);
              }}
              disabled={loading}
            >
              Last month
            </Button>
          </div>
        </CardContent>
      </Card>

      {!hasFetched && !loading && (
        <p className="text-sm text-gray-600">
          Select a date range and generate a report.
        </p>
      )}

      {error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white"
            />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total orders"
              value={data.total_orders}
              icon={<BarChart3 className="text-gray-500" aria-hidden />}
            />
            <StatsCard
              title="Completed"
              value={data.completed_orders}
              icon={<CheckCircle2 className="text-emerald-600" aria-hidden />}
            />
            <StatsCard
              title="Attempted (no one home)"
              value={data.attempted_orders}
              icon={<XCircle className="text-orange-600" aria-hidden />}
            />
            <StatsCard
              title="Completion rate"
              value={completionDisplay}
              description="Completed ÷ (completed + attempted)"
              icon={<Percent className="text-gray-500" aria-hidden />}
            />
          </div>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Orders by source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">% of total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceRows.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell className="font-medium text-gray-900">
                        {r.label}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.count}
                      </TableCell>
                      <TableCell className="text-right text-gray-600">
                        {r.pct}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Performance by driver
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.orders_by_driver.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No deliveries in this period.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead className="text-right">Total deliveries</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Attempted</TableHead>
                      <TableHead className="text-right">Completion rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders_by_driver.map((d) => (
                      <TableRow key={d.driver_id}>
                        <TableCell className="font-medium text-gray-900">
                          {d.driver_name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.total_deliveries}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.completed}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.attempted}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {Math.round(d.completion_rate)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Daily breakdown
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                className="border-gray-300"
                onClick={() => {
                  if (!data) return;
                  const csv = buildCsv(data.daily_breakdown);
                  downloadCsv(
                    csv,
                    `alaseel-pod-report-${dateFrom}-${dateTo}.csv`,
                  );
                }}
              >
                Export to CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {dailyDisplay.showLongNote ? (
                <p className="text-sm text-gray-500">
                  Showing last 14 days — download CSV for full data.
                </p>
              ) : null}
              {dailyDisplay.rows.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No order activity on any day in this range.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Attempted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyDisplay.rows.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell className="font-medium text-gray-900">
                          {row.date}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.total}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.completed}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.attempted}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

    </div>
  );
}
