import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis';

export const callTaskQueue = new Queue('call-tasks', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: Number(process.env.BULLMQ_MAX_RETRIES ?? 3),
    backoff: {
      type: 'exponential',
      delay: Number(process.env.BULLMQ_RETRY_DELAY ?? 5000),
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs
      age: 24 * 3600, // Keep jobs for 24 hours
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed jobs
    },
  },
});

// Job data interface
export interface CallJobData {
  taskId: string;
  campaignId: string;
  phoneNumberId: string;
  phoneNumber: string;
  userId: string;
}

// Helper function to enqueue a call task
export async function enqueueCallTask(data: CallJobData) {
  return await callTaskQueue.add('make-call', data, {
    jobId: `call-task-${data.taskId}`, // Prevent duplicate jobs
  });
}

// Helper function to enqueue multiple call tasks
export async function enqueueCallTasks(tasks: CallJobData[]) {
  return await callTaskQueue.addBulk(
    tasks.map((data) => ({
      name: 'make-call',
      data,
      opts: {
        jobId: `call-task-${data.taskId}`,
      },
    }))
  );
}

