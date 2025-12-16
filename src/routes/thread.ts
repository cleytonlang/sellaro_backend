import { FastifyInstance } from 'fastify';
import { ThreadController } from '../controllers/threadController';

const threadController = new ThreadController();

export default async function threadRoutes(fastify: FastifyInstance) {
  fastify.get('/:threadId', threadController.getThreadMessages);
}
