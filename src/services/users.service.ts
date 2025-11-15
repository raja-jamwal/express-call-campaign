import { userRepository } from '../repositories/users.repository';

// Custom error classes
export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User with id ${id} not found`);
    this.name = 'UserNotFoundError';
  }
}

export class UserAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.name = 'UserAlreadyExistsError';
  }
}

export const userService = {
  async createUser(input: { email: string; name: string }) {
    // Check if user already exists with this email
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new UserAlreadyExistsError(input.email);
    }

    // Create the user
    const user = await userRepository.create({
      ...input,
    });
    return user;
  },

  async getUser(id: string) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return user;
  },

  async getUserByEmail(email: string) {
    const user = await userRepository.findByEmail(email);
    return user; // Can be null
  },

  async getAllUsers() {
    return userRepository.findAll();
  },

  async updateUser(id: string, input: { name?: string; email?: string }) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new UserNotFoundError(id);
    }

    // If updating email, check it's not already taken by another user
    if (input.email && input.email !== existing.email) {
      const emailTaken = await userRepository.findByEmail(input.email);
      if (emailTaken) {
        throw new UserAlreadyExistsError(input.email);
      }
    }

    // Perform update
    return userRepository.update(id, input);
  },

  async deleteUser(id: string) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new UserNotFoundError(id);
    }

    return userRepository.delete(id);
  },
};

