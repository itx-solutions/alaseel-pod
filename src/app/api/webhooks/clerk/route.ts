import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";

function normalizeRole(meta: unknown): "back_office" | "driver" {
  return meta === "driver" ? "driver" : "back_office";
}

export async function POST(req: NextRequest) {
  try {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const evt = await verifyWebhook(req, signingSecret ? { signingSecret } : undefined);

    if (evt.type === "user.created") {
      const u = evt.data;
      const role = normalizeRole(
        (u.public_metadata as { role?: string } | null)?.role,
      );
      const email = u.email_addresses?.[0]?.email_address ?? "";
      const name =
        [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
        email ||
        "User";

      const existing = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, u.id))
        .limit(1);
      if (existing.length > 0) {
        return NextResponse.json({ ok: true, skipped: true });
      }

      await getDb().insert(users).values({
        clerkId: u.id,
        role,
        name,
        email,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
