import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import 'dotenv/config';

// Initialize workers (Bull queue processors)
import './workers/messageWorker';
import './workers/webhookWorker';

// Routes
import betterAuthRoutes from './routes/better-auth';
import userRoutes from './routes/user';
import formRoutes from './routes/form';
import leadRoutes from './routes/lead';
import leadCommentRoutes from './routes/leadComment';
import assistantRoutes from './routes/assistant';
import conversationRoutes from './routes/conversation';
import kanbanRoutes from './routes/kanban';
import webhookRoutes from './routes/webhook';
import uploadRoutes from './routes/upload';
import threadRoutes from './routes/thread';
import adminRoutes from './routes/admin';
import triggerRoutes from './routes/trigger';
import { settingsRoutes } from './routes/settings';
import { analyticsRoutes } from './routes/analytics';
import { inviteRoutes } from './routes/invite';
import { passwordResetRoutes } from './routes/passwordReset';

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
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(url => url.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie'],
  exposedHeaders: ['Content-Type', 'Authorization', 'Set-Cookie'],
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
server.register(leadCommentRoutes, { prefix: '/api/lead-comments' });
server.register(assistantRoutes, { prefix: '/api/assistants' });
server.register(conversationRoutes, { prefix: '/api/conversations' });
server.register(kanbanRoutes, { prefix: '/api/kanban-columns' });
server.register(webhookRoutes, { prefix: '/api/webhooks' });
server.register(uploadRoutes, { prefix: '/api/upload' });
server.register(threadRoutes, { prefix: '/api/threads' });
server.register(triggerRoutes, { prefix: '/api' });
server.register(adminRoutes, { prefix: '/api' });
server.register(settingsRoutes);
server.register(analyticsRoutes, { prefix: '/api' });
server.register(inviteRoutes);
server.register(passwordResetRoutes);

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
