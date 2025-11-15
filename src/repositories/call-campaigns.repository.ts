import { prisma } from '../lib/prisma';
import { campaign_status } from '@prisma/client';

export const callCampaignRepository = {
  create(data: {
    user_id: string;
    name: string;
    schedule_id: string;
    status?: campaign_status;
    max_concurrent_calls?: number;
    max_retries?: number;
    retry_delay_seconds?: number;
  }) {
    return prisma.call_campaigns.create({ data });
  },

  findById(id: string) {
    return prisma.call_campaigns.findUnique({
      where: { id },
      include: {
        call_schedules: true,
      },
    });
  },

  findAllByUserId(user_id: string) {
    return prisma.call_campaigns.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
      include: {
        call_schedules: true,
      },
    });
  },

  findAll() {
    return prisma.call_campaigns.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        call_schedules: true,
      },
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      status?: campaign_status;
      schedule_id?: string;
      max_concurrent_calls?: number;
      max_retries?: number;
      retry_delay_seconds?: number;
    }
  ) {
    return prisma.call_campaigns.update({
      where: { id },
      data,
      include: {
        call_schedules: true,
      },
    });
  },

  delete(id: string) {
    return prisma.call_campaigns.delete({ where: { id } });
  },
};

