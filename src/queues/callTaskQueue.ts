import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis';

export const callTaskQueue = new Queue('call-tasks', {
  connection: redisConnection,
  defaultJobOptions: {
    // This is for transient errors, i.e uncatched errors
    // call failure are gracefully handled in the worker
    attempts: Number(process.env.BULLMQ_MAX_RETRIES ?? 3),
    backoff: {
      type: 'exponential',
      delay: Number(process.env.BULLMQ_RETRY_DELAY ?? 5000),
    },
  },
});

// Job data interface
export interface CallTaskJobData {
  callTaskId: string;
}

// Helper function to enqueue a call task
export async function enqueueCallTask(data: CallTaskJobData) {
  return await callTaskQueue.add('make-call', data, {
    jobId: `call-task-${data.callTaskId}`, // Prevent duplicate jobs
  });
}

// Helper function to enqueue multiple call tasks
export async function enqueueCallTasks(tasks: CallTaskJobData[]) {
  return await callTaskQueue.addBulk(
    tasks.map((data) => ({
      name: 'make-call',
      data,
      opts: {
        jobId: `call-task-${data.callTaskId}`,
      },
    }))
  );
}

