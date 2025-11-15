import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export const callScheduleRepository = {
  create(data: {
    user_id: string;
    name: string;
    time_zone: string;
    schedule_rules: Prisma.InputJsonValue;
  }) {
    return prisma.call_schedules.create({ data });
  },

  findById(id: string) {
    return prisma.call_schedules.findUnique({ where: { id } });
  },

  findAllByUserId(user_id: string) {
    return prisma.call_schedules.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
    });
  },

  findAll() {
    return prisma.call_schedules.findMany({
      orderBy: { created_at: 'desc' },
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      time_zone?: string;
      schedule_rules?: Prisma.InputJsonValue;
    }
  ) {
    return prisma.call_schedules.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.call_schedules.delete({ where: { id } });
  },
};

