import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  callCampaignService,
  CallCampaignNotFoundError,
  CallScheduleNotFoundError,
  UserNotFoundError,
  PhoneNumberNotFoundError,
  CallTaskAlreadyExistsError,
  InvalidScheduleError,
} from '../services/call-campaigns.service';
import { validate } from '../middleware/validate';
import { registry } from '../lib/openapi';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

const router = Router();

// Reusable CallSchedule response schema (nested in campaign response)
const CallScheduleNestedSchema = z.object({
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

// Reusable CallCampaign response schema
const CallCampaignResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  user_id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  name: z.string().openapi({ example: 'Q1 Sales Campaign' }),
  is_paused: z.boolean().openapi({ example: true }),
  schedule_id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  max_concurrent_calls: z.number().int().openapi({ example: 5 }),
  max_retries: z.number().int().openapi({ example: 3 }),
  retry_delay_seconds: z.number().int().openapi({ example: 300 }),
  total_tasks: z.number().int().openapi({ example: 0 }),
  completed_tasks: z.number().int().openapi({ example: 0 }),
  failed_tasks: z.number().int().openapi({ example: 0 }),
  retries_attempted: z.number().int().openapi({ example: 0 }),
  created_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
  updated_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
  call_schedules: CallScheduleNestedSchema,
});

// Schema for creating a call campaign
const createCallCampaignSchema = z.object({
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
        description: 'Campaign name',
        example: 'Q1 Sales Campaign',
      }),
    schedule_id: z.string().uuid('Invalid schedule ID format').openapi({
      description: 'Schedule ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    is_paused: z.boolean().optional().openapi({
      description: 'Whether the campaign is paused',
      example: true,
    }),
    max_concurrent_calls: z
      .number()
      .int()
      .min(1)
      .optional()
      .openapi({
        description: 'Maximum concurrent calls',
        example: 5,
      }),
    max_retries: z
      .number()
      .int()
      .min(0)
      .optional()
      .openapi({
        description: 'Maximum retry attempts',
        example: 3,
      }),
    retry_delay_seconds: z
      .number()
      .int()
      .min(0)
      .optional()
      .openapi({
        description: 'Delay between retries in seconds',
        example: 300,
      }),
  }),
});

