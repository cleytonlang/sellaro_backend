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
    assistantId,
    openaiAssistantId,
    content,
    userMessageId,
    leadId,
  } = job.data;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 [JOB ${job.id}] STARTED - Attempt ${job.attemptsMade + 1}/${job.opts.attempts}`);
  console.log(`📝 Conversation: ${conversationId}`);
  console.log(`🧵 Thread: ${threadId}`);
  console.log(`💬 Content: ${content.substring(0, 50)}...`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    console.log(`[JOB ${job.id}] Processing message for conversation ${conversationId}`);

    // Check if thread is currently locked by another job
    console.log(`[JOB ${job.id}] Checking if thread is locked...`);
    const isLocked = await threadLockService.isLocked(threadId);
    if (isLocked) {
      const activeRunId = await threadLockService.getActiveRun(threadId);
      console.log(`[JOB ${job.id}] ⏸️ Thread ${threadId} is locked (active run: ${activeRunId})`);
      console.log(`[JOB ${job.id}] 🔄 Cancelling previous run and starting new one...`);

      // Cancel the active run in OpenAI
      if (activeRunId) {
        try {
          console.log(`[JOB ${job.id}] Getting OpenAI client...`);
          const openai = await openaiService.getOpenAIClient(userId);
          if (openai) {
            console.log(`[JOB ${job.id}] Cancelling run ${activeRunId}...`);
            await openai.beta.threads.runs.cancel(activeRunId, {
              thread_id: threadId
            });
            console.log(`[JOB ${job.id}] ❌ Cancelled run ${activeRunId}`);
          }
        } catch (err) {
          console.log(`[JOB ${job.id}] ⚠️ Failed to cancel run: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Continue even if cancel fails - we'll clear the lock anyway
        }
      }

      // Force clear the lock to allow new message
      console.log(`[JOB ${job.id}] Force clearing lock...`);
      await threadLockService.forceClearLock(threadId);
      console.log(`[JOB ${job.id}] 🧹 Cleared lock for thread ${threadId}`);

      // Wait a bit for Redis to propagate the deletion
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      console.log(`[JOB ${job.id}] ✅ Thread is not locked, proceeding...`);
    }

    // Update job progress
    console.log(`[JOB ${job.id}] Setting progress to 10%`);
    await job.progress(10);

    // Get assistant configuration for token limits
    console.log(`[JOB ${job.id}] Fetching assistant configuration...`);
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId },
      select: {
        max_completion_tokens: true,
        max_prompt_tokens: true,
      },
    });
    console.log(`[JOB ${job.id}] Assistant config: max_completion=${assistant?.max_completion_tokens}, max_prompt=${assistant?.max_prompt_tokens}`);

    // Send message to OpenAI and get response
    console.log(`[JOB ${job.id}] Sending message to OpenAI...`);
    const assistantResponse = await openaiService.sendMessageAndGetResponse(
      userId,
      threadId,
      openaiAssistantId,
      content,
      assistant?.max_completion_tokens ?? undefined,
      assistant?.max_prompt_tokens ?? undefined
    );
    console.log(`[JOB ${job.id}] Received response from OpenAI (${assistantResponse ? assistantResponse.length : 0} chars)`);

    console.log(`[JOB ${job.id}] Setting progress to 70%`);
    await job.progress(70);

    if (!assistantResponse) {
      console.error(`[JOB ${job.id}] ❌ No response from OpenAI assistant`);
      throw new Error('Failed to get response from OpenAI assistant');
    }

    // Save assistant message to database
    console.log(`[JOB ${job.id}] Saving assistant message to database...`);
    const assistantMessage = await prisma.message.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse,
      },
    });
    console.log(`[JOB ${job.id}] Assistant message saved with ID: ${assistantMessage.id}`);

    // Check for triggers configured for this assistant
    console.log(`[JOB ${job.id}] Checking for triggers...`);
    const triggers = await prisma.trigger.findMany({
      where: {
        assistant_id: assistantId,
        is_active: true,
      },
      orderBy: { order: 'asc' },
    });
    console.log('gatilhos:', triggers);

    console.log(`[JOB ${job.id}] Setting progress to 90%`);
    await job.progress(90);

    // Create lead event
    console.log(`[JOB ${job.id}] Creating lead event...`);
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
    console.log(`[JOB ${job.id}] Lead event created`);

    console.log(`[JOB ${job.id}] Setting progress to 100%`);
    await job.progress(100);

    console.log(`[JOB ${job.id}] ✅ Message processed successfully for conversation ${conversationId}\n`);

    return {
      success: true,
      assistantMessageId: assistantMessage.id,
      assistantMessageContent: assistantMessage.content,
    };
  } catch (error) {
    console.error(`\n${'='.repeat(80)}`);
    console.error(`❌ [JOB ${job.id}] ERROR processing message for conversation ${conversationId}`);
    console.error(`🔄 Attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`);
    console.error(`📋 Error details:`, error);
    if (error instanceof Error) {
      console.error(`📝 Error message: ${error.message}`);
      console.error(`📚 Error stack:`, error.stack);
    }
    console.error(`${'='.repeat(80)}\n`);

    // Check if error is related to active run on thread
    if (error instanceof Error && error.message.includes('while a run')) {
      console.log(`[JOB ${job.id}] ⚠️ Thread busy error detected - will retry with backoff`);
    }

    // Check if error is related to lock acquisition failure
    if (error instanceof Error && error.message.includes('Failed to acquire lock')) {
      console.log(`[JOB ${job.id}] ⚠️ Lock acquisition failed - will retry with backoff`);
    }

    // Check if error is related to OpenAI quota
    if (error instanceof Error && error.message.includes('quota exceeded')) {
      console.log(`[JOB ${job.id}] ⚠️ OpenAI quota exceeded - saving error message to user`);

      // Save quota error as assistant message so user sees it
      try {
        await prisma.message.create({
          data: {
            conversation_id: conversationId,
            role: 'assistant',
            content: '⚠️ Desculpe, a cota da API OpenAI foi excedida. Por favor, verifique seus detalhes de cobrança em https://platform.openai.com/account/billing',
          },
        });
      } catch (err) {
        console.error(`[JOB ${job.id}] Failed to save quota error message to database:`, err);
      }

      // Don't retry quota errors
      return {
        success: false,
        assistantMessageId: undefined,
        assistantMessageContent: undefined,
      };
    }

    // Check if error is related to OpenAI timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      console.log(`[JOB ${job.id}] ⏱️ OpenAI timeout - saving error message to user`);

      // Save timeout error as assistant message so user sees it
      try {
        await prisma.message.create({
          data: {
            conversation_id: conversationId,
            role: 'assistant',
            content: '⏱️ A API da OpenAI está demorando muito para responder. Isso pode acontecer quando:\n\n• A OpenAI está com muita demanda\n• Sua pergunta é muito complexa\n• Há problemas temporários com a API\n\nPor favor, tente novamente em alguns instantes.',
          },
        });
      } catch (err) {
        console.error(`[JOB ${job.id}] Failed to save timeout error message to database:`, err);
      }

      // Don't retry timeout errors (they'll just timeout again)
      return {
        success: false,
        assistantMessageId: undefined,
        assistantMessageContent: undefined,
      };
    }

    // Check if error is related to token limits
    if (error instanceof Error && (error.message.includes('max_completion_tokens') || error.message.includes('max_prompt_tokens'))) {
      console.log(`[JOB ${job.id}] 📊 Token limit error - saving error message to user`);

      // Determine which limit was hit
      const isCompletionLimit = error.message.includes('max_completion_tokens');

      // Save token limit error as assistant message so user sees it
      try {
        await prisma.message.create({
          data: {
            conversation_id: conversationId,
            role: 'assistant',
            content: isCompletionLimit
              ? '📊 **Limite de Tokens Atingido**\n\nA resposta do assistente foi cortada porque atingiu o limite máximo de tokens de resposta (max_completion_tokens).\n\n**Como resolver:**\n1. Vá para o painel de assistentes\n2. Edite este assistente\n3. Aumente o valor de "Máximo de Tokens de Resposta" (recomendado: 1000-2000)\n\n**Nota:** Tokens maiores permitem respostas mais longas, mas aumentam o custo por mensagem.'
              : '📊 **Limite de Prompt Atingido**\n\nA conversa ficou muito longa e excedeu o limite de tokens do prompt (max_prompt_tokens).\n\n**Como resolver:**\n1. Inicie uma nova conversa\n2. OU vá para o painel de assistentes e aumente o limite de tokens do prompt\n\n**Nota:** Conversas muito longas consomem mais tokens e aumentam os custos.',
          },
        });
      } catch (err) {
        console.error(`[JOB ${job.id}] Failed to save token limit error message to database:`, err);
      }

      // Don't retry token limit errors (they'll just fail again with the same limits)
      return {
        success: false,
        assistantMessageId: undefined,
        assistantMessageContent: undefined,
      };
    }

    // Check if error is related to function calling
    if (error instanceof Error && error.message.includes('function calling')) {
      console.log(`[JOB ${job.id}] ⚠️ Function calling error - saving error message to user`);

      // Save function calling error as assistant message so user sees it
      try {
        await prisma.message.create({
          data: {
            conversation_id: conversationId,
            role: 'assistant',
            content: '⚠️ **Configuração Incorreta do Assistente**\n\nEste assistente ainda tem funções (function calling) configuradas na OpenAI, mas o sistema não suporta mais essa funcionalidade.\n\n**Como resolver:**\n1. Vá para o painel de assistentes\n2. Exclua este assistente\n3. Crie um novo assistente\n\nO novo assistente será criado sem funções e funcionará corretamente.',
          },
        });
      } catch (err) {
        console.error(`[JOB ${job.id}] Failed to save function calling error message to database:`, err);
      }

      // Don't retry function calling errors (they'll just fail again)
      return {
        success: false,
        assistantMessageId: undefined,
        assistantMessageContent: undefined,
      };
    }

    // Check if error is related to assistant not found
    if (error instanceof Error && (error.message.includes('No assistant found') || error.message.includes('404'))) {
      console.log(`[JOB ${job.id}] ⚠️ Assistant not found in OpenAI - saving error message to user`);

      // Save assistant not found error as assistant message so user sees it
      try {
        await prisma.message.create({
          data: {
            conversation_id: conversationId,
            role: 'assistant',
            content: '⚠️ **Assistente Não Encontrado**\n\nEsta conversa está usando um assistente que foi deletado da OpenAI.\n\n**Como resolver:**\n1. Crie um novo lead/conversa\n2. OU atualize o assistente deste lead no painel\n\n**Nota:** Conversas antigas não podem ser reutilizadas após deletar um assistente.',
          },
        });
      } catch (err) {
        console.error(`[JOB ${job.id}] Failed to save assistant not found error message to database:`, err);
      }

      // Don't retry assistant not found errors (they'll just fail again)
      return {
        success: false,
        assistantMessageId: undefined,
        assistantMessageContent: undefined,
      };
    }

    // Re-throw the error to trigger Bull retry mechanism
    console.log(`[JOB ${job.id}] Re-throwing error to trigger retry mechanism...`);
    throw error;
  }
});

console.log('🚀 Message worker started and listening for jobs...');

export default messageQueue;
