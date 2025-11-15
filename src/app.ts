import express from 'express';
import 'express-async-errors';
import * as swaggerUi from 'swagger-ui-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { prisma } from './lib/prisma';
import { callQueue } from './queues/callQueue';
import { generateOpenApiDocument } from './lib/openapi';
import usersController from './controllers/users.controller';
import phoneNumbersController from './controllers/phone-numbers.controller';
import callSchedulesController from './controllers/call-schedules.controller';
import callCampaignsController from './controllers/call-campaigns.controller';

const app = express();
app.use(express.json());

// Setup Bull Board for queue monitoring
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(callQueue)],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// Setup Swagger UI for API documentation
const openApiDocument = generateOpenApiDocument();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  customSiteTitle: 'Express Call Campaign API',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// Serve OpenAPI JSON spec
app.get('/api-docs.json', (_req, res) => {
  res.json(openApiDocument);
});

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

// Mount routers
app.use('/users', usersController);
app.use('/phone-numbers', phoneNumbersController);
app.use('/call-schedules', callSchedulesController);
app.use('/call-campaigns', callCampaignsController);

// add test route GET to queue
app.get('/test-queue', async (_req, res) => {
  await callQueue.add('test-job', { message: 'Hello, world!' });
  res.json({ message: 'Job added to queue' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express] Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

export default app;