// Register POST /call-campaigns endpoint
registry.registerPath({
  method: 'post',
  path: '/call-campaigns',
  tags: ['Call Campaigns'],
  summary: 'Create a new call campaign',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createCallCampaignSchema.shape.body,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Call campaign created successfully',
      content: {
        'application/json': {
          schema: CallCampaignResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    404: {
      description: 'User or schedule not found',
    },
  },
});

// Create call campaign
router.post('/', validate(createCallCampaignSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, name, schedule_id, is_paused, max_concurrent_calls, max_retries, retry_delay_seconds } = req.body;
    const callCampaign = await callCampaignService.createCallCampaign({
      user_id,
      name,
      schedule_id,
      is_paused,
      max_concurrent_calls,
      max_retries,
      retry_delay_seconds,
    });
    res.status(201).json(callCampaign);
  } catch (error) {
    if (error instanceof UserNotFoundError || error instanceof CallScheduleNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Register GET /call-campaigns endpoint
registry.registerPath({
  method: 'get',
  path: '/call-campaigns',
  tags: ['Call Campaigns'],
  summary: 'Get all call campaigns (optionally filtered by user_id)',
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
      description: 'List of call campaigns',
      content: {
        'application/json': {
          schema: z.array(CallCampaignResponseSchema),
        },
      },
    },
    404: {
      description: 'User not found',
    },
  },
});

// Schema for query params
const getCallCampaignsQuerySchema = z.object({
  query: z.object({
    user_id: z.string().uuid('Invalid user ID format').optional().openapi({
      description: 'Filter by user ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Get all call campaigns (with optional user_id filter)
router.get('/', validate(getCallCampaignsQuerySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id } = req.query;

    if (user_id) {
      const callCampaigns = await callCampaignService.getCallCampaignsByUserId(user_id as string);
      res.json(callCampaigns);
    } else {
      const callCampaigns = await callCampaignService.getAllCallCampaigns();
      res.json(callCampaigns);
    }
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for getting call campaign by ID
const getCallCampaignByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid call campaign ID format').openapi({
      description: 'Call campaign ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Register GET /call-campaigns/:id endpoint
registry.registerPath({
  method: 'get',
  path: '/call-campaigns/{id}',
  tags: ['Call Campaigns'],
  summary: 'Get call campaign by ID',
  request: {
    params: getCallCampaignByIdSchema.shape.params,
  },
  responses: {
    200: {
      description: 'Call campaign found',
      content: {
        'application/json': {
          schema: CallCampaignResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid call campaign ID format',
    },
    404: {
      description: 'Call campaign not found',
    },
  },
});

// Get call campaign by ID
router.get('/:id', validate(getCallCampaignByIdSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const callCampaign = await callCampaignService.getCallCampaign(id);
    res.json(callCampaign);
  } catch (error) {
    if (error instanceof CallCampaignNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for updating a call campaign
const updateCallCampaignSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid call campaign ID format').openapi({
      description: 'Call campaign ID',
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
          description: 'Campaign name',
          example: 'Updated Campaign',
        }),
      is_paused: z.boolean().optional().openapi({
        description: 'Whether the campaign is paused',
        example: true,
      }),
      schedule_id: z.string().uuid('Invalid schedule ID format').optional().openapi({
        description: 'Schedule ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
      }),
      max_concurrent_calls: z
        .number()
        .int()
        .min(1)
        .optional()
        .openapi({
          description: 'Maximum concurrent calls',
          example: 10,
        }),
      max_retries: z
        .number()
        .int()
        .min(0)
        .optional()
        .openapi({
          description: 'Maximum retry attempts',
          example: 5,
        }),
      retry_delay_seconds: z
        .number()
        .int()
        .min(0)
        .optional()
        .openapi({
          description: 'Delay between retries in seconds',
          example: 600,
        }),
    })
    .refine(
      (data) =>
        data.name ||
        data.is_paused !== undefined ||
        data.schedule_id ||
        data.max_concurrent_calls !== undefined ||
        data.max_retries !== undefined ||
        data.retry_delay_seconds !== undefined,
      {
        message: 'At least one field must be provided',
      }
    ),
});

// Register PUT /call-campaigns/:id endpoint
registry.registerPath({
  method: 'put',
  path: '/call-campaigns/{id}',
  tags: ['Call Campaigns'],
  summary: 'Update call campaign',
  request: {
    params: updateCallCampaignSchema.shape.params,
    body: {
      content: {
        'application/json': {
          schema: updateCallCampaignSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Call campaign updated successfully',
      content: {
        'application/json': {
          schema: CallCampaignResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    404: {
      description: 'Call campaign or schedule not found',
    },
  },
});

// Update call campaign
router.put('/:id', validate(updateCallCampaignSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, is_paused, schedule_id, max_concurrent_calls, max_retries, retry_delay_seconds } = req.body;

    const callCampaign = await callCampaignService.updateCallCampaign(id, {
      name,
      is_paused,
      schedule_id,
      max_concurrent_calls,
      max_retries,
      retry_delay_seconds,
    });
    res.json(callCampaign);
  } catch (error) {
    if (error instanceof CallCampaignNotFoundError || error instanceof CallScheduleNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for deleting a call campaign
const deleteCallCampaignSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid call campaign ID format').openapi({
      description: 'Call campaign ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Register DELETE /call-campaigns/:id endpoint
registry.registerPath({
  method: 'delete',
  path: '/call-campaigns/{id}',
  tags: ['Call Campaigns'],
  summary: 'Delete call campaign',
  request: {
    params: deleteCallCampaignSchema.shape.params,
  },
  responses: {
    204: {
      description: 'Call campaign deleted successfully',
    },
    400: {
      description: 'Invalid call campaign ID format',
    },
    404: {
      description: 'Call campaign not found',
    },
  },
});

// Delete call campaign
router.delete('/:id', validate(deleteCallCampaignSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await callCampaignService.deleteCallCampaign(id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof CallCampaignNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for getting campaign status
const getCampaignStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid call campaign ID format').openapi({
      description: 'Call campaign ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Response schema for campaign status
const CampaignStatusResponseSchema = z.object({
  campaign_id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  status: z.enum(['paused', 'pending', 'in-progress', 'completed', 'failed']).openapi({
    description: 'Campaign status',
    example: 'in-progress',
  }),
});

// Register GET /call-campaigns/:id/status endpoint
registry.registerPath({
  method: 'get',
  path: '/call-campaigns/{id}/status',
  tags: ['Call Campaigns'],
  summary: 'Get campaign status',
  description: 'Returns the current status of a campaign based on its pause state and task statuses',
  request: {
    params: getCampaignStatusSchema.shape.params,
  },
  responses: {
    200: {
      description: 'Campaign status retrieved successfully',
      content: {
        'application/json': {
          schema: CampaignStatusResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid call campaign ID format',
    },
    404: {
      description: 'Call campaign not found',
    },
  },
});

// Get campaign status
router.get('/:id/status', validate(getCampaignStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const status = await callCampaignService.getCampaignStatus(id);
    res.json({ campaign_id: id, status });
  } catch (error) {
    if (error instanceof CallCampaignNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for adding phone number to campaign
const addPhoneNumberToCampaignSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid call campaign ID format').openapi({
      description: 'Call campaign ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
  body: z.object({
    phone_number_id: z.string().uuid('Invalid phone number ID format').openapi({
      description: 'Phone number ID to add to the campaign',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Response schema for call task
const CallTaskResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  user_id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  campaign_id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  phone_number_id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  status: z.enum(['pending', 'in-progress', 'completed', 'failed']).openapi({ example: 'pending' }),
  scheduled_at: z.string().datetime().openapi({ example: '2024-01-01T09:00:00Z' }),
  retry_count: z.number().int().openapi({ example: 0 }),
  created_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
  updated_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
});

// Register POST /call-campaigns/:id/add-phone-number endpoint
registry.registerPath({
  method: 'post',
  path: '/call-campaigns/{id}/add-phone-number',
  tags: ['Call Campaigns'],
  summary: 'Add a phone number to a campaign',
  description: 'Creates a call task for the given phone number in the campaign. The task will be scheduled based on the campaign\'s schedule rules.',
  request: {
    params: addPhoneNumberToCampaignSchema.shape.params,
    body: {
      content: {
        'application/json': {
          schema: addPhoneNumberToCampaignSchema.shape.body,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Phone number added to campaign successfully',
      content: {
        'application/json': {
          schema: CallTaskResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error or invalid schedule',
    },
    404: {
      description: 'Campaign or phone number not found',
    },
    409: {
      description: 'Call task already exists for this phone number in the campaign',
    },
  },
});

// Add phone number to campaign
router.post(
  '/:id/add-phone-number',
  validate(addPhoneNumberToCampaignSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { phone_number_id } = req.body;
      const callTask = await callCampaignService.addPhoneNumberToCampaign(id, phone_number_id);
      res.status(201).json(callTask);
    } catch (error) {
      if (error instanceof CallCampaignNotFoundError || error instanceof PhoneNumberNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof CallTaskAlreadyExistsError) {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error instanceof InvalidScheduleError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  }
);

export default router;

