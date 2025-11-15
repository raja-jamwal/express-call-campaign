import { callCampaignRepository } from '../repositories/call-campaigns.repository';
import { callScheduleRepository } from '../repositories/call-schedules.repository';
import { userRepository } from '../repositories/users.repository';
import { phoneNumberRepository } from '../repositories/phone-numbers.repository';
import { prisma } from '../lib/prisma';
import { getNextValidScheduleDate } from '../lib/schedule_utils';

// Custom error classes
export class CallCampaignNotFoundError extends Error {
  constructor(id: string) {
    super(`Call campaign with id ${id} not found`);
    this.name = 'CallCampaignNotFoundError';
  }
}

export class CallScheduleNotFoundError extends Error {
  constructor(id: string) {
    super(`Call schedule with id ${id} not found`);
    this.name = 'CallScheduleNotFoundError';
  }
}

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User with id ${id} not found`);
    this.name = 'UserNotFoundError';
  }
}

export class PhoneNumberNotFoundError extends Error {
  constructor(id: string) {
    super(`Phone number with id ${id} not found`);
    this.name = 'PhoneNumberNotFoundError';
  }
}

export class CallTaskAlreadyExistsError extends Error {
  constructor(campaignId: string, phoneNumberId: string) {
    super(`Call task already exists for campaign ${campaignId} and phone number ${phoneNumberId}`);
    this.name = 'CallTaskAlreadyExistsError';
  }
}

export class InvalidScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidScheduleError';
  }
}

export const callCampaignService = {
  async createCallCampaign(input: {
    user_id: string;
    name: string;
    schedule_id: string;
    is_paused?: boolean;
    max_concurrent_calls?: number;
    max_retries?: number;
    retry_delay_seconds?: number;
  }) {
    // Check if user exists
    const user = await userRepository.findById(input.user_id);
    if (!user) {
      throw new UserNotFoundError(input.user_id);
    }

    // Check if schedule exists
    const schedule = await callScheduleRepository.findById(input.schedule_id);
    if (!schedule) {
      throw new CallScheduleNotFoundError(input.schedule_id);
    }

    // Create the call campaign
    const callCampaign = await callCampaignRepository.create({
      user_id: input.user_id,
      name: input.name,
      schedule_id: input.schedule_id,
      max_concurrent_calls: input.max_concurrent_calls,
      max_retries: input.max_retries,
      retry_delay_seconds: input.retry_delay_seconds,
    });
    return callCampaign;
  },

  async getCallCampaign(id: string) {
    const callCampaign = await callCampaignRepository.findById(id);
    if (!callCampaign) {
      throw new CallCampaignNotFoundError(id);
    }
    return callCampaign;
  },

  async getCallCampaignsByUserId(user_id: string) {
    // Check if user exists
    const user = await userRepository.findById(user_id);
    if (!user) {
      throw new UserNotFoundError(user_id);
    }

    return callCampaignRepository.findAllByUserId(user_id);
  },

  async getAllCallCampaigns() {
    return callCampaignRepository.findAll();
  },

  async updateCallCampaign(
    id: string,
    input: {
      name?: string;
      is_paused?: boolean;
      schedule_id?: string;
      max_concurrent_calls?: number;
      max_retries?: number;
      retry_delay_seconds?: number;
    }
  ) {
    const existing = await callCampaignRepository.findById(id);
    if (!existing) {
      throw new CallCampaignNotFoundError(id);
    }

    // If updating schedule_id, check it exists
    if (input.schedule_id && input.schedule_id !== existing.schedule_id) {
      const schedule = await callScheduleRepository.findById(input.schedule_id);
      if (!schedule) {
        throw new CallScheduleNotFoundError(input.schedule_id);
      }
    }

    // Perform update
    return callCampaignRepository.update(id, input);
  },

  async deleteCallCampaign(id: string) {
    const existing = await callCampaignRepository.findById(id);
    if (!existing) {
      throw new CallCampaignNotFoundError(id);
    }

    return callCampaignRepository.delete(id);
  },

  async getCampaignStatus(id: string): Promise<'paused' | 'pending' | 'in-progress' | 'completed' | 'failed'> {
    // Get the campaign
    const campaign = await callCampaignRepository.findById(id);
    if (!campaign) {
      throw new CallCampaignNotFoundError(id);
    }

    // If campaign is paused, return paused
    if (campaign.is_paused) {
      return 'paused';
    }

    // Use raw SQL query to efficiently aggregate task statuses
    const result = await prisma.$queryRaw<
      Array<{
        total_tasks: bigint;
        failed_count: bigint;
        in_progress_count: bigint;
        pending_count: bigint;
        completed_count: bigint;
      }>
    >`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count
      FROM call_tasks
      WHERE campaign_id = ${id}::uuid
    `;

    const stats = result[0];
    const totalTasks = Number(stats.total_tasks);
    const failedCount = Number(stats.failed_count);
    const inProgressCount = Number(stats.in_progress_count);
    const pendingCount = Number(stats.pending_count);
    const completedCount = Number(stats.completed_count);

    // If no tasks exist, return paused as fallback
    if (totalTasks === 0) {
      return 'paused';
    }

    // Check if any task has failed
    if (failedCount > 0) {
      return 'failed';
    }

    // Check if any task is pending or in-progress
    if (inProgressCount > 0 || pendingCount > 0) {
      return 'in-progress';
    }

    // Check if all tasks are completed
    if (completedCount === totalTasks) {
      return 'completed';
    }

    // Fallback
    return 'paused';
  },

  async addPhoneNumberToCampaign(campaignId: string, phoneNumberId: string) {
    // Get the campaign
    const campaign = await callCampaignRepository.findById(campaignId);
    if (!campaign) {
      throw new CallCampaignNotFoundError(campaignId);
    }

    // Get the phone number
    const phoneNumber = await phoneNumberRepository.findById(phoneNumberId);
    if (!phoneNumber) {
      throw new PhoneNumberNotFoundError(phoneNumberId);
    }

    // Check if phone number belongs to the same user as the campaign
    if (phoneNumber.user_id !== campaign.user_id) {
      throw new Error('Phone number does not belong to the campaign owner');
    }

    // Check if call_task already exists
    const existingTask = await prisma.call_tasks.findUnique({
      where: {
        campaign_id_phone_number_id: {
          campaign_id: campaignId,
          phone_number_id: phoneNumberId,
        },
      },
    });

    if (existingTask) {
      throw new CallTaskAlreadyExistsError(campaignId, phoneNumberId);
    }

    // Get the schedule to calculate scheduled_at
    if (!campaign.schedule_id || !campaign.call_schedules) {
      throw new InvalidScheduleError('Campaign does not have a valid schedule');
    }

    const schedule = campaign.call_schedules;

    // Calculate the next valid scheduled date
    const scheduledAt = getNextValidScheduleDate(schedule);
    if (!scheduledAt) {
      throw new InvalidScheduleError(
        `Could not find a valid schedule slot for campaign ${campaignId} with schedule ${schedule.id}`
      );
    }

    // Create the call_task
    const callTask = await prisma.call_tasks.create({
      data: {
        user_id: campaign.user_id,
        campaign_id: campaignId,
        phone_number_id: phoneNumberId,
        scheduled_at: scheduledAt,
        status: 'pending',
        retry_count: 0,
      },
    });

    // Update campaign total_tasks counter
    await prisma.call_campaigns.update({
      where: { id: campaignId },
      data: {
        total_tasks: { increment: 1 },
      },
    });

    return callTask;
  },
};

