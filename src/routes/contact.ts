import { FastifyInstance } from 'fastify';
import { ContactController } from '../controllers/contactController';

export async function contactRoutes(app: FastifyInstance) {
  const controller = new ContactController();

  // Send contact form email (public route)
  app.post('/api/contact',
    (request, reply) => controller.sendContactEmail(request as any, reply)
  );
}
