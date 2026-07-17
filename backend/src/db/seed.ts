import bcrypt from "bcryptjs";
import prisma from "./prisma.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import type { RoleName } from "../types/index.js";

const ROLES: Array<{ name: RoleName; description: string }> = [
  { name: "super_admin", description: "Platform owner with full access across all organizations." },
  { name: "admin", description: "Full administrative access within the platform/organization." },
  { name: "program_administrator", description: "Manages assessors, farmers and farms within an organization on the admin's behalf." },
  { name: "program_partner", description: "Partner organization running a program." },
  { name: "assessor", description: "Evaluates farms / applications." },
  { name: "farmer", description: "End user who owns/operates a farm." },
];

const SALT_ROUNDS = 10;

export async function runSeed(): Promise<void> {
  logger.info("DB_SEED enabled - seeding baseline data...");

  let inserted = 0;
  for (const role of ROLES) {
    const res = await prisma.roles.upsert({
      where: { name: role.name },
      update: {},
      create: { name: role.name, description: role.description },
    });
    void res;
    inserted += 1;
  }
  logger.info(`Roles ensured (${ROLES.length} total).`);

  await seedSuperAdmin();
}

async function seedSuperAdmin(): Promise<void> {
  const superRole = await prisma.roles.findFirst({
    where: { name: "super_admin", deleted_at: null },
    select: { id: true },
  });
  if (!superRole) {
    logger.warn("super_admin role missing - skipping super admin bootstrap.");
    return;
  }

  const existing = await prisma.users.findFirst({
    where: { role_id: superRole.id, deleted_at: null },
    select: { id: true },
  });
  if (existing) {
    logger.info("Super admin already exists - bootstrap skipped.");
    return;
  }

  const passwordHash = await bcrypt.hash(env.superAdmin.password, SALT_ROUNDS);
  await prisma.users.create({
    data: {
      role_id: superRole.id,
      full_name: env.superAdmin.fullName,
      email: env.superAdmin.email,
      password_hash: passwordHash,
      is_active: true,
      is_email_verified: true,
    },
  });
  logger.info(`Super admin created: ${env.superAdmin.email}`);
}
