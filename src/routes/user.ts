import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/userController';
import { authMiddleware } from '../middlewares/auth';

const userController = new UserController();

export default async function userRoutes(fastify: FastifyInstance) {
  // Todas as rotas de user requerem autenticação
  fastify.get('/', { preHandler: authMiddleware }, userController.getAll);
  fastify.get('/:id', { preHandler: authMiddleware }, userController.getById);
  fastify.put('/:id', { preHandler: authMiddleware }, userController.update);
  fastify.delete('/:id', { preHandler: authMiddleware }, userController.delete);
}
