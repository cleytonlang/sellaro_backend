import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { openaiService } from '../services/openaiService';
import { addWebhookToQueue } from '../queues/webhookQueue';
import { getEffectiveOwnerId, isOwner } from '../utils/ownership';

interface FormField {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
  options?: string[];
}

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

      // Get the owner of the form to find team members for assignment
      let assignedUserId: string | null = null;
      if (form?.userId) {
        // Get the effective owner (the main account owner)
        const formOwner = await prisma.user.findUnique({
          where: { id: form.userId },
          select: { id: true, owner_id: true },
        });

        const effectiveOwnerId = formOwner?.owner_id || form.userId;

        // Find all team members (users with owner_id pointing to the effective owner)
        // These are non-owner users who can receive leads
        const teamMembers = await prisma.user.findMany({
          where: {
            owner_id: effectiveOwnerId,
          },
          select: { id: true },
        });

        // If there are team members, randomly assign one
        if (teamMembers.length > 0) {
          const randomIndex = Math.floor(Math.random() * teamMembers.length);
          assignedUserId = teamMembers[randomIndex].id;
        }
      }

      const lead = await prisma.lead.create({
        data: {
          form_id,
          form_data,
          kanban_column_id: kanbanColumn.id,
          assigned_user_id: assignedUserId,
          ip_address: request.ip,
          user_agent: request.headers['user-agent'],
          referrer_url: request.headers.referer,
        },
        include: {
          form: true,
          kanban_column: true,
          assigned_user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Create initial movement log
      await prisma.leadMovementLog.create({
        data: {
          lead_id: lead.id,
          from_column_id: null,
          to_column_id: kanbanColumn.id,
          from_column_name: null,
          to_column_name: kanbanColumn.name,
          movement_type: 'INITIAL',
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

        // Get assistant to access user_id for OpenAI client, initial message and name
        const assistant = await prisma.assistant.findUnique({
          where: { id: form.assistant_id },
          select: {
            userId: true,
            openai_assistant_id: true,
            initial_message: true,
            name: true,
          },
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
            messages: {
              orderBy: { created_at: 'asc' },
            },
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

        // Send context information and initial message to the thread
        if (threadId && assistant) {
          try {
            // Format form data for better readability
            const formDataText = Object.entries(form_data)
              .map(([key, value]) => {
                // Find the field label from form fields
                let label = key;
                if (form.fields && Array.isArray(form.fields)) {
                  const fieldsUnknown = form.fields as unknown;
                  const fields = fieldsUnknown as FormField[];
                  const field = fields.find((f) => f.id === key);
                  label = field?.label || key;
                }

                // Format value (handle arrays for checkboxes)
                const formattedValue = Array.isArray(value) ? value.join(', ') : value;

                return `${label}: ${formattedValue}`;
              })
              .join('\n');

            // Prepare context message with assistant name and form data
            const contextMessage = `[CONTEXTO DO SISTEMA - Esta mensagem é apenas para contexto e não deve ser exibida ao usuário]

Nome da Assistente: ${assistant.name}

Dados do formulário preenchido pelo usuário:
${formDataText}

Instruções:
- Você é ${assistant.name}
- Use as informações do formulário acima para personalizar suas respostas
- O usuário já forneceu essas informações, não peça novamente
- Seja prestativa e utilize o contexto fornecido`;

            // Add context message to the thread (this won't be saved to DB, just sent to OpenAI)
            await openaiService.addMessageToThread(
              assistant.userId,
              threadId,
              'user',
              contextMessage
            );

            console.log(`✅ Context (assistant name + form data) added to OpenAI thread`);

            // Send initial message from assistant if configured
            if (assistant.initial_message && assistant.initial_message.trim()) {
              console.log(`💬 Sending initial message to conversation ${conversation.id}`);

              // Add the initial message to the OpenAI thread
              const addedToThread = await openaiService.addMessageToThread(
                assistant.userId,
                threadId,
                'assistant',
                assistant.initial_message
              );

              if (addedToThread) {
                console.log(`✅ Initial message added to OpenAI thread`);

                // Save the initial message to the database (only the initial message, not the context)
                await prisma.message.create({
                  data: {
                    conversation_id: conversation.id,
                    role: 'assistant',
                    content: assistant.initial_message,
                  },
                });

                console.log(`✅ Initial message saved to database`);
              } else {
                console.warn(`⚠️ Failed to add initial message to OpenAI thread`);
              }
            }
          } catch (error) {
            // Log error but don't fail the conversation creation
            console.error(`❌ Error sending context or initial message:`, error);
            request.log.error({
              error,
              conversationId: conversation.id,
              message: 'Failed to send context or initial message',
            });
          }
        } else {
          console.log(`ℹ️ No thread created or assistant not found`);
        }

        // Fetch conversation with updated messages
        conversation = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          include: {
            assistant: true,
            messages: {
              orderBy: { created_at: 'asc' },
            },
          },
        });
      } else {
        console.log(`ℹ️ Form ${form_id} has no assistant, skipping conversation creation`);
      }

      // Trigger webhooks for the new lead's column (usually "Novo")
      console.log(`📍 Lead ${lead.id} created in column ${kanbanColumn.id} - checking for webhooks...`);

      // Get active webhooks for the column
      const webhooks = await prisma.columnWebhook.findMany({
        where: {
          kanban_column_id: kanbanColumn.id,
          is_active: true,
        },
      });

      if (webhooks.length > 0) {
        console.log(`🔗 Found ${webhooks.length} active webhook(s) for column ${kanbanColumn.id}`);

        // Add each webhook to the queue
        const timestamp = new Date().toISOString();
        for (const webhook of webhooks) {
          try {
            await addWebhookToQueue({
              webhookId: webhook.id,
              webhookUrl: webhook.endpoint_url,
              leadId: lead.id,
              columnId: lead.kanban_column.id,
              columnName: lead.kanban_column.name,
              leadData: lead.form_data as Record<string, any>,
              timestamp,
            });

            console.log(`✅ Webhook ${webhook.id} queued for new lead ${lead.id}`);
          } catch (error) {
            console.error(`❌ Failed to queue webhook ${webhook.id}:`, error);
            // Continue with other webhooks even if one fails to queue
          }
        }
      } else {
        console.log(`ℹ️ No active webhooks configured for column ${kanbanColumn.id}`);
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
      Querystring: { form_id?: string; kanban_column_id?: string; search?: string; page?: string; date_from?: string; date_to?: string; limit?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para ver leads de toda a conta/empresa
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      // Verifica se o usuário é owner ou membro do time
      const userIsOwner = await isOwner(userId);

      // DEBUG LOG
      console.log('🔍 [LEADS DEBUG] userId:', userId);
      console.log('🔍 [LEADS DEBUG] effectiveOwnerId:', effectiveOwnerId);
      console.log('🔍 [LEADS DEBUG] userIsOwner:', userIsOwner);

      const { form_id, kanban_column_id, search, page = '1', date_from, date_to, limit } = request.query;

      const pageNumber = Math.max(1, parseInt(page) || 1);
      const pageSize = limit ? parseInt(limit) : 10;
      const skip = (pageNumber - 1) * pageSize;

      let where: any = {
        deleted_at: null, // Only get non-deleted leads
        // Filtrar por leads de formulários que pertencem ao owner
        form: {
          userId: effectiveOwnerId,
        },
      };

      // REGRA DE NEGÓCIO: Membros do time veem apenas leads atribuídos a eles
      if (!userIsOwner) {
        where.assigned_user_id = userId;
        console.log('🔍 [LEADS DEBUG] Filtro aplicado: assigned_user_id =', userId);
      } else {
        console.log('🔍 [LEADS DEBUG] Usuário é OWNER - vendo todos os leads');
      }

      console.log('🔍 [LEADS DEBUG] Where filter:', JSON.stringify(where, null, 2));

      // Only filter by form_id if it's provided and not empty
      if (form_id && form_id.trim() !== '') {
        where.form_id = form_id;
      }

      if (kanban_column_id) where.kanban_column_id = kanban_column_id;

      // Add date range filter if provided
      if (date_from || date_to) {
        where.created_at = {};
        if (date_from) {
          where.created_at.gte = new Date(date_from);
        }
        if (date_to) {
          where.created_at.lte = new Date(date_to);
        }
      }

      // If search is provided, use raw SQL for JSONB text search
      let leads: any[] = [];
      let total: number = 0;

      if (search && search.trim()) {
        const searchTerm = search.trim();

        // Build the SQL conditions
        const conditions = ['l.deleted_at IS NULL'];
        const params: any[] = [];
        let paramIndex = 1;

        // SEGURANÇA: Filtrar por leads de forms que pertencem ao owner
        conditions.push(`f."userId" = $${paramIndex}`);
        params.push(effectiveOwnerId);
        paramIndex++;

        // REGRA DE NEGÓCIO: Membros do time veem apenas leads atribuídos a eles
        if (!userIsOwner) {
          conditions.push(`l.assigned_user_id = $${paramIndex}`);
          params.push(userId);
          paramIndex++;
        }

        // Only filter by form_id if it's provided and not empty
        if (form_id && form_id.trim() !== '') {
          conditions.push(`l.form_id = $${paramIndex}`);
          params.push(form_id);
          paramIndex++;
        }

        if (kanban_column_id) {
          conditions.push(`l.kanban_column_id = $${paramIndex}`);
          params.push(kanban_column_id);
          paramIndex++;
        }

        // Add date range filter if provided
        if (date_from) {
          conditions.push(`l.created_at >= $${paramIndex}`);
          params.push(new Date(date_from));
          paramIndex++;
        }
        if (date_to) {
          conditions.push(`l.created_at <= $${paramIndex}`);
          params.push(new Date(date_to));
          paramIndex++;
        }

        // Add JSONB search condition - convert JSONB to text and search
        conditions.push(`l.form_data::text ILIKE $${paramIndex}`);
        params.push(`%${searchTerm}%`);
        paramIndex++;

        const whereClause = conditions.join(' AND ');

        // Get total count (com JOIN para filtrar por owner)
        const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT COUNT(*)::int as count FROM "lead" l INNER JOIN "form" f ON l.form_id = f.id WHERE ${whereClause}`,
          ...params
        );
        total = Number(countResult[0].count);

        // Get leads with pagination (com JOIN para filtrar por owner)
        const leadsResult = await prisma.$queryRawUnsafe<any[]>(
          `SELECT l.id FROM "lead" l INNER JOIN "form" f ON l.form_id = f.id WHERE ${whereClause} ORDER BY l.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          ...params,
          pageSize,
          skip
        );

        // Fetch full lead data with relations
        const leadIds = leadsResult.map(l => l.id);

        if (leadIds.length > 0) {
          leads = await prisma.lead.findMany({
            where: { id: { in: leadIds } },
            include: {
              form: true,
              kanban_column: true,
              assigned_user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              _count: {
                select: {
                  conversations: true,
                  events: true,
                },
              },
            },
            orderBy: { created_at: 'desc' },
          });
        } else {
          leads = [];
        }
      } else {
        // No search, use regular Prisma query
        total = await prisma.lead.count({ where });

        leads = await prisma.lead.findMany({
          where,
          include: {
            form: true,
            kanban_column: true,
            assigned_user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
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
      }

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
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      // Verifica se o usuário é owner ou membro do time
      const userIsOwner = await isOwner(userId);
      const { id } = request.params;

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
          form: true,
          kanban_column: true,
          assigned_user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          conversations: {
            include: {
              assistant: true,
              messages: {
                orderBy: { created_at: 'asc' },
              },
            },
          },
          events: {
            orderBy: { created_at: 'desc' },
          },
          comments: {
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
          },
        },
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

      // REGRA DE NEGÓCIO: Membros do time só podem ver leads atribuídos a eles
      if (!userIsOwner && lead.assigned_user_id !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: This lead is not assigned to you',
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
        assigned_user_id?: string | null;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      // Verifica se o usuário é owner ou membro do time
      const userIsOwner = await isOwner(userId);
      const { id } = request.params;
      const data = request.body;

      // Get current lead data before update
      const currentLead = await prisma.lead.findUnique({
        where: { id },
        include: {
          kanban_column: true,
          form: true,
        },
      });

      if (!currentLead) {
        return reply.status(404).send({
          success: false,
          error: 'Lead not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do form
      if (currentLead.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: You do not have access to this lead',
        });
      }

      // REGRA DE NEGÓCIO: Membros do time só podem editar leads atribuídos a eles
      if (!userIsOwner && currentLead.assigned_user_id !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: This lead is not assigned to you',
        });
      }

      // Update lead
      const lead = await prisma.lead.update({
        where: { id },
        data,
        include: {
          form: true,
          kanban_column: true,
          assigned_user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Check if column was changed
      const columnChanged = data.kanban_column_id &&
                           currentLead?.kanban_column_id !== data.kanban_column_id;

      // If column changed, create movement log and trigger webhooks
      if (columnChanged && data.kanban_column_id && currentLead) {
        // Create movement log
        await prisma.leadMovementLog.create({
          data: {
            lead_id: lead.id,
            from_column_id: currentLead.kanban_column_id,
            to_column_id: data.kanban_column_id,
            from_column_name: currentLead.kanban_column.name,
            to_column_name: lead.kanban_column.name,
            movement_type: 'MANUAL',
            user_id: request.user?.id || null,
          },
        });

        console.log(`📍 Lead ${id} moved to column ${data.kanban_column_id} - checking for webhooks...`);

        // Get active webhooks for the new column
        const webhooks = await prisma.columnWebhook.findMany({
          where: {
            kanban_column_id: data.kanban_column_id,
            is_active: true,
          },
        });

        if (webhooks.length > 0) {
          console.log(`🔗 Found ${webhooks.length} active webhook(s) for column ${data.kanban_column_id}`);

          // Add each webhook to the queue
          const timestamp = new Date().toISOString();
          for (const webhook of webhooks) {
            try {
              await addWebhookToQueue({
                webhookId: webhook.id,
                webhookUrl: webhook.endpoint_url,
                leadId: lead.id,
                columnId: lead.kanban_column.id,
                columnName: lead.kanban_column.name,
                leadData: lead.form_data as Record<string, any>,
                timestamp,
              });

              console.log(`✅ Webhook ${webhook.id} queued for lead ${lead.id}`);
            } catch (error) {
              console.error(`❌ Failed to queue webhook ${webhook.id}:`, error);
              // Continue with other webhooks even if one fails to queue
            }
          }
        } else {
          console.log(`ℹ️ No active webhooks configured for column ${data.kanban_column_id}`);
        }
      }

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
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      // Verifica se o usuário é owner ou membro do time
      const userIsOwner = await isOwner(userId);
      const { id } = request.params;

      // Get lead to verify ownership
      const lead = await prisma.lead.findUnique({
        where: { id },
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

      // REGRA DE NEGÓCIO: Membros do time só podem deletar leads atribuídos a eles
      if (!userIsOwner && lead.assigned_user_id !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: This lead is not assigned to you',
        });
      }

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

  async getMovementLogs(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      // Verifica se o usuário é owner ou membro do time
      const userIsOwner = await isOwner(userId);
      const { id } = request.params;

      // Get lead to verify ownership
      const lead = await prisma.lead.findUnique({
        where: { id },
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

      // REGRA DE NEGÓCIO: Membros do time só podem ver logs de leads atribuídos a eles
      if (!userIsOwner && lead.assigned_user_id !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: This lead is not assigned to you',
        });
      }

      // Get all movement logs for this lead
      const logs = await prisma.leadMovementLog.findMany({
        where: { lead_id: id },
        orderBy: { created_at: 'asc' },
      });

      // Calculate time spent in each column
      const logsWithDuration = logs.map((log, index) => {
        const nextLog = logs[index + 1];
        let duration = null;

        if (nextLog) {
          const diff = nextLog.created_at.getTime() - log.created_at.getTime();
          duration = {
            milliseconds: diff,
            seconds: Math.floor(diff / 1000),
            minutes: Math.floor(diff / 1000 / 60),
            hours: Math.floor(diff / 1000 / 60 / 60),
            days: Math.floor(diff / 1000 / 60 / 60 / 24),
          };
        } else {
          // For the current column, calculate time from movement to now
          const diff = new Date().getTime() - log.created_at.getTime();
          duration = {
            milliseconds: diff,
            seconds: Math.floor(diff / 1000),
            minutes: Math.floor(diff / 1000 / 60),
            hours: Math.floor(diff / 1000 / 60 / 60),
            days: Math.floor(diff / 1000 / 60 / 60 / 24),
            current: true,
          };
        }

        return {
          ...log,
          duration,
        };
      });

      return reply.send({
        success: true,
        data: logsWithDuration,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch movement logs',
      });
    }
  }

  async getEvents(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para verificar acesso
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      // Verifica se o usuário é owner ou membro do time
      const userIsOwner = await isOwner(userId);
      const { id } = request.params;

      // Get lead to verify ownership
      const lead = await prisma.lead.findUnique({
        where: { id },
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

      // REGRA DE NEGÓCIO: Membros do time só podem ver eventos de leads atribuídos a eles
      if (!userIsOwner && lead.assigned_user_id !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: This lead is not assigned to you',
        });
      }

      // Get all events for this lead
      const events = await prisma.leadEvent.findMany({
        where: { lead_id: id },
        orderBy: { created_at: 'desc' },
      });

      return reply.send({
        success: true,
        data: events,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch lead events',
      });
    }
  }
}
