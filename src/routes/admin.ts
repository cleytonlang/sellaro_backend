import { FastifyInstance } from 'fastify';
import { AdminController } from '../controllers/adminController';

const adminController = new AdminController();

export default async function adminRoutes(fastify: FastifyInstance) {
  // Thread lock management
  fastify.get<{ Params: { thread_id: string } }>(
    '/admin/thread-lock/:thread_id',
    (req, reply) => adminController.getThreadLockStatus(req, reply)
  );

  fastify.delete<{ Params: { thread_id: string } }>(
    '/admin/thread-lock/:thread_id',
    (req, reply) => adminController.clearThreadLock(req, reply)
  );
}
