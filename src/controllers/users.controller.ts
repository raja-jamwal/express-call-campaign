import { Router, Request, Response } from 'express';
import { userService, UserNotFoundError, UserAlreadyExistsError } from '../services/users.service';

const router = Router();

// Create user
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    const user = await userService.createUser({ email, name });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof UserAlreadyExistsError) {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }
});

// Get all users
router.get('/', async (_req: Request, res: Response) => {
  const users = await userService.getAllUsers();
  res.json(users);
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userService.getUser(id);
    res.json(user);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
});

// Update user
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    const user = await userService.updateUser(id, { name, email });
    res.json(user);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof UserAlreadyExistsError) {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }
});

// Delete user
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await userService.deleteUser(id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
});

export default router;

