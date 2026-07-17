import prisma from "../db/prisma.js";

interface OtpRow {
  id: string;
  email: string;
  code: string;
  expires_at: Date;
  consumed_at: Date | null;
}

export async function createOtp(
  email: string,
  code: string,
  expiresAt: Date
): Promise<void> {
  await prisma.otp_codes.create({
    data: { email, code, expires_at: expiresAt },
  });
}

export async function findActiveOtp(email: string): Promise<OtpRow | null> {
  const row = await prisma.otp_codes.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      consumed_at: null,
      expires_at: { gt: new Date() },
      deleted_at: null,
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      email: true,
      code: true,
      expires_at: true,
      consumed_at: true,
    },
  });
  return row ?? null;
}

export async function consumeOtp(id: string): Promise<void> {
  await prisma.otp_codes.updateMany({
    where: { id },
    data: { consumed_at: new Date() },
  });
}
