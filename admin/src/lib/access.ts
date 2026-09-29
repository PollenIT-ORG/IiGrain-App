import type { UserRole } from "../types";
import { unscopedPath } from "./programScope";

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
  // Their own assessment templates and the questions of their programs; what they may change is checked per template.
  "/assessments",
  "/farms",
  "/fields",
  "/users",
  "/settings",
  "/profile",
  "/notifications",
  // They answer producers day to day, so the enquiries reach them too. Writing
  // the help content stays with the platform team, so /faqs is not here.
  "/contact-enquiries",
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
  const real = unscopedPath(path);
  return PROGRAM_ADMIN_PATHS.some(
    (allowed) => real === allowed || real.startsWith(`${allowed}/`)
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
