import express from 'express';
import 'express-async-errors';
import { prisma } from './lib/prisma';
import { enqueueCallTask, enqueueCallTasks, CallJobData } from './queues/callQueue';

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'express-call-campaign' });
  } catch (error) {
    res.status(503).json({ ok: false, error: 'Database connection failed' });
  }
});

// Get all users
app.get('/users', async (_req, res) => {
  const users = await prisma.users.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      created_at: true,
    },
  });
  res.json(users);
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express] Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

export default app;

