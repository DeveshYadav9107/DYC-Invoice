// ─────────────────────────────────────────────────────────────────
// Server Entrypoint — Starts the Express Server
// ─────────────────────────────────────────────────────────────────

import app from './app.js';
import prisma from './utils/prisma.js';

const PORT = parseInt(process.env.PORT || '5000', 10);

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [InvoiceFlow API] Server running on http://localhost:${PORT}`);
  console.log(`📡 [Environment] ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 [Health Check] http://localhost:${PORT}/api/health`);
  console.log(`======================================================\n`);
});

// Graceful Shutdown
async function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('✅ Database connections closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
