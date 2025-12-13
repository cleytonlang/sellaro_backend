import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import 'dotenv/config';

// Initialize message worker (Bull queue processor)
import './workers/messageWorker';

// Routes
import betterAuthRoutes from './routes/better-auth';
import userRoutes from './routes/user';
import formRoutes from './routes/form';
import leadRoutes from './routes/lead';
import assistantRoutes from './routes/assistant';
import conversationRoutes from './routes/conversation';
import kanbanRoutes from './routes/kanban';
import uploadRoutes from './routes/upload';
import { settingsRoutes } from './routes/settings';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
});

// Plugins
server.register(helmet, {
  contentSecurityPolicy: false,
});

server.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization'],
});

server.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Health check
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
server.register(betterAuthRoutes, { prefix: '/api' });
server.register(userRoutes, { prefix: '/api/users' });
server.register(formRoutes, { prefix: '/api/forms' });
server.register(leadRoutes, { prefix: '/api/leads' });
server.register(assistantRoutes, { prefix: '/api/assistants' });
server.register(conversationRoutes, { prefix: '/api/conversations' });
server.register(kanbanRoutes, { prefix: '/api/kanban-columns' });
server.register(uploadRoutes, { prefix: '/api/upload' });
server.register(settingsRoutes);

// Error handler
server.setErrorHandler((error, _request, reply) => {
  server.log.error(error);

  const statusCode = (error as any).statusCode || 500;
  const errorName = (error as any).name || 'InternalServerError';
  const errorMessage = (error as any).message || 'An unexpected error occurred';

  reply.status(statusCode).send({
    error: errorName,
    message: errorMessage,
  });
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });

    console.log(`🚀 Server running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

export default server;
