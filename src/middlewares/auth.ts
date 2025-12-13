import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'No token provided',
      });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Add user to request
    (request as any).user = session.user;
  } catch (error) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication failed',
    });
  }
}

export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (session && session.expiresAt >= new Date()) {
        (request as any).user = session.user;
      }
    }
  } catch (_error) {
    // Ignore errors in optional auth
  }
}
