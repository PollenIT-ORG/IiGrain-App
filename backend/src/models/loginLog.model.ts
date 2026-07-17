import prisma from "../db/prisma.js";
import type { LoginMethod, LoginStatus, LoginLog } from "../types/index.js";

interface RecordLoginParams {
  userId: string | null;
  email: string;
  method: LoginMethod;
  status: LoginStatus;
  ipAddress: string | null;
  userAgent: string | null;
  reason: string | null;
}

export async function recordLogin(params: RecordLoginParams): Promise<void> {
  await prisma.login_logs.create({
    data: {
      user_id: params.userId,
      email: params.email,
      method: params.method,
      status: params.status,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      reason: params.reason,
    },
  });
}

export type LoginLogRow = Pick<
  LoginLog,
  "id" | "email" | "method" | "status" | "ip_address" | "reason" | "created_at"
>;

export async function listLoginLogs(
  limit: number,
  offset: number
): Promise<{ rows: LoginLogRow[]; total: number }> {
  const where = { deleted_at: null };
  const [rows, total] = await Promise.all([
    prisma.login_logs.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        email: true,
        method: true,
        status: true,
        ip_address: true,
        reason: true,
        created_at: true,
      },
    }),
    prisma.login_logs.count({ where }),
  ]);

  return { rows: rows as LoginLogRow[], total };
}
