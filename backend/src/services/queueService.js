// ─────────────────────────────────────────────────────────────────
// BullMQ Queue & Worker Service
// Asynchronous background job processing with Redis (optional)
// ─────────────────────────────────────────────────────────────────

import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { processUploadedInvoice } from './invoiceService.js';

const QUEUE_NAME = 'invoice-processing';
const REDIS_URL = process.env.REDIS_URL;

let connection = null;

if (REDIS_URL) {
  try {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        return Math.min(times * 500, 3000);
      },
    });
    console.log('✅ [BullMQ] Connected to Redis queue server.');
  } catch (err) {
    console.warn('⚠️ [BullMQ] Redis connection failed:', err.message);
  }
} else {
  console.log('ℹ️ [BullMQ] REDIS_URL not set. Running invoice processing directly in-process.');
}

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

export function startInvoiceWorker() {
  if (!connection) {
    console.warn('⚠️ [BullMQ Worker] Redis connection unavailable — worker cannot start.');
    return null;
  }

  console.log(`🚀 [BullMQ Worker] Starting invoice processing worker for queue "${QUEUE_NAME}"...`);

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

// Auto-start worker if executed directly as standalone process
if (process.argv[1]?.endsWith('queueService.js')) {
  startInvoiceWorker();
}
