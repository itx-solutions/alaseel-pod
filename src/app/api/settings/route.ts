import {
  jsonBadRequest,
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getSettingsForApi,
  upsertNotificationEmail,
} from "@/lib/data/settings";
import type { PatchSettingsRequestBody } from "@/lib/types/settings";

function isValidEmailFormat(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const settings = await getSettingsForApi();
  return Response.json(settings);
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  let body: PatchSettingsRequestBody;
  try {
    body = (await request.json()) as PatchSettingsRequestBody;
  } catch {
    return jsonBadRequest("Invalid JSON");
  }

  if (body.notification_email !== undefined) {
    const raw = body.notification_email;
    if (typeof raw !== "string") {
      return jsonBadRequest("notification_email must be a string");
    }
    const trimmed = raw.trim();
    if (trimmed !== "" && !isValidEmailFormat(trimmed)) {
      return jsonBadRequest("Invalid email format");
    }
    const normalized = trimmed === "" ? null : trimmed;
    const settings = await upsertNotificationEmail(normalized, user.id);
    return Response.json(settings);
  }

  return jsonBadRequest("No settings to update");
}
