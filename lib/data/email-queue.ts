import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { emailQueue, orders, users } from "@/db/schema";
import { getDb, getDbFromWorkerEnv, type HyperdriveEnv } from "@/lib/db";
import type { OrderItemLine } from "@/lib/types/order";
import type {
  EmailQueueDetailDto,
  EmailQueueEntryStatus,
  EmailQueueListRowDto,
  PaginatedEmailQueueResponse,
  ParsedEmailConfidence,
  ParsedEmailData,
  PostEmailQueueApproveBody,
} from "@/lib/types/email";

const PAGE_SIZE = 50;

const reviewerUser = alias(users, "email_reviewer");

function toIso(d: Date): string {
  return d.toISOString();
}

function parseParsedData(
  raw: Record<string, unknown> | null | undefined,
): ParsedEmailData | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw.confidence;
  if (c !== "high" && c !== "medium" && c !== "low") return null;
  const itemsRaw = raw.items;
  let items: ParsedEmailData["items"] = null;
  if (Array.isArray(itemsRaw)) {
    const lines: Array<{ name: string; quantity: number }> = [];
    for (const row of itemsRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : "";
      const q = typeof r.quantity === "number" ? r.quantity : Number(r.quantity);
      if (!name.trim() || !Number.isFinite(q) || q < 1) continue;
      lines.push({ name: name.trim(), quantity: Math.floor(q) });
    }
    items = lines.length ? lines : null;
  }
  const st = raw.source_type;
  const sourceType =
    st === "email_body" || st === "pdf_attachment" ? st : undefined;

  return {
    recipient_name:
      typeof raw.recipient_name === "string" ? raw.recipient_name : null,
    delivery_address:
      typeof raw.delivery_address === "string" ? raw.delivery_address : null,
    recipient_phone:
      typeof raw.recipient_phone === "string" ? raw.recipient_phone : null,
    recipient_email:
      typeof raw.recipient_email === "string" ? raw.recipient_email : null,
    items,
    special_instructions:
      typeof raw.special_instructions === "string"
        ? raw.special_instructions
        : null,
    confidence: c,
    ...(function orderRef(): { order_reference?: string | null } {
      if (!("order_reference" in raw)) return {};
      const v = raw.order_reference;
      if (typeof v === "string" || v === null) return { order_reference: v };
      return {};
    })(),
    ...(sourceType ? { source_type: sourceType } : {}),
    ...(typeof raw._created_order_id === "string"
      ? { _created_order_id: raw._created_order_id }
      : {}),
  };
}

function confidenceFromRow(
  parsed: Record<string, unknown> | null | undefined,
): ParsedEmailConfidence | null {
  if (!parsed) return null;
  const c = parsed.confidence;
  if (c === "high" || c === "medium" || c === "low") return c;
  return null;
}

export async function insertInboundEmailQueueRow(
  input: {
    rawFrom: string;
    rawSubject: string;
    rawBody: string;
    parsedData: ParsedEmailData | null;
  },
  workerEnv?: HyperdriveEnv,
): Promise<void> {
  const db = workerEnv ? getDbFromWorkerEnv(workerEnv) : getDb();
  const raw = input.parsedData as unknown;
  const parsedDataForDb: Record<string, unknown> | null =
    raw == null || raw === ""
      ? null
      : typeof raw === "object"
        ? ({ ...raw } as Record<string, unknown>)
        : null;
  // Only these columns: omit id/createdAt (DB defaults), reviewedAt/reviewedBy (nullable, no DB default — Postgres stores NULL when omitted).
  const insertRow = {
    rawFrom: input.rawFrom,
    rawSubject: input.rawSubject,
    rawBody: input.rawBody,
    parsedData:
      parsedDataForDb === null ? sql`NULL` : parsedDataForDb,
    // neon-http: bind enum as `text::email_queue_status` so Postgres accepts the cast
    status: sql`${"pending_review"}::${sql.raw("email_queue_status")}`,
  };
  try {
    await db.insert(emailQueue).values(insertRow);
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    console.error(
      "Insert failed - postgres error:",
      JSON.stringify(
        {
          message: e?.message,
          code: e?.code,
          detail: e?.detail,
          hint: e?.hint,
          constraint: e?.constraint,
          severity: e?.severity,
          routine: e?.routine,
        },
        null,
        2,
      ),
    );
    throw err;
  }
}

