import { prisma } from '../lib/prisma';
import { phone_number_status } from '@prisma/client';

export const phoneNumberRepository = {
  create(data: { user_id: string; number: string; status?: phone_number_status }) {
    return prisma.phone_numbers.create({ data });
  },

  findById(id: string) {
    return prisma.phone_numbers.findUnique({ where: { id } });
  },

  findByUserIdAndNumber(user_id: string, number: string) {
    return prisma.phone_numbers.findUnique({
      where: {
        user_id_number: { user_id, number },
      },
    });
  },

  findAllByUserId(user_id: string) {
    return prisma.phone_numbers.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
    });
  },

  findAll() {
    return prisma.phone_numbers.findMany({
      orderBy: { created_at: 'desc' },
    });
  },

  update(id: string, data: { number?: string; status?: phone_number_status }) {
    return prisma.phone_numbers.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.phone_numbers.delete({ where: { id } });
  },
};

