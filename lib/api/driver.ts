import type { AuthenticatedUser } from "@/lib/auth";

export function requireDriverUser(
  user: AuthenticatedUser | null,
): user is AuthenticatedUser {
  return user !== null && user.role === "driver";
}
