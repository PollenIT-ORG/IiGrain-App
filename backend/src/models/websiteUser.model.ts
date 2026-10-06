import prisma from "../db/prisma.js";

// Producers who take a program survey. Kept separate from `users` so a lead
// who never qualifies is not an app user.

export interface PublicWebsiteUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_email_verified: boolean;
  created_at: Date;
}

const SELECT = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  is_email_verified: true,
  created_at: true,
};

export interface CreateWebsiteUserParams {
  fullName: string;
  email: string;
  passwordHash: string;
  phone: string | null;
}

export async function createWebsiteUser(
  p: CreateWebsiteUserParams
): Promise<PublicWebsiteUser> {
  return prisma.website_users.create({
    data: {
      full_name: p.fullName,
      email: p.email,
      password_hash: p.passwordHash,
      phone: p.phone,
    },
    select: SELECT,
  });
}

export async function findWebsiteUserByEmailPublic(
  email: string
): Promise<PublicWebsiteUser | null> {
  return prisma.website_users.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deleted_at: null },
    select: SELECT,
  });
}

/**
 * Keeps a producer's details current when they fill in a survey again. Without
 * this the phone/name captured on a later survey would be dropped, because the
 * account already exists from their first one.
 */
export async function updateWebsiteUserDetails(
  id: string,
  p: { fullName?: string; phone?: string | null }
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (p.fullName) data.full_name = p.fullName;
  // Only overwrite the stored phone when a new one was given.
  if (p.phone) data.phone = p.phone;
  if (Object.keys(data).length === 0) return;
  await prisma.website_users.updateMany({
    where: { id, deleted_at: null },
    data: { ...data, updated_at: new Date() },
  });
}
