import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/userController';

const userController = new UserController();

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/', userController.getAll);
  fastify.get('/:id', userController.getById);
  fastify.put('/:id', userController.update);
  fastify.delete('/:id', userController.delete);
}
