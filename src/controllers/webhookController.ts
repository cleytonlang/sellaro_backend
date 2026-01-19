import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { getEffectiveOwnerId } from '../utils/ownership';

export class WebhookController {
  async create(
    request: FastifyRequest<{
      Body: {
        kanban_column_id: string;
        endpoint_url: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { kanban_column_id, endpoint_url } = request.body;

      // Validate URL format
      try {
        new URL(endpoint_url);
      } catch {
        return reply.status(400).send({
          success: false,
          error: 'Invalid URL format',
        });
      }

      // Verificar se a coluna pertence ao owner
      const column = await prisma.kanbanColumn.findUnique({
        where: { id: kanban_column_id },
        include: { form: true },
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

      const webhook = await prisma.columnWebhook.create({
        data: {
          kanban_column_id,
          endpoint_url,
        },
      });

      return reply.status(201).send({
        success: true,
        data: webhook,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create webhook',
      });
    }
  }

  async getByColumn(
    request: FastifyRequest<{ Params: { columnId: string } }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { columnId } = request.params;

      // Verificar se a coluna pertence ao owner
      const column = await prisma.kanbanColumn.findUnique({
        where: { id: columnId },
        include: { form: true },
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

      const webhooks = await prisma.columnWebhook.findMany({
        where: { kanban_column_id: columnId },
        orderBy: { created_at: 'desc' },
      });

      return reply.send({
        success: true,
        data: webhooks,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch webhooks',
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

      const webhook = await prisma.columnWebhook.findUnique({
        where: { id },
        include: {
          kanban_column: {
            include: {
              form: true,
            },
          },
        },
      });

      if (!webhook) {
        return reply.status(404).send({
          success: false,
          error: 'Webhook not found',
        });
      }

      // SEGURANÇA: Verifica ownership através da coluna/form
      if (webhook.kanban_column.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this webhook',
        });
      }

      await prisma.columnWebhook.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Webhook deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete webhook',
      });
    }
  }

  async toggleActive(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { is_active: boolean };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { id } = request.params;
      const { is_active } = request.body;

      // Verificar se o webhook pertence ao owner
      const existingWebhook = await prisma.columnWebhook.findUnique({
        where: { id },
        include: {
          kanban_column: {
            include: {
              form: true,
            },
          },
        },
      });

      if (!existingWebhook) {
        return reply.status(404).send({
          success: false,
          error: 'Webhook not found',
        });
      }

      // SEGURANÇA: Verifica ownership através da coluna/form
      if (existingWebhook.kanban_column.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this webhook',
        });
      }

      const webhook = await prisma.columnWebhook.update({
        where: { id },
        data: { is_active },
      });

      return reply.send({
        success: true,
        data: webhook,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update webhook',
      });
    }
  }
}
