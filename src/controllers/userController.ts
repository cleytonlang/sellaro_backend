import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';

export class UserController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      });

      return reply.send({
        success: true,
        data: users,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.send({
        success: true,
        data: user,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  }

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; image?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const data = request.body;

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });

      return reply.send({
        success: true,
        data: user,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update user',
      });
    }
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      await prisma.user.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete user',
      });
    }
  }
}
