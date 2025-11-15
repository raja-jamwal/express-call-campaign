import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { userService, UserNotFoundError, UserAlreadyExistsError } from '../services/users.service';
import { validate } from '../middleware/validate';

const router = Router();

// Schema for creating a user
const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  }),
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

// Get all users
router.get('/', async (_req: Request, res: Response) => {
  const users = await userService.getAllUsers();
  res.json(users);
});

// Schema for getting user by ID
const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
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
    id: z.string().uuid('Invalid user ID format'),
  }),
  body: z.object({
    email: z.string().email('Invalid email format').optional(),
    name: z.string().min(1, 'Name cannot be empty').max(255, 'Name too long').optional(),
  }).refine((data) => data.email || data.name, {
    message: 'At least one field (email or name) must be provided',
  }),
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
    id: z.string().uuid('Invalid user ID format'),
  }),
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

