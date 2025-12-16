import OpenAI from 'openai';
import prisma from '../utils/prisma';
import { decryptToken } from '../utils/crypto';
import { threadLockService } from './threadLockService';
import { v4 as uuidv4 } from 'uuid';

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

  /**
   * Checks if there are any active runs on the thread
   */
  async hasActiveRun(userId: string, threadId: string): Promise<{ hasActive: boolean; activeRunId?: string }> {
    try {
      const openai = await this.getOpenAIClient(userId);
      if (!openai) {
        return { hasActive: false };
      }

      // List all runs for this thread
      const runs = await openai.beta.threads.runs.list(threadId, {
        limit: 10,
        order: 'desc',
      });

      // Check if any run is in an active state
      const activeRun = runs.data.find((run) =>
        run.status === 'queued' ||
        run.status === 'in_progress' ||
        run.status === 'requires_action'
      );

      if (activeRun) {
        return { hasActive: true, activeRunId: activeRun.id };
      }

      return { hasActive: false };
    } catch (error) {
      console.error('Error checking active runs:', error);
      return { hasActive: false };
    }
  }

  /**
   * Waits for any active runs on the thread to complete
   */
  async waitForActiveRunsToComplete(
    userId: string,
    threadId: string,
    maxWaitTime: number = 300000 // 5 minutes
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const { hasActive, activeRunId } = await this.hasActiveRun(userId, threadId);

      if (!hasActive) {
        return true;
      }

      console.log(`⏳ Waiting for active run ${activeRunId} to complete on thread ${threadId}...`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before checking again
    }

    console.error(`❌ Timeout waiting for active runs to complete on thread ${threadId}`);
    return false;
  }

  async sendMessageAndGetResponse(
    userId: string,
    threadId: string,
    assistantId: string,
    userMessage: string
  ): Promise<string | null> {
    const lockId = uuidv4();

    try {
      const openai = await this.getOpenAIClient(userId);
      if (!openai) {
        throw new Error('OpenAI client not available');
      }

      // Wait for and acquire lock for this thread
      console.log(`🔐 Attempting to acquire lock for thread ${threadId}...`);
      const lockAcquired = await threadLockService.waitForLock(threadId, lockId);

      if (!lockAcquired) {
        throw new Error(`Failed to acquire lock for thread ${threadId}`);
      }

      try {
        // Double-check there are no active runs before proceeding
        const { hasActive, activeRunId } = await this.hasActiveRun(userId, threadId);

        if (hasActive) {
          console.log(`⚠️ Found active run ${activeRunId}, waiting for completion...`);
          const completed = await this.waitForActiveRunsToComplete(userId, threadId);

          if (!completed) {
            throw new Error(`Active run ${activeRunId} did not complete in time`);
          }
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

        console.log(`🚀 Started run ${run.id} on thread ${threadId}`);

        // Store the active run ID in Redis
        await threadLockService.setActiveRun(threadId, run.id);

        // Wait for completion
        let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: threadId });

        // Poll until run completes
        let pollCount = 0;
        while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: threadId });

          // Extend lock every 10 polls (10 seconds) to prevent expiration
          if (++pollCount % 10 === 0) {
            await threadLockService.extendLock(threadId, lockId);
          }
        }

        if (runStatus.status !== 'completed') {
          console.error('Run failed with status:', runStatus.status);
          return null;
        }

        console.log(`✅ Run ${run.id} completed successfully`);

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
      } finally {
        // Always release the lock
        await threadLockService.releaseLock(threadId, lockId);
      }
    } catch (error) {
      console.error('Error sending message and getting response:', error);
      // Ensure lock is released even on error
      await threadLockService.releaseLock(threadId, lockId);
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