function buildListWhere(opts: {
  status?: string;
  search?: string;
}): SQL | undefined {
  const parts: SQL[] = [];
  if (opts.status && opts.status !== "all") {
    parts.push(
      eq(emailQueue.status, opts.status as EmailQueueEntryStatus),
    );
  }
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    parts.push(
      or(
        ilike(emailQueue.rawFrom, q),
        ilike(emailQueue.rawSubject, q),
      ) as SQL,
    );
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export async function listEmailQueueEntries(params: {
  page: number;
  status?: string;
  search?: string;
}): Promise<PaginatedEmailQueueResponse> {
  const db = getDb();
  const page = Math.max(1, params.page);
  const whereClause = buildListWhere({
    status: params.status,
    search: params.search,
  });

  const countBase = db.select({ total: count() }).from(emailQueue);
  const [countRow] = whereClause
    ? await countBase.where(whereClause)
    : await countBase;

  const total = Number(countRow?.total ?? 0);
  const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const listBase = db
    .select({ row: emailQueue })
    .from(emailQueue)
    .orderBy(desc(emailQueue.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const rows = whereClause
    ? await listBase.where(whereClause)
    : await listBase;

  const items: EmailQueueListRowDto[] = rows.map((r) => {
    const pd = r.row.parsedData as Record<string, unknown> | null | undefined;
    return {
      id: r.row.id,
      raw_from: r.row.rawFrom,
      raw_subject: r.row.rawSubject,
      created_at: toIso(r.row.createdAt),
      confidence: confidenceFromRow(pd),
      status: r.row.status,
    };
  });

  return {
    items,
    page,
    page_size: PAGE_SIZE,
    total,
    total_pages,
  };
}

export async function getEmailQueueEntry(
  id: string,
): Promise<EmailQueueDetailDto | null> {
  const db = getDb();
  const [row] = await db
    .select({
      entry: emailQueue,
      reviewerName: reviewerUser.name,
    })
    .from(emailQueue)
    .leftJoin(reviewerUser, eq(emailQueue.reviewedBy, reviewerUser.id))
    .where(eq(emailQueue.id, id))
    .limit(1);

  if (!row) return null;

  const e = row.entry;
  const pd = e.parsedData as Record<string, unknown> | null | undefined;
  return {
    id: e.id,
    raw_from: e.rawFrom,
    raw_subject: e.rawSubject,
    raw_body: e.rawBody,
    parsed_data: parseParsedData(pd ?? null),
    status: e.status,
    reviewed_at: e.reviewedAt ? toIso(e.reviewedAt) : null,
    reviewer_name: row.reviewerName,
    created_at: toIso(e.createdAt),
  };
}

function mergeApproveFields(
  parsed: ParsedEmailData | null,
  overrides: PostEmailQueueApproveBody | undefined,
): {
  recipientName: string;
  deliveryAddress: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  items: OrderItemLine[];
  specialInstructions: string | null;
} | null {
  const p = parsed;
  const recipientName = (
    overrides?.recipient_name ??
    p?.recipient_name ??
    ""
  ).trim();
  const deliveryAddress = (
    overrides?.delivery_address ??
    p?.delivery_address ??
    ""
  ).trim();
  const recipientPhone =
    overrides?.recipient_phone !== undefined
      ? overrides.recipient_phone?.trim() || null
      : p?.recipient_phone?.trim() || null;
  const recipientEmail =
    overrides?.recipient_email !== undefined
      ? overrides.recipient_email?.trim() || null
      : p?.recipient_email?.trim() || null;

  let items: OrderItemLine[] = [];
  if (overrides?.items && overrides.items.length > 0) {
    items = overrides.items
      .map((l) => ({
        name: l.name.trim(),
        quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
      }))
      .filter((l) => l.name.length > 0);
  } else if (p?.items && p.items.length > 0) {
    items = p.items.map((l) => ({
      name: l.name.trim(),
      quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
    }));
  }

  const specialInstructions =
    overrides?.special_instructions !== undefined
      ? overrides.special_instructions?.trim() || null
      : p?.special_instructions?.trim() || null;

  if (!recipientName || !deliveryAddress || items.length === 0) {
    return null;
  }

  return {
    recipientName,
    deliveryAddress,
    recipientPhone,
    recipientEmail,
    items,
    specialInstructions,
  };
}

export async function approveEmailQueueEntry(
  queueId: string,
  userId: string,
  overrides?: PostEmailQueueApproveBody,
): Promise<{ orderId: string } | null> {
  const db = getDb();
  const [q] = await db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.id, queueId))
    .limit(1);

  if (!q || q.status !== "pending_review") return null;

  const parsed = parseParsedData(
    q.parsedData as Record<string, unknown> | null | undefined,
  );
  const merged = mergeApproveFields(parsed, overrides);
  if (!merged) return null;

  // Sequential writes — neon-http has no transaction (see lib/db.ts).
  const [inserted] = await db
    .insert(orders)
    .values({
      source: "email",
      recipientName: merged.recipientName,
      recipientPhone: merged.recipientPhone,
      recipientEmail: merged.recipientEmail,
      deliveryAddress: merged.deliveryAddress,
      items: merged.items,
      specialInstructions: merged.specialInstructions,
      status: "pending",
    })
    .returning({ id: orders.id });

  if (!inserted) return null;

  const newParsed: Record<string, unknown> = {
    recipient_name: merged.recipientName,
    delivery_address: merged.deliveryAddress,
    recipient_phone: merged.recipientPhone,
    recipient_email: merged.recipientEmail,
    items: merged.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
    })),
    special_instructions: merged.specialInstructions,
    confidence: parsed?.confidence ?? "medium",
    _created_order_id: inserted.id,
    ...(parsed?.order_reference !== undefined && parsed?.order_reference !== null
      ? { order_reference: parsed.order_reference }
      : {}),
    ...(parsed?.source_type
      ? { source_type: parsed.source_type }
      : {}),
  };

  await db
    .update(emailQueue)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: userId,
      parsedData: newParsed,
    })
    .where(eq(emailQueue.id, queueId));

  return { orderId: inserted.id };
}

export async function rejectEmailQueueEntry(
  queueId: string,
  userId: string,
): Promise<EmailQueueDetailDto | null> {
  const db = getDb();
  const [q] = await db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.id, queueId))
    .limit(1);

  if (!q || q.status !== "pending_review") return null;

  await db
    .update(emailQueue)
    .set({
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy: userId,
    })
    .where(eq(emailQueue.id, queueId));

  return getEmailQueueEntry(queueId);
}

export async function countPendingEmailQueue(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(emailQueue)
    .where(eq(emailQueue.status, "pending_review"));
  return Number(row?.n ?? 0);
}
