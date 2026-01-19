import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { getEffectiveOwnerId } from '../utils/ownership';

export class KanbanController {
  async create(
    request: FastifyRequest<{
      Body: {
        form_id: string;
        name: string;
        order: number;
        color?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { form_id, name, order, color } = request.body;

      // Verificar se o form pertence ao owner
      const form = await prisma.form.findUnique({
        where: { id: form_id },
      });

      if (!form) {
        return reply.status(404).send({
          success: false,
          error: 'Form not found',
        });
      }

      // SEGURANÇA: Verifica ownership do form
      if (form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this form',
        });
      }

      const kanbanColumn = await prisma.kanbanColumn.create({
        data: {
          form_id,
          name,
          order,
          color,
        },
      });

      return reply.status(201).send({
        success: true,
        data: kanbanColumn,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create kanban column',
      });
    }
  }

  async getAll(
    request: FastifyRequest<{ Querystring: { form_id?: string } }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para ver colunas de toda a conta/empresa
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { form_id } = request.query;

      // Build where clause - always filter by owner's forms
      const where: any = {
        form: {
          userId: effectiveOwnerId,
        },
      };

      // Only filter by form_id if provided
      if (form_id) {
        where.form_id = form_id;
      }

      const kanbanColumns = await prisma.kanbanColumn.findMany({
        where,
        include: {
          leads: {
            where: { deleted_at: null }, // Only get non-deleted leads
            include: {
              form: true,
            },
            orderBy: { created_at: 'desc' },
          },
        },
        orderBy: { order: 'asc' },
      });

      return reply.send({
        success: true,
        data: kanbanColumns,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch kanban columns',
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
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { id } = request.params;

      const kanbanColumn = await prisma.kanbanColumn.findUnique({
        where: { id },
        include: {
          form: true,
          leads: {
            where: { deleted_at: null }, // Only get non-deleted leads
            include: {
              form: true,
            },
          },
        },
      });

      if (!kanbanColumn) {
        return reply.status(404).send({
          success: false,
          error: 'Kanban column not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do form
      if (kanbanColumn.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this kanban column',
        });
      }

      return reply.send({
        success: true,
        data: kanbanColumn,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch kanban column',
      });
    }
  }

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        name?: string;
        order?: number;
        color?: string;
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
      const data = request.body;

      // Get column to verify ownership
      const existingColumn = await prisma.kanbanColumn.findUnique({
        where: { id },
        include: { form: true },
      });

      if (!existingColumn) {
        return reply.status(404).send({
          success: false,
          error: 'Kanban column not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do form
      if (existingColumn.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this kanban column',
        });
      }

      const kanbanColumn = await prisma.kanbanColumn.update({
        where: { id },
        data,
      });

      return reply.send({
        success: true,
        data: kanbanColumn,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update kanban column',
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
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { id } = request.params;

      // Check if column exists and count leads
      const column = await prisma.kanbanColumn.findUnique({
        where: { id },
        include: {
          form: true,
          _count: {
            select: { leads: true },
          },
        },
      });

      if (!column) {
        return reply.status(404).send({
          success: false,
          error: 'Kanban column not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do form
      if (column.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this kanban column',
        });
      }

      // Prevent deletion if column has leads
      if (column._count.leads > 0) {
        return reply.status(400).send({
          success: false,
          error: `Cannot delete column with ${column._count.leads} lead(s). Please move or delete the leads first.`,
          leadCount: column._count.leads,
        });
      }

      await prisma.kanbanColumn.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Kanban column deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete kanban column',
      });
    }
  }

  async reorder(
    request: FastifyRequest<{
      Body: {
        columns: Array<{ id: string; order: number }>;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { columns } = request.body;

      // Verify ownership for all columns before updating
      const columnIds = columns.map(c => c.id);
      const existingColumns = await prisma.kanbanColumn.findMany({
        where: { id: { in: columnIds } },
        include: { form: true },
      });

      // Check if all columns exist
      if (existingColumns.length !== columnIds.length) {
        return reply.status(404).send({
          success: false,
          error: 'One or more kanban columns not found',
        });
      }

      // SEGURANÇA: Verifica ownership de todas as colunas
      for (const column of existingColumns) {
        if (column.form.userId !== effectiveOwnerId) {
          return reply.status(403).send({
            success: false,
            error: 'Forbidden: You do not have access to one or more kanban columns',
          });
        }
      }

      // Update all columns in a transaction
      await prisma.$transaction(
        columns.map((col) =>
          prisma.kanbanColumn.update({
            where: { id: col.id },
            data: { order: col.order },
          })
        )
      );

      return reply.send({
        success: true,
        message: 'Kanban columns reordered successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to reorder kanban columns',
      });
    }
  }
}
