import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/userController';
import { authMiddleware } from '../middlewares/auth';

const userController = new UserController();

export default async function userRoutes(fastify: FastifyInstance) {
  // Todas as rotas de user requerem autenticação
  fastify.get('/', { preHandler: authMiddleware }, userController.getAll.bind(userController) as any);
  fastify.get('/team', { preHandler: authMiddleware }, userController.getTeamMembers.bind(userController) as any);
  fastify.get('/:id', { preHandler: authMiddleware }, userController.getById.bind(userController) as any);
  fastify.put('/:id', { preHandler: authMiddleware }, userController.update.bind(userController) as any);
  fastify.put('/:id/permissions', { preHandler: authMiddleware }, userController.updatePermissions.bind(userController) as any);
  fastify.delete('/:id', { preHandler: authMiddleware }, userController.delete.bind(userController) as any);
}
