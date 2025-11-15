import 'dotenv/config';
import { prisma } from '../lib/prisma';

const SCHEDULER_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
let isShuttingDown = false;

async function checkAndScheduleCampaigns() {
  if (isShuttingDown) return;

  console.log('[call-scheduler] Checking active campaigns...');

  try {
    // TODO: Implement campaign checking logic here
    // Example:
    // 1. Find active campaigns that need processing
    // 2. Generate call tasks for those campaigns
    // 3. Enqueue tasks to callTaskQueue

    console.log('[call-scheduler] Campaign check completed');
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
    await new Promise(resolve => setTimeout(resolve, SCHEDULER_INTERVAL_MS));

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
