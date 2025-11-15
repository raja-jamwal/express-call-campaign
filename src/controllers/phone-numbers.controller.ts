import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  phoneNumberService,
  PhoneNumberNotFoundError,
  PhoneNumberAlreadyExistsError,
  UserNotFoundError,
} from '../services/phone-numbers.service';
import { validate } from '../middleware/validate';
import { registry } from '../lib/openapi';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

const router = Router();

// Phone number status enum
const PhoneNumberStatusEnum = z.enum(['valid', 'invalid', 'do_not_call']).openapi({
  description: 'Phone number status',
  example: 'valid',
});

// Reusable PhoneNumber response schema
const PhoneNumberResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  user_id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  number: z.string().openapi({ example: '+1234567890' }),
  status: PhoneNumberStatusEnum,
  created_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
  updated_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
});

// Schema for creating a phone number
const createPhoneNumberSchema = z.object({
  body: z.object({
    user_id: z.string().uuid('Invalid user ID format').openapi({
      description: 'User ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    number: z
      .string()
      .min(1, 'Phone number is required')
      .max(50, 'Phone number too long')
      .openapi({
        description: 'Phone number',
        example: '+1234567890',
      }),
    status: PhoneNumberStatusEnum.optional(),
  }),
});

// Register POST /phone-numbers endpoint
registry.registerPath({
  method: 'post',
  path: '/phone-numbers',
  tags: ['Phone Numbers'],
  summary: 'Create a new phone number',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createPhoneNumberSchema.shape.body,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Phone number created successfully',
      content: {
        'application/json': {
          schema: PhoneNumberResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    404: {
      description: 'User not found',
    },
    409: {
      description: 'Phone number already exists for this user',
    },
  },
});

// Create phone number
router.post('/', validate(createPhoneNumberSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, number, status } = req.body;
    const phoneNumber = await phoneNumberService.createPhoneNumber({ user_id, number, status });
    res.status(201).json(phoneNumber);
  } catch (error) {
    if (error instanceof PhoneNumberAlreadyExistsError) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Register GET /phone-numbers endpoint
registry.registerPath({
  method: 'get',
  path: '/phone-numbers',
  tags: ['Phone Numbers'],
  summary: 'Get all phone numbers (optionally filtered by user_id)',
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
      description: 'List of phone numbers',
      content: {
        'application/json': {
          schema: z.array(PhoneNumberResponseSchema),
        },
      },
    },
    404: {
      description: 'User not found',
    },
  },
});

// Schema for query params
const getPhoneNumbersQuerySchema = z.object({
  query: z.object({
    user_id: z.string().uuid('Invalid user ID format').optional().openapi({
      description: 'Filter by user ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Get all phone numbers (with optional user_id filter)
router.get('/', validate(getPhoneNumbersQuerySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id } = req.query;

    if (user_id) {
      const phoneNumbers = await phoneNumberService.getPhoneNumbersByUserId(user_id as string);
      res.json(phoneNumbers);
    } else {
      const phoneNumbers = await phoneNumberService.getAllPhoneNumbers();
      res.json(phoneNumbers);
    }
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for getting phone number by ID
const getPhoneNumberByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid phone number ID format').openapi({
      description: 'Phone number ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Register GET /phone-numbers/:id endpoint
registry.registerPath({
  method: 'get',
  path: '/phone-numbers/{id}',
  tags: ['Phone Numbers'],
  summary: 'Get phone number by ID',
  request: {
    params: getPhoneNumberByIdSchema.shape.params,
  },
  responses: {
    200: {
      description: 'Phone number found',
      content: {
        'application/json': {
          schema: PhoneNumberResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid phone number ID format',
    },
    404: {
      description: 'Phone number not found',
    },
  },
});

// Get phone number by ID
router.get('/:id', validate(getPhoneNumberByIdSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const phoneNumber = await phoneNumberService.getPhoneNumber(id);
    res.json(phoneNumber);
  } catch (error) {
    if (error instanceof PhoneNumberNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for updating a phone number
const updatePhoneNumberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid phone number ID format').openapi({
      description: 'Phone number ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
  body: z
    .object({
      number: z
        .string()
        .min(1, 'Phone number cannot be empty')
        .max(50, 'Phone number too long')
        .optional()
        .openapi({
          description: 'Phone number',
          example: '+1987654321',
        }),
      status: PhoneNumberStatusEnum.optional(),
    })
    .refine((data) => data.number || data.status, {
      message: 'At least one field (number or status) must be provided',
    }),
});

// Register PUT /phone-numbers/:id endpoint
registry.registerPath({
  method: 'put',
  path: '/phone-numbers/{id}',
  tags: ['Phone Numbers'],
  summary: 'Update phone number',
  request: {
    params: updatePhoneNumberSchema.shape.params,
    body: {
      content: {
        'application/json': {
          schema: updatePhoneNumberSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Phone number updated successfully',
      content: {
        'application/json': {
          schema: PhoneNumberResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    404: {
      description: 'Phone number not found',
    },
    409: {
      description: 'Phone number already taken by this user',
    },
  },
});

// Update phone number
router.put('/:id', validate(updatePhoneNumberSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { number, status } = req.body;

    const phoneNumber = await phoneNumberService.updatePhoneNumber(id, { number, status });
    res.json(phoneNumber);
  } catch (error) {
    if (error instanceof PhoneNumberNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof PhoneNumberAlreadyExistsError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for deleting a phone number
const deletePhoneNumberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid phone number ID format').openapi({
      description: 'Phone number ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Register DELETE /phone-numbers/:id endpoint
registry.registerPath({
  method: 'delete',
  path: '/phone-numbers/{id}',
  tags: ['Phone Numbers'],
  summary: 'Delete phone number',
  request: {
    params: deletePhoneNumberSchema.shape.params,
  },
  responses: {
    204: {
      description: 'Phone number deleted successfully',
    },
    400: {
      description: 'Invalid phone number ID format',
    },
    404: {
      description: 'Phone number not found',
    },
  },
});

// Delete phone number
router.delete('/:id', validate(deletePhoneNumberSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await phoneNumberService.deletePhoneNumber(id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof PhoneNumberNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;

