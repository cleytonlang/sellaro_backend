import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';

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
      const { form_id, name, order, color } = request.body;

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
      const { form_id } = request.query;

      const kanbanColumns = await prisma.kanbanColumn.findMany({
        where: form_id ? { form_id } : undefined,
        include: {
          leads: {
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
      const { id } = request.params;

      const kanbanColumn = await prisma.kanbanColumn.findUnique({
        where: { id },
        include: {
          leads: {
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
      const { id } = request.params;
      const data = request.body;

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
      const { id } = request.params;

      // Check if column exists and count leads
      const column = await prisma.kanbanColumn.findUnique({
        where: { id },
        include: {
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
      const { columns } = request.body;

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
