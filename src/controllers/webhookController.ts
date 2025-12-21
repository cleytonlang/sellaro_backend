import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';

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
      const { columnId } = request.params;

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
      const { id } = request.params;

      const webhook = await prisma.columnWebhook.findUnique({
        where: { id },
      });

      if (!webhook) {
        return reply.status(404).send({
          success: false,
          error: 'Webhook not found',
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
      const { id } = request.params;
      const { is_active } = request.body;

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
