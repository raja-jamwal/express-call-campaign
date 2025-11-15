import { prisma } from '../lib/prisma';

export const userRepository = {
  create(data: { email: string; name: string }) {
    return prisma.users.create({ data });
  },

  findById(id: string) {
    return prisma.users.findUnique({ where: { id } });
  },

  findByEmail(email: string) {
    return prisma.users.findUnique({ where: { email } });
  },

  findAll() {
    return prisma.users.findMany({
      orderBy: { created_at: 'desc' },
    });
  },

  update(id: string, data: { name?: string; email?: string }) {
    return prisma.users.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.users.delete({ where: { id } });
  },
};

