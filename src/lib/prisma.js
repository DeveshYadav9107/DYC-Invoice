// ─────────────────────────────────────────────────────────────────
// Prisma Client Singleton
// Re-uses a single Prisma Client across hot-reloads in development
// ─────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

/**
 * Why a singleton?
 * In Next.js development, files are re-imported on every hot reload.
 * Without this pattern, each reload would create a NEW database connection,
 * quickly exhausting the connection pool.
 * 
 * We store the client on `globalThis` (which survives hot reloads)
 * so only one client ever exists in development.
 */

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
