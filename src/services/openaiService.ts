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
}

export const openaiService = new OpenAIService();
