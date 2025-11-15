import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { call_tasks } from '@prisma/client';
import { enqueueCallTasks } from '../queues/callTaskQueue';

const SCHEDULE_WINDOW_MINUTES = 1; // 1 minutes
let isShuttingDown = false;
const GLOBAL_MAX_CONCURRENT_CALLS = 50;

async function checkAndScheduleCampaigns() {
  if (isShuttingDown) return;

  console.log('[call-scheduler] Checking active campaigns...');

  try {
    // 1. Find active campaigns that need processing
    // 2. Enqueue tasks to callTaskQueue

    // This SQL query is the core of the atomic claiming logic.
    // It finds, locks, updates, and returns the tasks in a single, non-blocking operation.
    const callsToRun = await prisma.$queryRaw<call_tasks[]>`
    UPDATE call_tasks
    SET status = 'in-progress', updated_at = NOW()
    WHERE id IN (
        SELECT ct.id FROM call_tasks ct
        JOIN call_campaigns cc ON ct.campaign_id = cc.id
        WHERE cc.is_paused = FALSE
        AND ct.status = 'pending'
        AND ct.scheduled_at <= NOW() + INTERVAL '${SCHEDULE_WINDOW_MINUTES + 1} minutes'
        ORDER BY ct.scheduled_at ASC
        LIMIT ${GLOBAL_MAX_CONCURRENT_CALLS}
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
    `;

    if (callsToRun.length === 0) {
      console.log('[call-scheduler] No tasks to claim');
      return;
    }

    await enqueueCallTasks(callsToRun.map((callTask) => ({ callTaskId: callTask.id })));
    console.log(`[call-scheduler] ${callsToRun.length} tasks claimed and enqueued`);
  } catch (error) {
    console.error('[call-scheduler] Error checking campaigns:', error);
  }
}

async function main() {
  console.log('[call-scheduler] Starting scheduler (runs every 2 minutes)...');

  // Run immediately on startup
  await checkAndScheduleCampaigns();

  // Then run every 2 minutes
  while (!isShuttingDown) {
    await new Promise(resolve => setTimeout(resolve, SCHEDULE_WINDOW_MINUTES * 60 * 1000));

    if (!isShuttingDown) {
      await checkAndScheduleCampaigns();
    }
  }

  console.log('[call-scheduler] Scheduler loop ended');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[call-scheduler] SIGTERM received, shutting down gracefully...');
  isShuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[call-scheduler] SIGINT received, shutting down gracefully...');
  isShuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('[call-scheduler] Unhandled rejection:', error);
});

// Start the scheduler
main().catch((error) => {
  console.error('[call-scheduler] Fatal error:', error);
  process.exit(1);
});
