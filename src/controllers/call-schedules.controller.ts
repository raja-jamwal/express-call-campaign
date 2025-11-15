import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  callScheduleService,
  CallScheduleNotFoundError,
  UserNotFoundError,
} from '../services/call-schedules.service';
import { validate } from '../middleware/validate';
import { registry } from '../lib/openapi';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

const router = Router();

// Reusable CallSchedule response schema
const CallScheduleResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  user_id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  name: z.string().openapi({ example: 'Business Hours Schedule' }),
  time_zone: z.string().openapi({ example: 'America/New_York' }),
  schedule_rules: z.any().openapi({
    example: {
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      start_time: '09:00',
      end_time: '17:00',
    },
  }),
  created_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
  updated_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
});

// Schema for creating a call schedule
const createCallScheduleSchema = z.object({
  body: z.object({
    user_id: z.string().uuid('Invalid user ID format').openapi({
      description: 'User ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(255, 'Name too long')
      .openapi({
        description: 'Schedule name',
        example: 'Business Hours Schedule',
      }),
    time_zone: z
      .string()
      .min(1, 'Time zone is required')
      .max(100, 'Time zone too long')
      .openapi({
        description: 'Time zone (IANA format)',
        example: 'America/New_York',
      }),
    schedule_rules: z.any().openapi({
      description: 'Schedule rules (JSON object)',
      example: {
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        start_time: '09:00',
        end_time: '17:00',
      },
    }),
  }),
});

// Register POST /call-schedules endpoint
registry.registerPath({
  method: 'post',
  path: '/call-schedules',
  tags: ['Call Schedules'],
  summary: 'Create a new call schedule',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createCallScheduleSchema.shape.body,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Call schedule created successfully',
      content: {
        'application/json': {
          schema: CallScheduleResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    404: {
      description: 'User not found',
    },
  },
});

// Create call schedule
router.post('/', validate(createCallScheduleSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, name, time_zone, schedule_rules } = req.body;
    const callSchedule = await callScheduleService.createCallSchedule({
      user_id,
      name,
      time_zone,
      schedule_rules,
    });
    res.status(201).json(callSchedule);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Register GET /call-schedules endpoint
registry.registerPath({
  method: 'get',
  path: '/call-schedules',
  tags: ['Call Schedules'],
  summary: 'Get all call schedules (optionally filtered by user_id)',
  request: {
    query: z.object({
      user_id: z.string().uuid('Invalid user ID format').optional().openapi({
        description: 'Filter by user ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
      }),
    }),
  },
  responses: {
    200: {
      description: 'List of call schedules',
      content: {
        'application/json': {
          schema: z.array(CallScheduleResponseSchema),
        },
      },
    },
    404: {
      description: 'User not found',
    },
  },
});

// Schema for query params
const getCallSchedulesQuerySchema = z.object({
  query: z.object({
    user_id: z.string().uuid('Invalid user ID format').optional().openapi({
      description: 'Filter by user ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Get all call schedules (with optional user_id filter)
router.get('/', validate(getCallSchedulesQuerySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id } = req.query;

    if (user_id) {
      const callSchedules = await callScheduleService.getCallSchedulesByUserId(user_id as string);
      res.json(callSchedules);
    } else {
      const callSchedules = await callScheduleService.getAllCallSchedules();
      res.json(callSchedules);
    }
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for getting call schedule by ID
const getCallScheduleByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid call schedule ID format').openapi({
      description: 'Call schedule ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Register GET /call-schedules/:id endpoint
registry.registerPath({
  method: 'get',
  path: '/call-schedules/{id}',
  tags: ['Call Schedules'],
  summary: 'Get call schedule by ID',
  request: {
    params: getCallScheduleByIdSchema.shape.params,
  },
  responses: {
    200: {
      description: 'Call schedule found',
      content: {
        'application/json': {
          schema: CallScheduleResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid call schedule ID format',
    },
    404: {
      description: 'Call schedule not found',
    },
  },
});

// Get call schedule by ID
router.get('/:id', validate(getCallScheduleByIdSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const callSchedule = await callScheduleService.getCallSchedule(id);
    res.json(callSchedule);
  } catch (error) {
    if (error instanceof CallScheduleNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for updating a call schedule
const updateCallScheduleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid call schedule ID format').openapi({
      description: 'Call schedule ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, 'Name cannot be empty')
        .max(255, 'Name too long')
        .optional()
        .openapi({
          description: 'Schedule name',
          example: 'Updated Schedule',
        }),
      time_zone: z
        .string()
        .min(1, 'Time zone cannot be empty')
        .max(100, 'Time zone too long')
        .optional()
        .openapi({
          description: 'Time zone (IANA format)',
          example: 'America/Los_Angeles',
        }),
      schedule_rules: z.any().optional().openapi({
        description: 'Schedule rules (JSON object)',
        example: {
          days: ['monday', 'wednesday', 'friday'],
          start_time: '10:00',
          end_time: '16:00',
        },
      }),
    })
    .refine((data) => data.name || data.time_zone || data.schedule_rules, {
      message: 'At least one field must be provided',
    }),
});

// Register PUT /call-schedules/:id endpoint
registry.registerPath({
  method: 'put',
  path: '/call-schedules/{id}',
  tags: ['Call Schedules'],
  summary: 'Update call schedule',
  request: {
    params: updateCallScheduleSchema.shape.params,
    body: {
      content: {
        'application/json': {
          schema: updateCallScheduleSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Call schedule updated successfully',
      content: {
        'application/json': {
          schema: CallScheduleResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    404: {
      description: 'Call schedule not found',
    },
  },
});

// Update call schedule
router.put('/:id', validate(updateCallScheduleSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, time_zone, schedule_rules } = req.body;

    const callSchedule = await callScheduleService.updateCallSchedule(id, {
      name,
      time_zone,
      schedule_rules,
    });
    res.json(callSchedule);
  } catch (error) {
    if (error instanceof CallScheduleNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for deleting a call schedule
const deleteCallScheduleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid call schedule ID format').openapi({
      description: 'Call schedule ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Register DELETE /call-schedules/:id endpoint
registry.registerPath({
  method: 'delete',
  path: '/call-schedules/{id}',
  tags: ['Call Schedules'],
  summary: 'Delete call schedule',
  request: {
    params: deleteCallScheduleSchema.shape.params,
  },
  responses: {
    204: {
      description: 'Call schedule deleted successfully',
    },
    400: {
      description: 'Invalid call schedule ID format',
    },
    404: {
      description: 'Call schedule not found',
    },
  },
});

// Delete call schedule
router.delete('/:id', validate(deleteCallScheduleSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await callScheduleService.deleteCallSchedule(id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof CallScheduleNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;

