import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { userService, UserNotFoundError, UserAlreadyExistsError } from '../services/users.service';
import { validate } from '../middleware/validate';
import { registry } from '../lib/openapi';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

const router = Router();

// Reusable User response schema
const UserResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().openapi({ example: 'John Doe' }),
  created_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
  updated_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
});

// Schema for creating a user
const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format').openapi({
      description: 'User email address',
      example: 'user@example.com',
    }),
    name: z.string().min(1, 'Name is required').max(255, 'Name too long').openapi({
      description: 'User full name',
      example: 'John Doe',
    }),
  }),
});

// Register POST /users endpoint
registry.registerPath({
  method: 'post',
  path: '/users',
  tags: ['Users'],
  summary: 'Create a new user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createUserSchema.shape.body,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: UserResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    409: {
      description: 'User with this email already exists',
    },
  },
});

// Create user
router.post('/', validate(createUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name } = req.body;
    const user = await userService.createUser({ email, name });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof UserAlreadyExistsError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Register GET /users endpoint
registry.registerPath({
  method: 'get',
  path: '/users',
  tags: ['Users'],
  summary: 'Get all users',
  responses: {
    200: {
      description: 'List of all users',
      content: {
        'application/json': {
          schema: z.array(UserResponseSchema),
        },
      },
    },
  },
});

// Get all users
router.get('/', async (_req: Request, res: Response) => {
  const users = await userService.getAllUsers();
  res.json(users);
});

// Schema for getting user by ID
const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format').openapi({
      description: 'User ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Register GET /users/:id endpoint
registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  request: {
    params: getUserByIdSchema.shape.params,
  },
  responses: {
    200: {
      description: 'User found',
      content: {
        'application/json': {
          schema: UserResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid user ID format',
    },
    404: {
      description: 'User not found',
    },
  },
});

// Get user by ID
router.get('/:id', validate(getUserByIdSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await userService.getUser(id);
    res.json(user);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for updating a user
const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format').openapi({
      description: 'User ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
  body: z.object({
    email: z.string().email('Invalid email format').optional().openapi({
      description: 'User email address',
      example: 'newemail@example.com',
    }),
    name: z.string().min(1, 'Name cannot be empty').max(255, 'Name too long').optional().openapi({
      description: 'User full name',
      example: 'Jane Smith',
    }),
  }).refine((data) => data.email || data.name, {
    message: 'At least one field (email or name) must be provided',
  }),
});

// Register PUT /users/:id endpoint
registry.registerPath({
  method: 'put',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Update user',
  request: {
    params: updateUserSchema.shape.params,
    body: {
      content: {
        'application/json': {
          schema: updateUserSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User updated successfully',
      content: {
        'application/json': {
          schema: UserResponseSchema,
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
      description: 'Email already taken by another user',
    },
  },
});

// Update user
router.put('/:id', validate(updateUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    const user = await userService.updateUser(id, { name, email });
    res.json(user);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof UserAlreadyExistsError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// Schema for deleting a user
const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format').openapi({
      description: 'User ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }),
});

// Register DELETE /users/:id endpoint
registry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Delete user',
  request: {
    params: deleteUserSchema.shape.params,
  },
  responses: {
    204: {
      description: 'User deleted successfully',
    },
    400: {
      description: 'Invalid user ID format',
    },
    404: {
      description: 'User not found',
    },
  },
});

// Delete user
router.delete('/:id', validate(deleteUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await userService.deleteUser(id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;

