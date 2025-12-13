import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../lib/auth';

export default async function betterAuthRoutes(fastify: FastifyInstance) {
  // Handle all auth routes (GET and POST)
  fastify.all('/auth/*', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Construir a URL completa com o protocolo e host corretos
      const protocol = request.headers['x-forwarded-proto'] || request.protocol;
      const host = request.headers['x-forwarded-host'] || request.hostname;
      const url = new URL(request.url, `${protocol}://${host}`);

      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      });

      // Create Web Request
      const webRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? JSON.stringify(request.body)
          : undefined,
      });

      // Call better-auth handler
      const response = await auth.handler(webRequest);

      // Set response headers preservando cookies
      response.headers.forEach((value, key) => {
        // Set-Cookie precisa de tratamento especial no Fastify
        if (key.toLowerCase() === 'set-cookie') {
          reply.header(key, value);
        } else {
          reply.header(key, value);
        }
      });

      // Get response body
      const responseBody = await response.text();

      // Send response
      return reply
        .code(response.status)
        .send(responseBody || {});
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Authentication error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
