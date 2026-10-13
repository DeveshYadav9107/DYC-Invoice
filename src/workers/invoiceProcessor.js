// ─────────────────────────────────────────────────────────────────
// BullMQ Invoice Processing Worker Process
// Consumes async invoice jobs from Redis queue
// ─────────────────────────────────────────────────────────────────

import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { processUploadedInvoice } from '../services/invoiceProcessor.js';

const QUEUE_NAME = 'invoice-processing';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection = null;

try {
  connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 500, 3000);
      return delay;
    },
  });
} catch (err) {
  console.warn('⚠️ [BullMQ] Redis connection could not be initialized:', err.message);
}

// Queue export for producers
export const invoiceQueue = connection
  ? new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  : null;

/**
 * Starts the standalone BullMQ worker process.
 */
export function startInvoiceWorker() {
  if (!connection) {
    console.warn('⚠️ [BullMQ Worker] Cannot start worker: Redis connection unavailable.');
    return null;
  }

  console.log(`🚀 [BullMQ Worker] Starting invoice processing worker for queue: "${QUEUE_NAME}"...`);

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { invoiceId } = job.data;
      console.log(`📥 [Job ${job.id}] Processing invoice: ${invoiceId}`);

      const result = await processUploadedInvoice(invoiceId);

      if (!result.success) {
        throw new Error(result.error || 'Invoice processing failed');
      }

      console.log(`✅ [Job ${job.id}] Finished invoice: ${invoiceId}`);
      return result;
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`🎉 [Job ${job.id}] Completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [Job ${job.id}] Failed: ${err.message}`);
  });

  return worker;
}

// Auto-start if run directly from CLI
if (process.argv[1]?.endsWith('invoiceProcessor.js')) {
  startInvoiceWorker();
}
