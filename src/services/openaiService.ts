import OpenAI from 'openai';
import prisma from '../utils/prisma';
import { decryptToken } from '../utils/crypto';
import { threadLockService } from './threadLockService';
import { v4 as uuidv4 } from 'uuid';

export class OpenAIService {
  async getOpenAIClient(userId: string): Promise<OpenAI | null> {
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
    userMessage: string,
    maxCompletionTokens?: number,
    maxPromptTokens?: number
  ): Promise<string | null> {
    const lockId = uuidv4();

    try {
      const openai = await this.getOpenAIClient(userId);
      if (!openai) {
        throw new Error('OpenAI client not available');
      }

      // Wait for and acquire lock for this thread (with reduced retry count for faster failure)
      console.log(`🔐 Attempting to acquire lock for thread ${threadId}...`);
      const lockAcquired = await threadLockService.waitForLock(threadId, lockId, 10);

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
        const runParams: any = {
          assistant_id: assistantId,
        };

        // Add token limits if specified
        if (maxCompletionTokens !== undefined && maxCompletionTokens > 0) {
          runParams.max_completion_tokens = maxCompletionTokens;
        }

        // OpenAI requires max_prompt_tokens to be at least 256
        if (maxPromptTokens !== undefined && maxPromptTokens >= 256) {
          runParams.max_prompt_tokens = maxPromptTokens;
        }

        const run = await openai.beta.threads.runs.create(threadId, runParams);

        console.log(`🚀 Started run ${run.id} on thread ${threadId}`);

        // Store the active run ID in Redis
        await threadLockService.setActiveRun(threadId, run.id);

        // Wait for completion with timeout protection
        let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: threadId });

        // Poll until run completes (with max timeout)
        let pollCount = 0;
        const maxPollTime = 90000; // 90 seconds max for OpenAI processing
        const startTime = Date.now();

        while (runStatus.status === 'queued' || runStatus.status === 'in_progress' || runStatus.status === 'requires_action') {
          // Check if we've exceeded max polling time
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime > maxPollTime) {
            console.error(`❌ OpenAI processing timeout after ${elapsedTime}ms. Cancelling run...`);
            try {
              await openai.beta.threads.runs.cancel(run.id, {
                thread_id: threadId
              });
            } catch (cancelError) {
              console.error('Failed to cancel timed out run:', cancelError);
            }
            throw new Error('OpenAI processing timeout - the assistant took too long to respond');
          }

          // Handle requires_action state (when assistant tries to call functions)
          if (runStatus.status === 'requires_action') {
            console.error(`⚠️ Assistant tried to call a function but function calling is disabled`);
            console.error(`This assistant has functions configured in OpenAI that need to be removed`);

            // Cancel the run since we don't support functions anymore
            try {
              await openai.beta.threads.runs.cancel(run.id, {
                thread_id: threadId
              });
            } catch (cancelError) {
              console.error('Failed to cancel run:', cancelError);
            }

            throw new Error('This assistant has function calling enabled in OpenAI. Please remove all functions from this assistant in the OpenAI dashboard, or recreate the assistant without functions.');
          }

          // Log progress every 10 seconds
          if (pollCount % 10 === 0) {
            console.log(`⏳ Waiting for OpenAI... Status: ${runStatus.status}, Elapsed: ${Math.floor(elapsedTime / 1000)}s / 90s`);
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: threadId });

          // Extend lock every 10 polls (10 seconds) to prevent expiration
          if (++pollCount % 10 === 0) {
            await threadLockService.extendLock(threadId, lockId);
          }
        }

        if (runStatus.status !== 'completed') {
          console.error(`❌ Run failed with status: ${runStatus.status}`);

          // Handle incomplete status
          if (runStatus.status === 'incomplete') {
            const incompleteDetails = (runStatus as any).incomplete_details;
            console.error('Incomplete details:', incompleteDetails);

            if (incompleteDetails?.reason === 'max_completion_tokens') {
              throw new Error('OpenAI response was cut off - max completion tokens reached. Please increase max_completion_tokens in assistant settings.');
            } else if (incompleteDetails?.reason === 'max_prompt_tokens') {
              throw new Error('OpenAI prompt was too large - max prompt tokens exceeded. Please reduce the conversation length or increase max_prompt_tokens.');
            } else {
              throw new Error('OpenAI run was incomplete - the API failed to complete the request. Please try again.');
            }
          }

          if (runStatus.last_error) {
            console.error('Last error:', runStatus.last_error);

            // Provide user-friendly error messages
            if (runStatus.last_error.code === 'rate_limit_exceeded') {
              throw new Error('OpenAI API quota exceeded. Please check your billing details at https://platform.openai.com/account/billing');
            }

            throw new Error(`OpenAI run failed: ${runStatus.last_error.message}`);
          }

          throw new Error(`OpenAI run failed with status: ${runStatus.status}`);
        }

        // Log token usage
        if (runStatus.usage) {
          console.log(`✅ Run ${run.id} completed successfully`);
          console.log(`📊 Token usage - Prompt: ${runStatus.usage.prompt_tokens}, Completion: ${runStatus.usage.completion_tokens}, Total: ${runStatus.usage.total_tokens}`);
        } else {
          console.log(`✅ Run ${run.id} completed successfully`);
        }

        // Get the assistant's messages
        console.log(`📨 Fetching messages from thread ${threadId}...`);
        const messages = await openai.beta.threads.messages.list(threadId, {
          order: 'desc',
          limit: 1,
        });

        console.log(`📬 Retrieved ${messages.data.length} message(s)`);
        const lastMessage = messages.data[0];
        if (!lastMessage) {
          console.error('❌ No messages found in thread');
          return null;
        }

        if (lastMessage.role !== 'assistant') {
          console.error(`❌ Last message role is ${lastMessage.role}, expected 'assistant'`);
          return null;
        }

        console.log(`📝 Last message has ${lastMessage.content.length} content item(s)`);

        // Extract text content from the message
        const textContent = lastMessage.content.find((content) => content.type === 'text');
        if (textContent && textContent.type === 'text') {
          console.log(`✅ Successfully extracted assistant response`);
          return textContent.text.value;
        }

        console.error('❌ No text content found in message');
        return null;
      } finally {
        // Always release the lock
        await threadLockService.releaseLock(threadId, lockId);
      }
    } catch (error) {
      console.error('❌ Error sending message and getting response:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Ensure lock is released even on error
      try {
        await threadLockService.releaseLock(threadId, lockId);
      } catch (lockError) {
        console.error('Failed to release lock:', lockError);
      }
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
