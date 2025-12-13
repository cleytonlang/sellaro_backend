import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/authController';

const authController = new AuthController();

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', authController.register);
  fastify.post('/login', authController.login);
  fastify.post('/logout', authController.logout);
  fastify.get('/me', authController.me);
}
