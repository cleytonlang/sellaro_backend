import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';

export class FormController {
  async create(
    request: FastifyRequest<{
      Body: {
        name: string;
        description?: string;
        fields: any;
        settings?: any;
        assistant_id?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado, não do body da request
      const userId = request.user!.id;
      const { name, description, fields, settings, assistant_id } = request.body;

      const form = await prisma.form.create({
        data: {
          userId,
          name,
          description,
          fields,
          settings,
          assistant_id,
        },
      });

      // Create default "Novo" kanban column
      await prisma.kanbanColumn.create({
        data: {
          form_id: form.id,
          name: 'Novo',
          order: 0,
          color: '#3b82f6',
        },
      });

      return reply.status(201).send({
        success: true,
        data: form,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create form',
      });
    }
  }

  async getAll(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado, não da query string
      const userId = request.user!.id;

      const forms = await prisma.form.findMany({
        where: { userId },
        include: {
          assistant: true,
          _count: {
            select: {
              leads: {
                where: {
                  deleted_at: null
                }
              }
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return reply.send({
        success: true,
        data: forms,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch forms',
      });
    }
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      const { id } = request.params;

      const form = await prisma.form.findUnique({
        where: { id },
        include: {
          assistant: true,
          leads: {
            take: 10,
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!form) {
        return reply.status(404).send({
          success: false,
          error: 'Form not found',
        });
      }

      // SEGURANÇA: Verifica se o form pertence ao usuário autenticado
      if (form.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this form',
        });
      }

      return reply.send({
        success: true,
        data: form,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch form',
      });
    }
  }

  async getByEmbedCode(
    request: FastifyRequest<{ Params: { embedCode: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { embedCode } = request.params;

      const form = await prisma.form.findUnique({
        where: { embed_code: embedCode },
        include: {
          assistant: true,
        },
      });

      if (!form || !form.is_active) {
        return reply.status(404).send({
          success: false,
          error: 'Form not found or inactive',
        });
      }

      return reply.send({
        success: true,
        data: form,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch form',
      });
    }
  }

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        name?: string;
        description?: string;
        fields?: any;
        settings?: any;
        assistant_id?: string;
        is_active?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      const { id } = request.params;
      const data = request.body;

      // SEGURANÇA: Verifica ownership antes de atualizar
      const existingForm = await prisma.form.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existingForm) {
        return reply.status(404).send({
          success: false,
          error: 'Form not found',
        });
      }

      if (existingForm.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this form',
        });
      }

      const form = await prisma.form.update({
        where: { id },
        data,
      });

      return reply.send({
        success: true,
        data: form,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update form',
      });
    }
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      const { id } = request.params;

      // SEGURANÇA: Verifica ownership antes de deletar
      const existingForm = await prisma.form.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existingForm) {
        return reply.status(404).send({
          success: false,
          error: 'Form not found',
        });
      }

      if (existingForm.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this form',
        });
      }

      await prisma.form.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Form deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete form',
      });
    }
  }

  async getKanbanColumns(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      const { id } = request.params;

      // SEGURANÇA: Verifica ownership antes de retornar colunas
      const form = await prisma.form.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!form) {
        return reply.status(404).send({
          success: false,
          error: 'Form not found',
        });
      }

      if (form.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this form',
        });
      }

      const columns = await prisma.kanbanColumn.findMany({
        where: { form_id: id },
        orderBy: { order: 'asc' },
      });

      return reply.send({
        success: true,
        data: columns,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch kanban columns',
      });
    }
  }
}
