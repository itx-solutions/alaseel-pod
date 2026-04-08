import {
  jsonForbidden,
  jsonUnauthorized,
} from "@/lib/api/back-office";
import { requireDriverUser } from "@/lib/api/driver";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDriverOwnProfile } from "@/lib/data/drivers";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireDriverUser(user)) return jsonForbidden();

  const profile = await getDriverOwnProfile(user.id);
  if (!profile) return jsonForbidden();

  return Response.json(profile);
}
