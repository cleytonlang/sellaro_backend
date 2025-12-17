import { FastifyInstance } from 'fastify';
import { AssistantFunctionController } from '../controllers/assistantFunctionController';

const assistantFunctionController = new AssistantFunctionController();

export default async function assistantFunctionRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { assistant_id: string } }>(
    '/assistant/:assistant_id/functions',
    (req, reply) => assistantFunctionController.getByAssistantId(req, reply)
  );

  fastify.post<{
    Params: { assistant_id: string };
    Body: { type: string; instructions: string };
  }>(
    '/assistant/:assistant_id/functions',
    (req, reply) => assistantFunctionController.create(req, reply)
  );

  fastify.put<{
    Params: { id: string };
    Body: { instructions?: string };
  }>(
    '/assistant-functions/:id',
    (req, reply) => assistantFunctionController.update(req, reply)
  );

  fastify.delete<{ Params: { id: string } }>(
    '/assistant-functions/:id',
    (req, reply) => assistantFunctionController.delete(req, reply)
  );
}

