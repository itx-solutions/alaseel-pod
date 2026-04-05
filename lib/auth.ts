import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";

export type UserRole = "back_office" | "driver";

export type AuthenticatedUser = typeof users.$inferSelect;

function normalizeRole(meta: unknown): UserRole {
  return meta === "driver" ? "driver" : "back_office";
}

/**
 * Returns the signed-in Clerk user mapped to the local `users` row (including role), or null.
 */
export async function getAuthenticatedUser(
  request?: Request,
): Promise<AuthenticatedUser | null> {
  void request;
  const { userId } = await auth();
  if (!userId) return null;
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Ensures a `users` row exists for the current Clerk session (first sign-in upsert).
 */
export async function ensureUserRecord(): Promise<AuthenticatedUser> {
  const cu = await currentUser();
  if (!cu) {
    throw new Error("Unauthorized");
  }
  const role = normalizeRole(cu.publicMetadata?.role);
  const name =
    cu.fullName?.trim() ||
    cu.username ||
    cu.primaryEmailAddress?.emailAddress ||
    "User";
  const email = cu.primaryEmailAddress?.emailAddress ?? "";

  const [existing] = await getDb()
    .select()
    .from(users)
    .where(eq(users.clerkId, cu.id))
    .limit(1);
  if (existing) return existing;

  const [created] = await getDb()
    .insert(users)
    .values({
      clerkId: cu.id,
      role,
      name,
      email,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create user record");
  }
  return created;
}
