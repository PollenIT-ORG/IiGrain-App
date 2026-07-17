import type { RoleName } from "../types/index.js";

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  PROGRAM_ADMINISTRATOR: "program_administrator",
  PROGRAM_PARTNER: "program_partner",
  ASSESSOR: "assessor",
  FARMER: "farmer",
} as const satisfies Record<string, RoleName>;

export const ORG_MANAGER_ROLES: RoleName[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.PROGRAM_ADMINISTRATOR,
];

export const ADMIN_LEVEL_ROLES: RoleName[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

const CREATABLE_BY: Partial<Record<RoleName, RoleName[]>> = {
  super_admin: [
    ROLES.ADMIN,
    ROLES.PROGRAM_ADMINISTRATOR,
    ROLES.PROGRAM_PARTNER,
    ROLES.ASSESSOR,
    ROLES.FARMER,
  ],
  admin: [
    ROLES.PROGRAM_ADMINISTRATOR,
    ROLES.PROGRAM_PARTNER,
    ROLES.ASSESSOR,
    ROLES.FARMER,
  ],
  program_administrator: [ROLES.ASSESSOR, ROLES.FARMER],
};

export function canCreateRole(
  actorRole: string,
  targetRole: string
): boolean {
  const allowed = CREATABLE_BY[actorRole as RoleName];
  return allowed ? allowed.includes(targetRole as RoleName) : false;
}

export function isOrgManager(role: string): boolean {
  return ORG_MANAGER_ROLES.includes(role as RoleName);
}

export function isAdminLevel(role: string): boolean {
  return ADMIN_LEVEL_ROLES.includes(role as RoleName);
}

export function isSuperAdmin(role: string): boolean {
  return role === ROLES.SUPER_ADMIN;
}
