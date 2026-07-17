import { PrismaClient } from "@prisma/client";
import env from "../config/env.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ["error"] : ["error", "warn"],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
