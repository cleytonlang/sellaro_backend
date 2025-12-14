import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';

export class LeadCommentController {
  /**
   * Create a new comment on a lead
   */
  async create(
    request: FastifyRequest<{
      Body: {
        lead_id: string;
        user_id: string;
        content: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { lead_id, user_id, content } = request.body;

      if (!lead_id || !user_id || !content || !content.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'lead_id, user_id, and content are required',
        });
      }

      const comment = await prisma.leadComment.create({
        data: {
          lead_id,
          user_id,
          content: content.trim(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: comment,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create comment',
      });
    }
  }

  /**
   * Get all comments for a lead
   */
  async getByLeadId(
    request: FastifyRequest<{
      Params: { lead_id: string };
      Querystring: { page?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { lead_id } = request.params;
      const { page = '1' } = request.query;

      const pageNumber = Math.max(1, parseInt(page) || 1);
      const pageSize = 50;
      const skip = (pageNumber - 1) * pageSize;

      const [comments, total] = await Promise.all([
        prisma.leadComment.findMany({
          where: { lead_id },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.leadComment.count({ where: { lead_id } }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return reply.send({
        success: true,
        data: comments,
        pagination: {
          page: pageNumber,
          pageSize,
          total,
          totalPages,
          hasNextPage: pageNumber < totalPages,
          hasPreviousPage: pageNumber > 1,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch comments',
      });
    }
  }

  /**
   * Update a comment
   */
  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        content: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const { content } = request.body;

      if (!content || !content.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'content is required',
        });
      }

      const comment = await prisma.leadComment.update({
        where: { id },
        data: { content: content.trim() },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: comment,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update comment',
      });
    }
  }

  /**
   * Delete a comment
   */
  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      await prisma.leadComment.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete comment',
      });
    }
  }
}
