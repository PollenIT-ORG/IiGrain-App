import type { UserRole } from "../types";

// What each role is allowed to work with. A program administrator runs their
// own programs: the programs themselves, their surveys and submissions, and
// the assessors and farmers taking part. Everything else belongs to the
// platform team.

const PROGRAM_ADMIN_PATHS = [
  "/dashboard",
  "/programs",
  "/submissions",
  "/surveys",
  "/survey-submissions",
  "/farms",
  "/fields",
  "/users",
  "/settings",
  "/profile",
  "/notifications",
];

/** The user roles a role may look after. */
export const MANAGED_ROLES: Record<string, UserRole[]> = {
  program_administrator: ["assessor", "farmer"],
};

export function isProgramAdmin(role: string | undefined): boolean {
  return role === "program_administrator";
}

/** True when a role may open a page. */
export function canOpen(role: string | undefined, path: string): boolean {
  if (!isProgramAdmin(role)) return true;
  return PROGRAM_ADMIN_PATHS.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`)
  );
}

/** Where a role starts. */
export function homePath(): string {
  return "/dashboard";
}

/** True when the settings page is only about this person's own account. */
export function accountSettingsOnly(role: string | undefined): boolean {
  return isProgramAdmin(role);
}

/** The user groups a role sees under Users. */
export function managedRoles(role: string | undefined, all: UserRole[]): UserRole[] {
  const allowed = MANAGED_ROLES[role ?? ""];
  return allowed ? all.filter((r) => allowed.includes(r)) : all;
}
