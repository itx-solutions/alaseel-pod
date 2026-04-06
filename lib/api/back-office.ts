import type { AuthenticatedUser } from "@/lib/auth";

export function requireBackOfficeUser(
  user: AuthenticatedUser | null,
): user is AuthenticatedUser {
  return user !== null && user.role === "back_office";
}

export function jsonUnauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function jsonForbidden(): Response {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

export function jsonBadRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function jsonNotFound(): Response {
  return Response.json({ error: "Not found" }, { status: 404 });
}
