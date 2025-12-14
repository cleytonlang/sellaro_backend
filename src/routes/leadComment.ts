import { FastifyInstance } from 'fastify';
import { LeadCommentController } from '../controllers/leadCommentController';

const leadCommentController = new LeadCommentController();

export default async function leadCommentRoutes(fastify: FastifyInstance) {
  // Create a new comment
  fastify.post<{
    Body: {
      lead_id: string;
      user_id: string;
      content: string;
    };
  }>('/', async (request, reply) => {
    return leadCommentController.create(request, reply);
  });

  // Get all comments for a lead
  fastify.get<{
    Params: { lead_id: string };
    Querystring: { page?: string };
  }>('/lead/:lead_id', async (request, reply) => {
    return leadCommentController.getByLeadId(request, reply);
  });

  // Update a comment
  fastify.put<{
    Params: { id: string };
    Body: {
      content: string;
    };
  }>('/:id', async (request, reply) => {
    return leadCommentController.update(request, reply);
  });

  // Delete a comment
  fastify.delete<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    return leadCommentController.delete(request, reply);
  });
}
