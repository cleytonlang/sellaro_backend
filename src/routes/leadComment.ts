import { FastifyInstance } from 'fastify';
import { LeadCommentController } from '../controllers/leadCommentController';

const leadCommentController = new LeadCommentController();

export default async function leadCommentRoutes(fastify: FastifyInstance) {
  // Create a new comment
  fastify.post('/', async (request, reply) => {
    return leadCommentController.create(request, reply);
  });

  // Get all comments for a lead
  fastify.get('/lead/:lead_id', async (request, reply) => {
    return leadCommentController.getByLeadId(request, reply);
  });

  // Update a comment
  fastify.put('/:id', async (request, reply) => {
    return leadCommentController.update(request, reply);
  });

  // Delete a comment
  fastify.delete('/:id', async (request, reply) => {
    return leadCommentController.delete(request, reply);
  });
}
