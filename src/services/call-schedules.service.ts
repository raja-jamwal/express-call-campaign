import { callScheduleRepository } from '../repositories/call-schedules.repository';
import { userRepository } from '../repositories/users.repository';
import { Prisma } from '@prisma/client';

// Custom error classes
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

export const callScheduleService = {
  async createCallSchedule(input: {
    user_id: string;
    name: string;
    time_zone: string;
    schedule_rules: Prisma.InputJsonValue;
  }) {
    // Check if user exists
    const user = await userRepository.findById(input.user_id);
    if (!user) {
      throw new UserNotFoundError(input.user_id);
    }

    // Create the call schedule
    const callSchedule = await callScheduleRepository.create({
      user_id: input.user_id,
      name: input.name,
      time_zone: input.time_zone,
      schedule_rules: input.schedule_rules,
    });
    return callSchedule;
  },

  async getCallSchedule(id: string) {
    const callSchedule = await callScheduleRepository.findById(id);
    if (!callSchedule) {
      throw new CallScheduleNotFoundError(id);
    }
    return callSchedule;
  },

  async getCallSchedulesByUserId(user_id: string) {
    // Check if user exists
    const user = await userRepository.findById(user_id);
    if (!user) {
      throw new UserNotFoundError(user_id);
    }

    return callScheduleRepository.findAllByUserId(user_id);
  },

  async getAllCallSchedules() {
    return callScheduleRepository.findAll();
  },

  async updateCallSchedule(
    id: string,
    input: {
      name?: string;
      time_zone?: string;
      schedule_rules?: Prisma.InputJsonValue;
    }
  ) {
    const existing = await callScheduleRepository.findById(id);
    if (!existing) {
      throw new CallScheduleNotFoundError(id);
    }

    // Perform update
    return callScheduleRepository.update(id, input);
  },

  async deleteCallSchedule(id: string) {
    const existing = await callScheduleRepository.findById(id);
    if (!existing) {
      throw new CallScheduleNotFoundError(id);
    }

    return callScheduleRepository.delete(id);
  },
};

