import { phoneNumberRepository } from '../repositories/phone-numbers.repository';
import { userRepository } from '../repositories/users.repository';
import { phone_number_status } from '@prisma/client';

// Custom error classes
export class PhoneNumberNotFoundError extends Error {
  constructor(id: string) {
    super(`Phone number with id ${id} not found`);
    this.name = 'PhoneNumberNotFoundError';
  }
}

export class PhoneNumberAlreadyExistsError extends Error {
  constructor(number: string) {
    super(`Phone number ${number} already exists for this user`);
    this.name = 'PhoneNumberAlreadyExistsError';
  }
}

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User with id ${id} not found`);
    this.name = 'UserNotFoundError';
  }
}

export const phoneNumberService = {
  async createPhoneNumber(input: { user_id: string; number: string; status?: phone_number_status }) {
    // Check if user exists
    const user = await userRepository.findById(input.user_id);
    if (!user) {
      throw new UserNotFoundError(input.user_id);
    }

    // Check if phone number already exists for this user
    const existing = await phoneNumberRepository.findByUserIdAndNumber(input.user_id, input.number);
    if (existing) {
      throw new PhoneNumberAlreadyExistsError(input.number);
    }

    // Create the phone number
    const phoneNumber = await phoneNumberRepository.create({
      user_id: input.user_id,
      number: input.number,
      status: input.status || 'valid',
    });
    return phoneNumber;
  },

  async getPhoneNumber(id: string) {
    const phoneNumber = await phoneNumberRepository.findById(id);
    if (!phoneNumber) {
      throw new PhoneNumberNotFoundError(id);
    }
    return phoneNumber;
  },

  async getPhoneNumbersByUserId(user_id: string) {
    // Check if user exists
    const user = await userRepository.findById(user_id);
    if (!user) {
      throw new UserNotFoundError(user_id);
    }

    return phoneNumberRepository.findAllByUserId(user_id);
  },

  async getAllPhoneNumbers() {
    return phoneNumberRepository.findAll();
  },

  async updatePhoneNumber(id: string, input: { number?: string; status?: phone_number_status }) {
    const existing = await phoneNumberRepository.findById(id);
    if (!existing) {
      throw new PhoneNumberNotFoundError(id);
    }

    // If updating number, check it's not already taken by this user
    if (input.number && input.number !== existing.number) {
      const numberTaken = await phoneNumberRepository.findByUserIdAndNumber(existing.user_id, input.number);
      if (numberTaken) {
        throw new PhoneNumberAlreadyExistsError(input.number);
      }
    }

    // Perform update
    return phoneNumberRepository.update(id, input);
  },

  async deletePhoneNumber(id: string) {
    const existing = await phoneNumberRepository.findById(id);
    if (!existing) {
      throw new PhoneNumberNotFoundError(id);
    }

    return phoneNumberRepository.delete(id);
  },
};

