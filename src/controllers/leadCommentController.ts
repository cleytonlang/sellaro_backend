import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { getEffectiveOwnerId } from '../utils/ownership';

export class LeadCommentController {
  /**
   * Create a new comment on a lead
   */
  async create(
    request: FastifyRequest<{
      Body: {
        lead_id: string;
        content: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { lead_id, content } = request.body;

      if (!lead_id || !content || !content.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'lead_id and content are required',
        });
      }

      // Verificar se o lead pertence ao owner
      const lead = await prisma.lead.findUnique({
        where: { id: lead_id },
        include: { form: true },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: 'Lead not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do form
      if (lead.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this lead',
        });
      }

      const comment = await prisma.leadComment.create({
        data: {
          lead_id,
          user_id: userId, // Usa o userId autenticado
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
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { lead_id } = request.params;
      const { page = '1' } = request.query;

      // Verificar se o lead pertence ao owner
      const lead = await prisma.lead.findUnique({
        where: { id: lead_id },
        include: { form: true },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: 'Lead not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do form
      if (lead.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this lead',
        });
      }

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
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { id } = request.params;
      const { content } = request.body;

      if (!content || !content.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'content is required',
        });
      }

      // Verificar se o comentário existe e pertence ao owner
      const existingComment = await prisma.leadComment.findUnique({
        where: { id },
        include: {
          lead: {
            include: {
              form: true,
            },
          },
        },
      });

      if (!existingComment) {
        return reply.status(404).send({
          success: false,
          error: 'Comment not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do lead/form
      if (existingComment.lead.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this comment',
        });
      }

      // Permitir apenas que o autor do comentário ou o owner edite
      if (existingComment.user_id !== userId && existingComment.lead.form.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: Only the comment author or owner can edit this comment',
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
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { id } = request.params;

      // Verificar se o comentário existe e pertence ao owner
      const existingComment = await prisma.leadComment.findUnique({
        where: { id },
        include: {
          lead: {
            include: {
              form: true,
            },
          },
        },
      });

      if (!existingComment) {
        return reply.status(404).send({
          success: false,
          error: 'Comment not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do lead/form
      if (existingComment.lead.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this comment',
        });
      }

      // Permitir apenas que o autor do comentário ou o owner delete
      if (existingComment.user_id !== userId && existingComment.lead.form.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: Only the comment author or owner can delete this comment',
        });
      }

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
