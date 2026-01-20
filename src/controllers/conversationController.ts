import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { openaiService } from '../services/openaiService';
import { addMessageToQueue, getMessageJobStatus } from '../queues/messageQueue';
import { getEffectiveOwnerId } from '../utils/ownership';

export class ConversationController {
  async create(
    request: FastifyRequest<{
      Body: {
        lead_id?: string;
        assistant_id: string;
        thread_id?: string;
        user_id?: string; // For playground mode
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { lead_id, assistant_id, thread_id, user_id } = request.body;

      // Get assistant and user info
      const assistant = await prisma.assistant.findUnique({
        where: { id: assistant_id },
        select: {
          userId: true,
          openai_assistant_id: true,
          initial_message: true,
          forms: { take: 1 }
        },
      });

      if (!assistant) {
        return reply.status(404).send({
          error: 'Assistant not found',
        });
      }

      // If no lead_id provided (playground mode), create or get a playground lead
      let finalLeadId = lead_id;
      if (!finalLeadId && user_id) {
        // Check if there's a playground lead for this user
        const existingPlaygroundLead = await prisma.lead.findFirst({
          where: {
            form_data: {
              path: ['playground_user_id'],
              equals: user_id,
            },
          },
        });

        if (existingPlaygroundLead) {
          finalLeadId = existingPlaygroundLead.id;
        } else {
          // Get or create a default form for playground
          let playgroundForm = await prisma.form.findFirst({
            where: {
              userId: assistant.userId,
              name: 'Playground',
            },
          });

          if (!playgroundForm) {
            // Create a default form for playground with kanban column
            playgroundForm = await prisma.form.create({
              data: {
                userId: assistant.userId,
                name: 'Playground',
                fields: [],
                kanban_columns: {
                  create: {
                    name: 'Playground',
                    order: 0,
                    color: '#3B82F6', // Blue
                  },
                },
              },
              include: {
                kanban_columns: true,
              },
            });
          }

          // Get default kanban column
          let defaultColumn = await prisma.kanbanColumn.findFirst({
            where: {
              form_id: playgroundForm.id,
            },
            orderBy: {
              order: 'asc',
            },
          });

          // Create default column if it doesn't exist
          if (!defaultColumn) {
            defaultColumn = await prisma.kanbanColumn.create({
              data: {
                form_id: playgroundForm.id,
                name: 'Playground',
                order: 0,
                color: '#3B82F6',
              },
            });
          }

          // Create playground lead
          const playgroundLead = await prisma.lead.create({
            data: {
              form_id: playgroundForm.id,
              kanban_column_id: defaultColumn.id,
              form_data: {
                playground_user_id: user_id,
                name: 'Playground User',
                source: 'playground',
              },
            },
          });

          finalLeadId = playgroundLead.id;
        }
      }

      if (!finalLeadId) {
        return reply.status(400).send({
          error: 'lead_id or user_id is required',
        });
      }

      // Create OpenAI thread if not provided
      let finalThreadId = thread_id;
      if (!finalThreadId) {
        const newThreadId = await openaiService.createThread(assistant.userId);
        if (!newThreadId) {
          return reply.status(500).send({
            error: 'Failed to create OpenAI thread',
          });
        }
        finalThreadId = newThreadId;
      }

      const conversation = await prisma.conversation.create({
        data: {
          lead_id: finalLeadId,
          assistant_id,
          thread_id: finalThreadId,
        },
        include: {
          assistant: true,
          lead: true,
          messages: true,
        },
      });

      // Create lead event
      await prisma.leadEvent.create({
        data: {
          lead_id: finalLeadId,
          type: 'CHAT_STARTED',
          data: { conversation_id: conversation.id },
        },
      });

      // Send initial message from assistant if configured
      if (assistant.initial_message && assistant.initial_message.trim()) {
        try {
          // Add the initial message to the OpenAI thread
          await openaiService.addMessageToThread(
            assistant.userId,
            finalThreadId,
            'assistant',
            assistant.initial_message
          );

          // Save the initial message to the database
          await prisma.message.create({
            data: {
              conversation_id: conversation.id,
              role: 'assistant',
              content: assistant.initial_message,
            },
          });

          request.log.info({
            conversationId: conversation.id,
            message: 'Initial message sent successfully',
          });
        } catch (error) {
          // Log error but don't fail the conversation creation
          request.log.error({
            error,
            conversationId: conversation.id,
            message: 'Failed to send initial message',
          });
        }
      }

      // Fetch conversation with updated messages
      const conversationWithMessages = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: {
          assistant: true,
          lead: true,
          messages: {
            orderBy: { created_at: 'asc' },
          },
        },
      });

      return reply.status(201).send(conversationWithMessages);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Failed to create conversation',
      });
    }
  }

  async getAll(
    request: FastifyRequest<{ Querystring: { lead_id?: string; assistant_id?: string } }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para ver conversas de toda a conta/empresa
      const effectiveOwnerId = await getEffectiveOwnerId(userId);
      const { lead_id, assistant_id } = request.query;

      // Filtrar conversas apenas de leads que pertencem ao owner
      const where: any = {
        lead: {
          form: {
            userId: effectiveOwnerId,
          },
        },
      };
      if (lead_id) where.lead_id = lead_id;
      if (assistant_id) where.assistant_id = assistant_id;

      const conversations = await prisma.conversation.findMany({
        where,
        include: {
          lead: true,
          assistant: true,
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return reply.send(conversations);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Failed to fetch conversations',
      });
    }
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          lead: {
            include: {
              form: true,
            },
          },
          assistant: true,
          messages: {
            orderBy: { created_at: 'asc' },
          },
        },
      });

      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found',
        });
      }

      // Se o usuário está autenticado, verifica ownership
      if (request.user) {
        const userId = request.user.id;
        const effectiveOwnerId = await getEffectiveOwnerId(userId);

        // SEGURANÇA: Verifica ownership através do lead/form
        if (conversation.lead.form.userId !== effectiveOwnerId) {
          return reply.status(403).send({
            success: false,
            error: 'Forbidden: You do not have access to this conversation',
          });
        }
      } else {
        // Acesso público: permite acesso se a conversação pertence a um formulário público ativo
        // A segurança aqui é que o ID da conversação não é facilmente adivinhável
        if (!conversation.lead.form.is_active) {
          return reply.status(403).send({
            success: false,
            error: 'Forbidden: This conversation is not accessible',
          });
        }
      }

      return reply.send({
        success: true,
        data: conversation,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch conversation',
      });
    }
  }

  async addMessage(
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

      // Get conversation with assistant info
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          assistant: {
            select: {
              userId: true,
              openai_assistant_id: true,
            },
          },
          lead: {
            include: {
              form: true,
            },
          },
        },
      });

      if (!conversation) {
        return reply.status(404).send({
          error: 'Conversation not found',
        });
      }

      // Se o usuário está autenticado, verifica ownership
      if (request.user) {
        const userId = request.user.id;
        const effectiveOwnerId = await getEffectiveOwnerId(userId);

        // SEGURANÇA: Verifica ownership através do lead/form
        if (conversation.lead.form.userId !== effectiveOwnerId) {
          return reply.status(403).send({
            error: 'Forbidden: You do not have access to this conversation',
          });
        }
      } else {
        // Acesso público: permite acesso se a conversação pertence a um formulário público ativo
        if (!conversation.lead.form.is_active) {
          return reply.status(403).send({
            error: 'Forbidden: This conversation is not accessible',
          });
        }
      }

      if (!conversation.thread_id) {
        return reply.status(400).send({
          error: 'Conversation has no thread_id',
        });
      }

      if (!conversation.assistant.openai_assistant_id) {
        return reply.status(400).send({
          error: 'Assistant has no OpenAI assistant ID',
        });
      }

      // Save user message to database
      const userMessage = await prisma.message.create({
        data: {
          conversation_id: id,
          role: 'user',
          content,
        },
      });

      // Add message to queue for async processing
      const job = await addMessageToQueue({
        conversationId: id,
        userId: conversation.assistant.userId,
        assistantId: conversation.assistant_id,
        threadId: conversation.thread_id,
        openaiAssistantId: conversation.assistant.openai_assistant_id,
        content,
        userMessageId: userMessage.id,
        leadId: conversation.lead_id,
      });

      return reply.status(202).send({
        userMessage,
        jobId: job.id,
        status: 'processing',
        message: 'Message queued for processing',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Failed to add message',
      });
    }
  }

  async getMessageStatus(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { jobId: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const { jobId } = request.query;

      if (!jobId) {
        console.error('[STATUS] ❌ Missing jobId in request');
        return reply.status(400).send({
          error: 'jobId is required',
        });
      }

      // Verificar se a conversação existe e é acessível (opcional, mas aumenta segurança)
      if (id) {
        const conversation = await prisma.conversation.findUnique({
          where: { id },
          include: {
            lead: {
              include: {
                form: true,
              },
            },
          },
        });

        if (conversation) {
          // Se o usuário está autenticado, verifica ownership
          if (request.user) {
            const userId = request.user.id;
            const effectiveOwnerId = await getEffectiveOwnerId(userId);

            if (conversation.lead.form.userId !== effectiveOwnerId) {
              return reply.status(403).send({
                error: 'Forbidden: You do not have access to this conversation',
              });
            }
          } else {
            // Acesso público: permite acesso se a conversação pertence a um formulário público ativo
            if (!conversation.lead.form.is_active) {
              return reply.status(403).send({
                error: 'Forbidden: This conversation is not accessible',
              });
            }
          }
        }
      }

      console.log(`[STATUS] 🔍 Checking status for job: ${jobId}`);
      const jobStatus = await getMessageJobStatus(jobId);

      if (!jobStatus) {
        console.error(`[STATUS] ❌ Job not found: ${jobId}`);
        return reply.status(404).send({
          error: 'Job not found',
        });
      }

      console.log(`[STATUS] ✅ Job ${jobId} - State: ${jobStatus.state}, Progress: ${jobStatus.progress}%`);

      return reply.send({
        jobId,
        state: jobStatus.state,
        progress: jobStatus.progress,
        result: jobStatus.result,
        failedReason: jobStatus.failedReason,
      });
    } catch (error) {
      console.error('[STATUS] ❌ Error getting job status:', error);
      request.log.error(error);
      return reply.status(500).send({
        error: 'Failed to get job status',
      });
    }
  }

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        is_active?: boolean;
        thread_id?: string;
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

      // Get conversation to verify ownership
      const existingConversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          lead: {
            include: {
              form: true,
            },
          },
        },
      });

      if (!existingConversation) {
        return reply.status(404).send({
          error: 'Conversation not found',
        });
      }

      // SEGURANÇA: Verifica ownership através do lead/form
      if (existingConversation.lead.form.userId !== effectiveOwnerId) {
        return reply.status(403).send({
          error: 'Forbidden: You do not have access to this conversation',
        });
      }

      const conversation = await prisma.conversation.update({
        where: { id },
        data,
      });

      return reply.send(conversation);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Failed to update conversation',
      });
    }
  }
}
