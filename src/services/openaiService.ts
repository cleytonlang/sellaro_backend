import OpenAI from 'openai';
import prisma from '../utils/prisma';
import { decryptToken } from '../utils/crypto';

export class OpenAIService {
  private async getOpenAIClient(userId: string): Promise<OpenAI | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { openai_api_key: true },
      });

      if (!user || !user.openai_api_key) {
        return null;
      }

      const apiKey = decryptToken(user.openai_api_key);
      return new OpenAI({ apiKey });
    } catch (error) {
      console.error('Error getting OpenAI client:', error);
      return null;
    }
  }

  async createThread(userId: string): Promise<string | null> {
    try {
      const openai = await this.getOpenAIClient(userId);
      if (!openai) {
        throw new Error('OpenAI client not available');
      }

      const thread = await openai.beta.threads.create();
      return thread.id;
    } catch (error) {
      console.error('Error creating thread:', error);
      return null;
    }
  }

  async sendMessageAndGetResponse(
    userId: string,
    threadId: string,
    assistantId: string,
    userMessage: string
  ): Promise<string | null> {
    try {
      const openai = await this.getOpenAIClient(userId);
      if (!openai) {
        throw new Error('OpenAI client not available');
      }

      // Add user message to thread
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage,
      });

      // Run the assistant
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
      });

      // Wait for completion
      let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: threadId });

      // Poll until run completes
      while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: threadId });
      }

      if (runStatus.status !== 'completed') {
        console.error('Run failed with status:', runStatus.status);
        return null;
      }

      // Get the assistant's messages
      const messages = await openai.beta.threads.messages.list(threadId, {
        order: 'desc',
        limit: 1,
      });

      const lastMessage = messages.data[0];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        return null;
      }

      // Extract text content from the message
      const textContent = lastMessage.content.find((content) => content.type === 'text');
      if (textContent && textContent.type === 'text') {
        return textContent.text.value;
      }

      return null;
    } catch (error) {
      console.error('Error sending message and getting response:', error);
      return null;
    }
  }

  async addMessageToThread(
    userId: string,
    threadId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<boolean> {
    try {
      const openai = await this.getOpenAIClient(userId);
      if (!openai) {
        throw new Error('OpenAI client not available');
      }

      await openai.beta.threads.messages.create(threadId, {
        role,
        content,
      });

      return true;
    } catch (error) {
      console.error('Error adding message to thread:', error);
      return false;
    }
  }

  async getAvailableModels(userId: string): Promise<any[] | null> {
    try {
      const openai = await this.getOpenAIClient(userId);
      if (!openai) {
        throw new Error('OpenAI client not available');
      }

      const modelsResponse = await openai.models.list();

      // Filter only GPT models suitable for assistants
      const gptModels = modelsResponse.data.filter((model) =>
        model.id.includes('gpt') &&
        !model.id.includes('instruct') &&
        !model.id.includes('vision')
      ).map((model) => ({
        id: model.id,
        name: model.id,
        created: model.created,
        owned_by: model.owned_by
      }));

      // Sort by creation date (newest first)
      gptModels.sort((a, b) => b.created - a.created);

      return gptModels;
    } catch (error) {
      console.error('Error fetching models:', error);
      return null;
    }
  }

  async getThreadMessages(userId: string, threadId: string): Promise<any[] | null> {
    try {
      const openai = await this.getOpenAIClient(userId);
      if (!openai) {
        throw new Error('OpenAI client not available');
      }

      // Get all messages from the thread
      const messages = await openai.beta.threads.messages.list(threadId, {
        order: 'asc', // oldest first
        limit: 100,
      });

      // Format messages for easier consumption
      const formattedMessages = messages.data.map((message) => {
        // Extract text content
        const textContent = message.content
          .filter((content) => content.type === 'text')
          .map((content) => {
            if (content.type === 'text') {
              return content.text.value;
            }
            return '';
          })
          .join('\n');

        return {
          id: message.id,
          role: message.role,
          content: textContent,
          created_at: message.created_at,
          metadata: message.metadata,
        };
      });

      return formattedMessages;
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      return null;
    }
  }
}

export const openaiService = new OpenAIService();
