import { eq } from "drizzle-orm";
import { platformSettings } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { SettingsResponseDto } from "@/lib/types/settings";

export const SETTING_KEY_NOTIFICATION_EMAIL = "notification_email";

/**
 * When delivery completion notification email is implemented (e.g. in
 * `lib/notifications.ts`), resolve the recipient with `getBackOfficeNotificationEmail()`
 * instead of reading `process.env.EMAIL_BACK_OFFICE_ADDRESS` directly. That helper
 * prefers the `notification_email` row in `platform_settings`, then falls back to the
 * env var for backward compatibility.
 */

function normalizeEmailValue(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

export async function getSettingsForApi(): Promise<SettingsResponseDto> {
  const db = getDb();
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, SETTING_KEY_NOTIFICATION_EMAIL))
    .limit(1);

  return {
    notification_email: normalizeEmailValue(row?.value ?? null),
  };
}

/**
 * Resolves the back office email for delivery alerts: database first, then
 * `EMAIL_BACK_OFFICE_ADDRESS`.
 */
export async function getBackOfficeNotificationEmail(): Promise<string | null> {
  const { notification_email } = await getSettingsForApi();
  if (notification_email) return notification_email;
  const env = process.env.EMAIL_BACK_OFFICE_ADDRESS?.trim();
  return env && env.length > 0 ? env : null;
}

export async function upsertNotificationEmail(
  email: string | null,
  updatedByUserId: string,
): Promise<SettingsResponseDto> {
  const db = getDb();
  const value = email === null ? "" : email.trim();

  await db
    .insert(platformSettings)
    .values({
      key: SETTING_KEY_NOTIFICATION_EMAIL,
      value,
      updatedBy: updatedByUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value,
        updatedBy: updatedByUserId,
        updatedAt: new Date(),
      },
    });

  return getSettingsForApi();
}
