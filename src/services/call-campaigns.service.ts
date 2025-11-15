import { callCampaignRepository } from '../repositories/call-campaigns.repository';
import { callScheduleRepository } from '../repositories/call-schedules.repository';
import { userRepository } from '../repositories/users.repository';

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
};

