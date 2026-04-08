import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { deliveries, orders, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { ReportSummaryDto } from "@/lib/types/report";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateRange(dateFrom: string, dateTo: string): { start: Date; end: Date } | null {
  if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) return null;
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (start > end) return null;
  return { start, end };
}

/** Inclusive UTC calendar dates between from and to (YYYY-MM-DD strings). */
function eachUtcDateInclusive(dateFrom: string, dateTo: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${dateFrom}T12:00:00.000Z`);
  const end = new Date(`${dateTo}T12:00:00.000Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function completionRate(completed: number, attempted: number): number {
  const den = completed + attempted;
  if (den === 0) return 0;
  return Math.round((completed / den) * 10000) / 100;
}

/**
 * Summary report for back office. All order metrics use `orders.created_at` in [start, end].
 */
export async function getReportSummary(
  dateFrom: string,
  dateTo: string,
): Promise<ReportSummaryDto | null> {
  const range = parseDateRange(dateFrom, dateTo);
  if (!range) return null;

  const { start, end } = range;
  const db = getDb();
  const dateCond = and(gte(orders.createdAt, start), lte(orders.createdAt, end));

  const [totalRow] = await db.select({ n: count() }).from(orders).where(dateCond);
  const total_orders = Number(totalRow?.n ?? 0);

  const [completedRow] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(dateCond, eq(orders.status, "completed")));
  const completed_orders = Number(completedRow?.n ?? 0);

  const [attemptedRow] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(dateCond, eq(orders.status, "attempted")));
  const attempted_orders = Number(attemptedRow?.n ?? 0);

  const [pendingRow] = await db
    .select({ n: count() })
    .from(orders)
    .where(
      and(dateCond, inArray(orders.status, ["pending", "assigned"])),
    );
  const pending_orders = Number(pendingRow?.n ?? 0);

  const [manualRow] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(dateCond, eq(orders.source, "manual")));
  const [shopifyRow] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(dateCond, eq(orders.source, "shopify")));
  const [emailRow] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(dateCond, eq(orders.source, "email")));

  const orders_by_source = {
    manual: Number(manualRow?.n ?? 0),
    shopify: Number(shopifyRow?.n ?? 0),
    email: Number(emailRow?.n ?? 0),
  };

  const driverAgg = await db
    .select({
      driver_id: deliveries.driverId,
      driver_name: users.name,
      total_deliveries: sql<number>`cast(count(*) as int)`,
      completed: sql<number>`coalesce(sum(case when ${orders.status} = 'completed' then 1 else 0 end), 0)::int`,
      attempted: sql<number>`coalesce(sum(case when ${orders.status} = 'attempted' then 1 else 0 end), 0)::int`,
    })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .innerJoin(users, eq(deliveries.driverId, users.id))
    .where(and(dateCond, eq(users.role, "driver")))
    .groupBy(deliveries.driverId, users.name)
    .orderBy(desc(sql`count(*)`));

  const orders_by_driver = driverAgg.map((row) => {
    const c = Number(row.completed ?? 0);
    const a = Number(row.attempted ?? 0);
    return {
      driver_id: row.driver_id,
      driver_name: row.driver_name,
      total_deliveries: Number(row.total_deliveries ?? 0),
      completed: c,
      attempted: a,
      completion_rate: completionRate(c, a),
    };
  });

  const dailyRows = await db
    .select({
      date: sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      total: sql<number>`cast(count(*) as int)`,
      completed: sql<number>`coalesce(sum(case when ${orders.status} = 'completed' then 1 else 0 end), 0)::int`,
      attempted: sql<number>`coalesce(sum(case when ${orders.status} = 'attempted' then 1 else 0 end), 0)::int`,
    })
    .from(orders)
    .where(dateCond)
    .groupBy(sql`to_char(${orders.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

  const byDay = new Map<
    string,
    { total: number; completed: number; attempted: number }
  >();
  for (const r of dailyRows) {
    const d = String(r.date).trim();
    byDay.set(d, {
      total: Number(r.total ?? 0),
      completed: Number(r.completed ?? 0),
      attempted: Number(r.attempted ?? 0),
    });
  }

  const days = eachUtcDateInclusive(dateFrom, dateTo);
  const daily_breakdown = days.map((date) => {
    const v = byDay.get(date);
    return {
      date,
      total: v?.total ?? 0,
      completed: v?.completed ?? 0,
      attempted: v?.attempted ?? 0,
    };
  });

  return {
    total_orders,
    completed_orders,
    attempted_orders,
    pending_orders,
    completion_rate: completionRate(completed_orders, attempted_orders),
    orders_by_source,
    orders_by_driver,
    daily_breakdown,
  };
}
