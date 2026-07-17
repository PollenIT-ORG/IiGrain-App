import { randomBytes } from "node:crypto";
import prisma from "../db/prisma.js";
import env from "../config/env.js";

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + env.refreshToken.expiryDays * 24 * 60 * 60 * 1000
  );
  await prisma.refresh_tokens.create({
    data: { user_id: userId, token, expires_at: expiresAt },
  });
  return token;
}

export async function findValidRefreshToken(
  token: string
): Promise<RefreshTokenRow | null> {
  const row = await prisma.refresh_tokens.findFirst({
    where: { token, expires_at: { gt: new Date() } },
    select: { id: true, user_id: true, token: true, expires_at: true },
  });
  return row ?? null;
}

export async function revokeRefreshToken(token: string): Promise<boolean> {
  const { count } = await prisma.refresh_tokens.deleteMany({
    where: { token },
  });
  return count > 0;
}

export async function revokeAllForUser(userId: string): Promise<number> {
  const { count } = await prisma.refresh_tokens.deleteMany({
    where: { user_id: userId },
  });
  return count;
}
