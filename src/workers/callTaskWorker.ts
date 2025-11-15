import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { CallTaskJobData } from '../queues/callTaskQueue';
import { Redis } from 'ioredis';
import { call_logs } from '@prisma/client';
import { getNextValidScheduleDate } from '../lib/schedule_utils';

const redis = new Redis(redisConnection);

const worker = new Worker<CallTaskJobData>(
  'call-tasks',
  async (job: Job<CallTaskJobData>) => {
    const { callTaskId } = job.data;
    console.log(`[Worker] Processing job ${job.id} for call task ${callTaskId}`);

    // Fetch the full task details, including its campaign and phone number
    const callTask = await prisma.call_tasks.findUnique({
      where: { id: callTaskId, status: 'pending' },
      include: {
        phone_numbers: true,
        call_campaigns: {
          include: {
            call_schedules: true,
          },
        },
      },
    });

    if (!callTask) {
      console.error(`[Worker] Call task ${callTaskId} not found. Acknowledging job.`);
      // Acknowledge the job so it doesn't get retried forever
      return { status: 'error', reason: 'task_not_found' };
    }

    const { call_campaigns: campaign, phone_numbers: phoneNumber, user_id } = callTask;
    const concurrencyKey = `campaign:${campaign.id}:active_calls`;

    try {
      const activeCalls = await redis.incr(concurrencyKey);
      if (activeCalls > campaign.max_concurrent_calls) {
        await redis.decr(concurrencyKey);
        // recalculate next scheduled_at time and then update call_tasks set
        // scheduled_at = next_scheduled_at where id = callTaskId
        // set the task status to 'pending'
        const newScheduledAt = getNextValidScheduleDate(campaign.call_schedules, new Date());
        await prisma.call_tasks.update({
          where: { id: callTaskId },
          data: {
            status: 'pending', // Set back to pending for the scheduler to pick up again
            scheduled_at: newScheduledAt as Date,
            updated_at: new Date(),
          },
        });

        return { status: 'error', reason: 'campaign_max_concurrent_calls_reached' };
      }

      const callLog = await prisma.call_logs.create({
        data: {
          user_id: user_id,
          call_task_id: callTaskId,
          phone_number_id: phoneNumber.id,
          dialed_number: phoneNumber.number,
          status: 'initiated',
          started_at: new Date(),
          // In a real system, we'll get this from the telephony API
          external_call_id: `mock-${Date.now()}-${Math.random()}`,
        },
      });

      console.log(`[Worker] Created call log ${callLog.id} for ${phoneNumber.number}`);

      // Simulate the external API call
      await simulateCall(callLog);

      // SUCCESS PATH
      await prisma.$transaction([
        // Update call log to completed
        prisma.call_logs.update({
          where: { id: callLog.id },
          data: { status: 'completed', ended_at: new Date() },
        }),
        // Update task to completed
        prisma.call_tasks.update({
          where: { id: callTaskId },
          data: { status: 'completed', updated_at: new Date() },
        }),
        // Increment completed tasks on the campaign
        prisma.call_campaigns.update({
          where: { id: campaign.id },
          data: { completed_tasks: { increment: 1 }, updated_at: new Date() },
        }),
      ]);

      console.log(`[Worker] Successfully completed call task ${callTaskId}`);
      return { status: 'success', callLogId: callLog.id };
    } catch (error) {
      // FAILURE PATH
      console.error(`[Worker] Error processing call task ${callTaskId}:`, (error as Error).message);

      // Check if we should retry or mark as failed permanently
      if (callTask.retry_count < campaign.max_retries) {
        // Reschedule for a future retry
        const newScheduledAt = getNextValidScheduleDate(campaign.call_schedules, new Date()) as Date;
        await prisma.$transaction([
          prisma.call_tasks.update({
            where: { id: callTaskId },
            data: {
              status: 'pending', // Set back to pending for the scheduler to pick up again
              retry_count: { increment: 1 },
              scheduled_at: newScheduledAt,
              updated_at: new Date(),
            },
          }),
          prisma.call_campaigns.update({
            where: { id: campaign.id },
            data: { retries_attempted: { increment: 1 }, updated_at: new Date() },
          }),
        ]);
        console.log(`[Worker] Task ${callTaskId} failed, rescheduled for retry at ${newScheduledAt.toISOString()}`);
        return { status: 'error', reason: 'retryable_error' };
      }

       // All retries exhausted, mark as permanently failed
       await prisma.$transaction([
        prisma.call_tasks.update({
          where: { id: callTaskId },
          data: { status: 'failed', updated_at: new Date() },
        }),
        prisma.call_campaigns.update({
          where: { id: campaign.id },
          data: { failed_tasks: { increment: 1 }, updated_at: new Date() },
        }),
      ]);

      console.log(`[Worker] Task ${callTaskId} has failed permanently after ${callTask.retry_count} retries.`);

      return { status: 'error', reason: 'max_retries_exhausted' };
    } finally {
      await redis.decr(concurrencyKey);
      console.log(`[Worker] Released concurrency slot for campaign ${campaign.id}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 50, // Process 50 jobs concurrently on a single worker
    // Maximum number of jobs that can be processed in a given time period
    // In distributed job processing
    limiter: {
      max: 50, // Max 50 jobs
      duration: 1*60*1000, // per minute
    },
  }
);

// Simulate a call (replace with actual call service)
async function simulateCall(callLog: call_logs): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // Update call log to in_progress
    await prisma.call_logs.update({
      where: { id: callLog.id },
      data: { status: 'in_progress', updated_at: new Date() },
    });

    setTimeout(() => {
      // Simulate 90% success rate
      if (Math.random() < 0.9) {
        console.log(`[Simulator] Call to ${callLog.dialed_number} completed successfully`);
        resolve();
      } else {
        console.log(`[Simulator] Call to ${callLog.dialed_number} failed`);
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

