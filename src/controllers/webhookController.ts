import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { getEffectiveOwnerId } from '../utils/ownership';

export class WebhookController {
  async create(
    request: FastifyRequest<{
      Body: {
        kanban_column_id: string;
        endpoint_url: string;
        auth_type?: 'none' | 'header_token' | 'basic_auth' | 'bearer_token';
        header_name?: string;
        header_value?: string;
        basic_auth_user?: string;
        basic_auth_pass?: string;
        bearer_token?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const {
        kanban_column_id,
        endpoint_url,
        auth_type = 'none',
        header_name,
        header_value,
        basic_auth_user,
        basic_auth_pass,
        bearer_token,
      } = request.body;

      // Validate URL format
      try {
        new URL(endpoint_url);
      } catch {
        return reply.status(400).send({
          success: false,
          error: 'Invalid URL format',
        });
      }

      // Validate auth configuration
      if (auth_type === 'header_token' && (!header_name || !header_value)) {
        return reply.status(400).send({
          success: false,
          error: 'Header name and value are required for header token authentication',
        });
      }

      if (auth_type === 'basic_auth' && (!basic_auth_user || !basic_auth_pass)) {
        return reply.status(400).send({
          success: false,
          error: 'Username and password are required for basic authentication',
        });
      }

      if (auth_type === 'bearer_token' && !bearer_token) {
        return reply.status(400).send({
          success: false,
          error: 'Bearer token is required for bearer token authentication',
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
          auth_type,
          header_name: auth_type === 'header_token' ? header_name : null,
          header_value: auth_type === 'header_token' ? header_value : null,
          basic_auth_user: auth_type === 'basic_auth' ? basic_auth_user : null,
          basic_auth_pass: auth_type === 'basic_auth' ? basic_auth_pass : null,
          bearer_token: auth_type === 'bearer_token' ? bearer_token : null,
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

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        endpoint_url?: string;
        auth_type?: 'none' | 'header_token' | 'basic_auth' | 'bearer_token';
        header_name?: string;
        header_value?: string;
        basic_auth_user?: string;
        basic_auth_pass?: string;
        bearer_token?: string;
        is_active?: boolean;
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
      const {
        endpoint_url,
        auth_type,
        header_name,
        header_value,
        basic_auth_user,
        basic_auth_pass,
        bearer_token,
        is_active,
      } = request.body;

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

      // Validate URL format if provided
      if (endpoint_url) {
        try {
          new URL(endpoint_url);
        } catch {
          return reply.status(400).send({
            success: false,
            error: 'Invalid URL format',
          });
        }
      }

      // Determine the final auth_type
      const finalAuthType = auth_type ?? existingWebhook.auth_type;

      // Validate auth configuration
      if (finalAuthType === 'header_token') {
        const finalHeaderName = header_name ?? existingWebhook.header_name;
        const finalHeaderValue = header_value ?? existingWebhook.header_value;
        if (!finalHeaderName || !finalHeaderValue) {
          return reply.status(400).send({
            success: false,
            error: 'Header name and value are required for header token authentication',
          });
        }
      }

      if (finalAuthType === 'basic_auth') {
        const finalUser = basic_auth_user ?? existingWebhook.basic_auth_user;
        const finalPass = basic_auth_pass ?? existingWebhook.basic_auth_pass;
        if (!finalUser || !finalPass) {
          return reply.status(400).send({
            success: false,
            error: 'Username and password are required for basic authentication',
          });
        }
      }

      if (finalAuthType === 'bearer_token') {
        const finalBearerToken = bearer_token ?? existingWebhook.bearer_token;
        if (!finalBearerToken) {
          return reply.status(400).send({
            success: false,
            error: 'Bearer token is required for bearer token authentication',
          });
        }
      }

      // Build update data
      const updateData: any = {};

      if (endpoint_url !== undefined) updateData.endpoint_url = endpoint_url;
      if (is_active !== undefined) updateData.is_active = is_active;

      if (auth_type !== undefined) {
        updateData.auth_type = auth_type;

        // Clear other auth fields when changing auth type
        if (auth_type === 'none') {
          updateData.header_name = null;
          updateData.header_value = null;
          updateData.basic_auth_user = null;
          updateData.basic_auth_pass = null;
          updateData.bearer_token = null;
        } else if (auth_type === 'header_token') {
          updateData.header_name = header_name ?? existingWebhook.header_name;
          updateData.header_value = header_value ?? existingWebhook.header_value;
          updateData.basic_auth_user = null;
          updateData.basic_auth_pass = null;
          updateData.bearer_token = null;
        } else if (auth_type === 'basic_auth') {
          updateData.header_name = null;
          updateData.header_value = null;
          updateData.basic_auth_user = basic_auth_user ?? existingWebhook.basic_auth_user;
          updateData.basic_auth_pass = basic_auth_pass ?? existingWebhook.basic_auth_pass;
          updateData.bearer_token = null;
        } else if (auth_type === 'bearer_token') {
          updateData.header_name = null;
          updateData.header_value = null;
          updateData.basic_auth_user = null;
          updateData.basic_auth_pass = null;
          updateData.bearer_token = bearer_token ?? existingWebhook.bearer_token;
        }
      } else {
        // Update individual fields if auth_type is not changing
        if (header_name !== undefined) updateData.header_name = header_name;
        if (header_value !== undefined) updateData.header_value = header_value;
        if (basic_auth_user !== undefined) updateData.basic_auth_user = basic_auth_user;
        if (basic_auth_pass !== undefined) updateData.basic_auth_pass = basic_auth_pass;
        if (bearer_token !== undefined) updateData.bearer_token = bearer_token;
      }

      const webhook = await prisma.columnWebhook.update({
        where: { id },
        data: updateData,
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
