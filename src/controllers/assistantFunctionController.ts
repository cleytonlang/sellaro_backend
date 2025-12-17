import { FastifyRequest, FastifyReply } from 'fastify';
import OpenAI from 'openai';
import prisma from '../utils/prisma';
import { decryptToken } from '../utils/crypto';

export class AssistantFunctionController {
  /**
   * Get all functions for an assistant
   */
  async getByAssistantId(
    request: FastifyRequest<{ Params: { assistant_id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { assistant_id } = request.params;

      const functions = await prisma.assistantFunction.findMany({
        where: { assistant_id },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({
        success: true,
        data: functions,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch functions',
      });
    }
  }

  /**
   * Create a new function for an assistant
   */
  async create(
    request: FastifyRequest<{
      Params: { assistant_id: string };
      Body: {
        type: string;
        instructions: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { assistant_id } = request.params;
      const { type, instructions } = request.body;

      // Validate required fields
      if (!type || !instructions || !instructions.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'type and instructions are required',
        });
      }

      // Validate type
      const validTypes = ['move_lead_column', 'add_lead_comment'];
      if (!validTypes.includes(type)) {
        return reply.status(400).send({
          success: false,
          error: `type must be one of: ${validTypes.join(', ')}`,
        });
      }

      // Get assistant to access user info
      const assistant = await prisma.assistant.findUnique({
        where: { id: assistant_id },
        include: { user: { select: { openai_api_key: true } } },
      });

      if (!assistant) {
        return reply.status(404).send({
          success: false,
          error: 'Assistant not found',
        });
      }

      if (!assistant.openai_assistant_id) {
        return reply.status(400).send({
          success: false,
          error: 'Assistant does not have an OpenAI assistant ID',
        });
      }

      // Decrypt API key
      let apiKey: string;
      try {
        if (!assistant.user?.openai_api_key) {
          return reply.status(400).send({
            success: false,
            error: 'OpenAI API key not configured',
          });
        }
        apiKey = decryptToken(assistant.user.openai_api_key);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: 'Failed to decrypt API key',
        });
      }

      // Get all existing functions for this assistant
      const existingFunctions = await prisma.assistantFunction.findMany({
        where: { assistant_id },
      });

      // Check if function type already exists
      const functionExists = existingFunctions.find((f) => f.type === type);
      if (functionExists) {
        return reply.status(400).send({
          success: false,
          error: `Function type ${type} already exists for this assistant`,
        });
      }

      // Save function to database first
      const assistantFunction = await prisma.assistantFunction.create({
        data: {
          assistant_id,
          type,
          instructions: instructions.trim(),
        },
      });

      // Update OpenAI assistant with all functions
      const openai = new OpenAI({ apiKey });
      try {
        const allFunctions = [...existingFunctions, assistantFunction];
        const tools = allFunctions.map((f) => this.getFunctionDefinition(f.type));

        await openai.beta.assistants.update(assistant.openai_assistant_id, {
          tools: tools,
        });
      } catch (err) {
        request.log.error(err);
        // Rollback: delete the function from database
        await prisma.assistantFunction.delete({ where: { id: assistantFunction.id } });
        return reply.status(500).send({
          success: false,
          error: 'Failed to update assistant in OpenAI',
        });
      }

      return reply.status(201).send({
        success: true,
        data: assistantFunction,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create function',
      });
    }
  }

  /**
   * Update a function
   */
  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        instructions?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const { instructions } = request.body;

      // Get function with assistant info
      const assistantFunction = await prisma.assistantFunction.findUnique({
        where: { id },
        include: {
          assistant: {
            include: { user: { select: { openai_api_key: true } } },
          },
        },
      });

      if (!assistantFunction) {
        return reply.status(404).send({
          success: false,
          error: 'Function not found',
        });
      }

      const updateData: any = {};
      if (instructions !== undefined) {
        updateData.instructions = instructions.trim();
      }

      // Update in database
      const updatedFunction = await prisma.assistantFunction.update({
        where: { id },
        data: updateData,
      });

      return reply.send({
        success: true,
        data: updatedFunction,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update function',
      });
    }
  }

  /**
   * Delete a function
   */
  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Get function with assistant info
      const assistantFunction = await prisma.assistantFunction.findUnique({
        where: { id },
        include: {
          assistant: {
            include: { user: { select: { openai_api_key: true } } },
          },
        },
      });

      if (!assistantFunction) {
        return reply.status(404).send({
          success: false,
          error: 'Function not found',
        });
      }

      // Update OpenAI assistant to remove this function
      if (
        assistantFunction.assistant.openai_assistant_id &&
        assistantFunction.assistant.user?.openai_api_key
      ) {
        let apiKey: string | undefined;
        try {
          apiKey = decryptToken(assistantFunction.assistant.user.openai_api_key);
        } catch (err) {
          request.log.error(err);
          // Continue with deletion even if decryption fails
        }

        if (apiKey) {
          const openai = new OpenAI({ apiKey });
          try {
            // Get remaining functions
            const remainingFunctions = await prisma.assistantFunction.findMany({
              where: {
                assistant_id: assistantFunction.assistant_id,
                id: { not: id },
              },
            });

            const tools = remainingFunctions.map((f) => this.getFunctionDefinition(f.type));

            await openai.beta.assistants.update(assistantFunction.assistant.openai_assistant_id, {
              tools: tools,
            });
          } catch (err) {
            request.log.error(err);
            // Log error but continue with database deletion
          }
        }
      }

      // Delete from database
      await prisma.assistantFunction.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Function deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete function',
      });
    }
  }

  /**
   * Get function definition for OpenAI based on type
   */
  private getFunctionDefinition(type: string) {
    switch (type) {
      case 'move_lead_column':
        return {
          type: 'function' as const,
          function: {
            name: 'move_lead_column',
            description: 'Move um lead para uma coluna diferente no CRM Kanban. Use esta função quando o usuário quiser mover um lead para outra etapa do funil de vendas.',
            parameters: {
              type: 'object',
              properties: {
                lead_id: {
                  type: 'string',
                  description: 'ID do lead que deve ser movido',
                },
                column_id: {
                  type: 'string',
                  description: 'ID da coluna de destino no Kanban',
                },
                reason: {
                  type: 'string',
                  description: 'Razão pela qual o lead está sendo movido (opcional)',
                },
              },
              required: ['lead_id', 'column_id'],
            },
          },
        };
      case 'add_lead_comment':
        return {
          type: 'function' as const,
          function: {
            name: 'add_lead_comment',
            description: 'Adiciona um comentário a um lead no CRM. Use esta função quando precisar registrar uma observação, nota ou informação importante sobre o lead.',
            parameters: {
              type: 'object',
              properties: {
                lead_id: {
                  type: 'string',
                  description: 'ID do lead onde o comentário será adicionado',
                },
                comment: {
                  type: 'string',
                  description: 'Conteúdo do comentário a ser adicionado',
                },
              },
              required: ['lead_id', 'comment'],
            },
          },
        };
      default:
        throw new Error(`Unknown function type: ${type}`);
    }
  }
}

