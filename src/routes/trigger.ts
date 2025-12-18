import type { FastifyInstance } from 'fastify';
import * as triggerController from '../controllers/triggerController';

export default async function triggerRoutes(fastify: FastifyInstance) {
  // Get all triggers for an assistant
  fastify.get('/assistants/:assistantId/triggers', triggerController.getTriggers);

  // Create a new trigger
  fastify.post('/assistants/:assistantId/triggers', triggerController.createTrigger);

  // Update a trigger
  fastify.put('/triggers/:id', triggerController.updateTrigger);

  // Delete a trigger
  fastify.delete('/triggers/:id', triggerController.deleteTrigger);

  // Reorder triggers
  fastify.post('/assistants/:assistantId/triggers/reorder', triggerController.reorderTriggers);
}
