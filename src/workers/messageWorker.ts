import { Job } from 'bull';
import { messageQueue, MessageJobData, MessageJobResult } from '../queues/messageQueue';
import { openaiService } from '../services/openaiService';
import { threadLockService } from '../services/threadLockService';
import prisma from '../utils/prisma';

// Process message job
messageQueue.process(async (job: Job<MessageJobData>): Promise<MessageJobResult> => {
  const {
    conversationId,
    userId,
    threadId,
    openaiAssistantId,
    content,
    userMessageId,
    leadId,
  } = job.data;

  try {
    console.log(`Processing message for conversation ${conversationId}`);

    // Check if thread is currently locked by another job
    const isLocked = await threadLockService.isLocked(threadId);
    if (isLocked) {
      const activeRunId = await threadLockService.getActiveRun(threadId);
      console.log(`⏸️ Thread ${threadId} is locked (active run: ${activeRunId}), job will retry...`);

      // Throw error to trigger retry with backoff
      // This allows the worker to process other jobs instead of blocking
      throw new Error(`Thread ${threadId} is currently processing another message`);
    }

    // Update job progress
    await job.progress(10);

    // Send message to OpenAI and get response
    const assistantResponse = await openaiService.sendMessageAndGetResponse(
      userId,
      threadId,
      openaiAssistantId,
      content
    );

    await job.progress(70);

    if (!assistantResponse) {
      throw new Error('Failed to get response from OpenAI assistant');
    }

    // Save assistant message to database
    const assistantMessage = await prisma.message.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse,
      },
    });

    await job.progress(90);

    // Create lead event
    await prisma.leadEvent.create({
      data: {
        lead_id: leadId,
        type: 'MESSAGE_RECEIVED',
        data: {
          conversation_id: conversationId,
          message_id: userMessageId,
          assistant_message_id: assistantMessage.id,
          content: content.substring(0, 100),
        },
      },
    });

    await job.progress(100);

    console.log(`✅ Message processed successfully for conversation ${conversationId}`);

    return {
      success: true,
      assistantMessageId: assistantMessage.id,
      assistantMessageContent: assistantMessage.content,
    };
  } catch (error) {
    console.error(`❌ Error processing message for conversation ${conversationId}:`, error);
    console.log(`🔄 Attempt ${job.attemptsMade} of ${job.opts.attempts}`);

    // Check if error is related to active run on thread
    if (error instanceof Error && error.message.includes('while a run')) {
      console.log(`⚠️ Thread busy error detected - will retry with backoff`);
    }

    // Check if error is related to lock acquisition failure
    if (error instanceof Error && error.message.includes('Failed to acquire lock')) {
      console.log(`⚠️ Lock acquisition failed - will retry with backoff`);
    }

    // Save error to database as a system message (optional)
    // await prisma.message.create({
    //   data: {
    //     conversation_id: conversationId,
    //     role: 'system',
    //     content: `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
    //   },
    // }).catch((err) => {
    //   console.error('Failed to save error message to database:', err);
    // });

    // Re-throw the error to trigger Bull retry mechanism
    throw error;
  }
});

console.log('🚀 Message worker started and listening for jobs...');

export default messageQueue;
