import { FastifyRequest, FastifyReply } from 'fastify';
import OpenAI from 'openai';
import prisma from '../utils/prisma';
import { decryptToken } from '../utils/crypto';
import { openaiService } from '../services/openaiService';

export class AssistantController {
  async create(
    request: FastifyRequest<{
      Body: {
        userId: string;
        name: string;
        system_prompt: string;
        initial_message: string;
        temperature?: number;
        model?: string;
        max_completion_tokens?: number;
        max_prompt_tokens?: number;
        enable_scheduling?: boolean;
        enable_email?: boolean;
        enable_link_sharing?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const {
        userId,
        name,
        system_prompt,
        initial_message,
        temperature = 0.7,
        model = 'gpt-4-turbo-preview',
        max_completion_tokens = 500,
        max_prompt_tokens,
        enable_scheduling,
        enable_email,
        enable_link_sharing,
      } = request.body;

      // Validate required fields
      if (!name || !system_prompt || !initial_message) {
        return reply.status(400).send({
          success: false,
          error: 'Name, system prompt, and initial message are required',
        });
      }

      // Fetch user's encrypted API key
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { openai_api_key: true },
      });

      if (!user || !user.openai_api_key) {
        return reply.status(400).send({
          success: false,
          error: 'OpenAI API key not configured',
        });
      }

      // Decrypt API key
      let apiKey: string;
      try {
        apiKey = decryptToken(user.openai_api_key);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: 'Failed to decrypt API key',
        });
      }

      // Create OpenAI assistant
      const openai = new OpenAI({ apiKey });
      let openaiAssistantId: string | undefined;

      try {
        const openaiAssistant = await openai.beta.assistants.create({
          name,
          instructions: system_prompt,
          model,
          temperature,
        });
        openaiAssistantId = openaiAssistant.id;
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: 'Failed to create assistant in OpenAI',
        });
      }

      // Create database record
      const assistant = await prisma.assistant.create({
        data: {
          userId,
          name,
          system_prompt,
          initial_message,
          temperature,
          model,
          max_completion_tokens,
          max_prompt_tokens,
          openai_assistant_id: openaiAssistantId,
          enable_scheduling,
          enable_email,
          enable_link_sharing,
        },
      });

      return reply.status(201).send({
        success: true,
        data: assistant,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create assistant',
      });
    }
  }

  async getAll(
    request: FastifyRequest<{ Querystring: { userId?: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.query;

      const assistants = await prisma.assistant.findMany({
        where: userId ? { userId } : undefined,
        include: {
          _count: {
            select: {
              forms: true,
              conversations: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return reply.send({
        success: true,
        data: assistants,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch assistants',
      });
    }
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const assistant = await prisma.assistant.findUnique({
        where: { id },
        include: {
          forms: true,
          conversations: {
            take: 10,
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!assistant) {
        return reply.status(404).send({
          success: false,
          error: 'Assistant not found',
        });
      }

      return reply.send({
        success: true,
        data: assistant,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch assistant',
      });
    }
  }

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        name?: string;
        system_prompt?: string;
        initial_message?: string;
        temperature?: number;
        model?: string;
        max_completion_tokens?: number;
        max_prompt_tokens?: number;
        enable_scheduling?: boolean;
        enable_email?: boolean;
        enable_link_sharing?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const updateData = request.body;

      // Get the existing assistant to access OpenAI ID and user info
      const existingAssistant = await prisma.assistant.findUnique({
        where: { id },
        include: { user: { select: { openai_api_key: true } } },
      });

      if (!existingAssistant) {
        return reply.status(404).send({
          success: false,
          error: 'Assistant not found',
        });
      }

      // If updating name, system_prompt, model or temperature, sync with OpenAI
      if ((updateData.name || updateData.system_prompt || updateData.model || updateData.temperature !== undefined) && existingAssistant.openai_assistant_id) {
        if (!existingAssistant.user?.openai_api_key) {
          return reply.status(400).send({
            success: false,
            error: 'OpenAI API key not configured',
          });
        }

        // Decrypt API key
        let apiKey: string;
        try {
          apiKey = decryptToken(existingAssistant.user.openai_api_key);
        } catch (err) {
          request.log.error(err);
          return reply.status(500).send({
            success: false,
            error: 'Failed to decrypt API key',
          });
        }

        // Update OpenAI assistant
        const openai = new OpenAI({ apiKey });
        try {
          await openai.beta.assistants.update(existingAssistant.openai_assistant_id, {
            name: updateData.name || existingAssistant.name,
            instructions: updateData.system_prompt || existingAssistant.system_prompt,
            model: updateData.model || existingAssistant.model,
            temperature: updateData.temperature !== undefined ? updateData.temperature : existingAssistant.temperature,
          });
        } catch (err) {
          request.log.error(err);
          return reply.status(500).send({
            success: false,
            error: 'Failed to update assistant in OpenAI',
          });
        }
      }

      // Update database record
      const assistant = await prisma.assistant.update({
        where: { id },
        data: updateData,
      });

      return reply.send({
        success: true,
        data: assistant,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update assistant',
      });
    }
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Get the existing assistant to access OpenAI ID and user info
      const existingAssistant = await prisma.assistant.findUnique({
        where: { id },
        include: { user: { select: { openai_api_key: true } } },
      });

      if (!existingAssistant) {
        return reply.status(404).send({
          success: false,
          error: 'Assistant not found',
        });
      }

      // Delete from OpenAI if it has an ID
      if (existingAssistant.openai_assistant_id && existingAssistant.user?.openai_api_key) {
        let apiKey: string | undefined;
        try {
          apiKey = decryptToken(existingAssistant.user.openai_api_key);
        } catch (err) {
          request.log.error(err);
          // Continue with deletion even if decryption fails
        }

        if (apiKey) {
          const openai = new OpenAI({ apiKey });
          try {
            await openai.beta.assistants.delete(existingAssistant.openai_assistant_id);
          } catch (err) {
            request.log.error(err);
            // Log error but continue with database deletion
          }
        }
      }

      // Delete database record
      await prisma.assistant.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Assistant deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete assistant',
      });
    }
  }

  async getModels(
    request: FastifyRequest<{ Querystring: { userId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.query;

      if (!userId) {
        return reply.status(400).send({
          success: false,
          error: 'userId is required',
        });
      }

      const models = await openaiService.getAvailableModels(userId);

      if (!models) {
        return reply.status(400).send({
          success: false,
          error: 'Failed to fetch models. Please check your OpenAI API key configuration.',
        });
      }

      return reply.send({
        success: true,
        data: models,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch available models',
      });
    }
  }
}
