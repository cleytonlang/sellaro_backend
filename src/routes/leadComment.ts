import { FastifyInstance } from 'fastify';
import { LeadCommentController } from '../controllers/leadCommentController';
import { authMiddleware } from '../middlewares/auth';

const leadCommentController = new LeadCommentController();

export default async function leadCommentRoutes(fastify: FastifyInstance) {
  // Create a new comment
  fastify.post('/', { preHandler: authMiddleware }, leadCommentController.create.bind(leadCommentController) as any);

  // Get all comments for a lead
  fastify.get('/lead/:lead_id', { preHandler: authMiddleware }, leadCommentController.getByLeadId.bind(leadCommentController) as any);

  // Update a comment
  fastify.put('/:id', { preHandler: authMiddleware }, leadCommentController.update.bind(leadCommentController) as any);

  // Delete a comment
  fastify.delete('/:id', { preHandler: authMiddleware }, leadCommentController.delete.bind(leadCommentController) as any);
}
