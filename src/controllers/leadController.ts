import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { openaiService } from '../services/openaiService';

export class LeadController {
  async create(
    request: FastifyRequest<{
      Body: {
        form_id: string;
        form_data: any;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { form_id, form_data } = request.body;

      // Get the default "Novo" kanban column for this form
      const kanbanColumn = await prisma.kanbanColumn.findFirst({
        where: {
          form_id,
          name: 'Novo',
        },
      });

      if (!kanbanColumn) {
        return reply.status(400).send({
          success: false,
          error: 'Default kanban column not found for this form',
        });
      }

      // Fetch form with assistant to check if we need to create a conversation
      const form = await prisma.form.findUnique({
        where: { id: form_id },
        include: { assistant: true },
      });

      const lead = await prisma.lead.create({
        data: {
          form_id,
          form_data,
          kanban_column_id: kanbanColumn.id,
          ip_address: request.ip,
          user_agent: request.headers['user-agent'],
          referrer_url: request.headers.referer,
        },
        include: {
          form: true,
          kanban_column: true,
        },
      });

      // Create lead event
      await prisma.leadEvent.create({
        data: {
          lead_id: lead.id,
          type: 'FORM_SUBMITTED',
          data: form_data,
        },
      });

      // If form has an assistant, create conversation automatically
      let conversation = null;
      if (form?.assistant_id) {
        console.log(`📝 Creating conversation for lead ${lead.id} with assistant ${form.assistant_id}`);

        // Get assistant to access user_id for OpenAI client
        const assistant = await prisma.assistant.findUnique({
          where: { id: form.assistant_id },
          select: { userId: true, openai_assistant_id: true },
        });

        // Create OpenAI thread
        let threadId: string | null = null;
        if (assistant?.userId) {
          threadId = await openaiService.createThread(assistant.userId);
          if (threadId) {
            console.log(`🧵 OpenAI thread created: ${threadId}`);
          } else {
            console.warn(`⚠️ Failed to create OpenAI thread for conversation`);
          }
        }

        conversation = await prisma.conversation.create({
          data: {
            lead_id: lead.id,
            assistant_id: form.assistant_id,
            thread_id: threadId,
          },
          include: {
            assistant: true,
          },
        });

        console.log(`✅ Conversation created: ${conversation.id}`);

        // Create lead event for chat started
        await prisma.leadEvent.create({
          data: {
            lead_id: lead.id,
            type: 'CHAT_STARTED',
            data: {
              conversation_id: conversation.id,
              assistant_id: form.assistant_id,
            },
          },
        });
      } else {
        console.log(`ℹ️ Form ${form_id} has no assistant, skipping conversation creation`);
      }

      return reply.status(201).send({
        success: true,
        data: {
          ...lead,
          conversation,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create lead',
      });
    }
  }

  async getAll(
    request: FastifyRequest<{
      Querystring: { form_id: string; kanban_column_id?: string; page?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { form_id, kanban_column_id, page = '1' } = request.query;

      // form_id is required
      if (!form_id) {
        return reply.status(400).send({
          success: false,
          error: 'form_id is required',
        });
      }

      const pageNumber = Math.max(1, parseInt(page) || 1);
      const pageSize = 10;
      const skip = (pageNumber - 1) * pageSize;

      const where: any = {
        deleted_at: null, // Only get non-deleted leads
        form_id,
      };
      if (kanban_column_id) where.kanban_column_id = kanban_column_id;

      // Get total count for pagination
      const total = await prisma.lead.count({ where });

      const leads = await prisma.lead.findMany({
        where,
        include: {
          form: true,
          kanban_column: true,
          _count: {
            select: {
              conversations: true,
              events: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      });

      const totalPages = Math.ceil(total / pageSize);

      return reply.send({
        success: true,
        data: leads,
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
        error: 'Failed to fetch leads',
      });
    }
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
          form: true,
          kanban_column: true,
          conversations: {
            include: {
              messages: {
                orderBy: { created_at: 'asc' },
              },
            },
          },
          events: {
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: 'Lead not found',
        });
      }

      return reply.send({
        success: true,
        data: lead,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch lead',
      });
    }
  }

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        kanban_column_id?: string;
        form_data?: any;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const data = request.body;

      const lead = await prisma.lead.update({
        where: { id },
        data,
        include: {
          form: true,
          kanban_column: true,
        },
      });

      return reply.send({
        success: true,
        data: lead,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update lead',
      });
    }
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Soft delete: set deleted_at timestamp
      await prisma.lead.update({
        where: { id },
        data: {
          deleted_at: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: 'Lead deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete lead',
      });
    }
  }
}
