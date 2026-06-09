import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

import { resolveDatabaseUrl } from "./db-url";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasourceUrl: resolveDatabaseUrl(env.DATABASE_URL),
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

// Reuse one client per serverless isolate (dev + production).
globalForPrisma.prisma = db;
