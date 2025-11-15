import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { CallJobData } from '../queues/callQueue';

const worker = new Worker<CallJobData>(
  'call-tasks',
  async (job: Job<CallJobData>) => {
    console.log(`[Worker] Processing job ${job.id} for task ${job.data.taskId}`);

    const { taskId, campaignId, phoneNumberId, phoneNumber, userId } = job.data;

    try {
      // Fetch the call task
      const callTask = await prisma.call_tasks.findUnique({
        where: { id: taskId },
        include: {
          campaigns: true,
          phone_numbers: true,
        },
      });

      if (!callTask) {
        console.error(`[Worker] Call task ${taskId} not found`);
        throw new Error(`Call task ${taskId} not found`);
      }

      // Check if task is already completed or in progress
      if (callTask.status === 'completed') {
        console.log(`[Worker] Task ${taskId} already completed, skipping`);
        return { status: 'skipped', reason: 'already_completed' };
      }

      // Update task status to in-progress
      await prisma.call_tasks.update({
        where: { id: taskId },
        data: { status: 'in_progress', updated_at: new Date() },
      });

      // Create call log entry
      const callLog = await prisma.call_logs.create({
        data: {
          user_id: userId,
          call_task_id: taskId,
          phone_number_id: phoneNumberId,
          dialed_number: phoneNumber,
          status: 'initiated',
          started_at: new Date(),
        },
      });

      console.log(`[Worker] Created call log ${callLog.id} for ${phoneNumber}`);

      // ==============================================================
      // TODO: Replace this with actual call service integration
      // Examples: Twilio, Plivo, Vonage, Amazon Connect, etc.
      // ==============================================================
      
      // Simulate call processing
      await simulateCall(phoneNumber);

      // Update call log with success
      await prisma.call_logs.update({
        where: { id: callLog.id },
        data: {
          status: 'completed',
          ended_at: new Date(),
        },
      });

      // Update task status to completed
      await prisma.call_tasks.update({
        where: { id: taskId },
        data: { status: 'completed', updated_at: new Date() },
      });

      // Update campaign stats
      await prisma.call_campaigns.update({
        where: { id: campaignId },
        data: {
          completed_tasks: { increment: 1 },
          updated_at: new Date(),
        },
      });

      console.log(`[Worker] Successfully completed call task ${taskId}`);

      return { status: 'success', callLogId: callLog.id };
    } catch (error) {
      console.error(`[Worker] Error processing call task ${taskId}:`, error);

      // Update task status to failed
      await prisma.call_tasks.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          retry_count: { increment: 1 },
          updated_at: new Date(),
        },
      });

      // Update campaign stats
      await prisma.call_campaigns.update({
        where: { id: campaignId },
        data: {
          failed_tasks: { increment: 1 },
          retries_attempted: { increment: 1 },
          updated_at: new Date(),
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // per second
    },
  }
);

// Simulate a call (replace with actual call service)
async function simulateCall(phoneNumber: string): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate 90% success rate
      if (Math.random() < 0.9) {
        console.log(`[Simulator] Call to ${phoneNumber} completed successfully`);
        resolve();
      } else {
        console.log(`[Simulator] Call to ${phoneNumber} failed`);
        reject(new Error('Call failed'));
      }
    }, 2000); // Simulate 2 second call duration
  });
}

// Event handlers
worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

worker.on('ready', () => {
  console.log('[Worker] Worker is ready and waiting for jobs');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[Worker] Call worker started');

