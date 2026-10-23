// ─────────────────────────────────────────────────────────────────
// Prisma Client Singleton
// Caches Prisma Client across serverless function re-invocations
// ─────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Always store on globalThis so serverless warm instances reuse the connection pool
globalForPrisma.prisma = prisma;

export default prisma;

