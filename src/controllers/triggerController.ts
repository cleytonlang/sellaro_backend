import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';

interface TriggerParams {
  assistantId: string;
  id?: string;
}

interface CreateTriggerBody {
  type: 'CHANGE_STAGE' | 'SEND_EMAIL';
  config: any;
  order?: number;
}

interface UpdateTriggerBody {
  type?: 'CHANGE_STAGE' | 'SEND_EMAIL';
  config?: any;
  is_active?: boolean;
  order?: number;
}

interface ReorderTriggersBody {
  triggerIds: string[];
}

// Get all triggers for an assistant
export async function getTriggers(
  request: FastifyRequest<{ Params: TriggerParams }>,
  reply: FastifyReply
) {
  try {
    const { assistantId } = request.params;

    // Verify assistant exists and belongs to user
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId },
    });

    if (!assistant) {
      return reply.status(404).send({ error: 'Assistant not found' });
    }

    const triggers = await prisma.trigger.findMany({
      where: { assistant_id: assistantId },
      orderBy: { order: 'asc' },
    });

    return reply.send(triggers);
  } catch (error) {
    console.error('Error getting triggers:', error);
    return reply.status(500).send({ error: 'Failed to get triggers' });
  }
}

// Create a new trigger
export async function createTrigger(
  request: FastifyRequest<{ Params: TriggerParams; Body: CreateTriggerBody }>,
  reply: FastifyReply
) {
  try {
    const { assistantId } = request.params;
    const { type, config, order } = request.body;

    // Verify assistant exists
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId },
    });

    if (!assistant) {
      return reply.status(404).send({ error: 'Assistant not found' });
    }

    // Validate config based on type
    if (type === 'CHANGE_STAGE') {
      if (!config.formId || !config.kanbanColumnId) {
        return reply.status(400).send({
          error: 'Config must include formId and kanbanColumnId for CHANGE_STAGE trigger'
        });
      }
    } else if (type === 'SEND_EMAIL') {
      if (!config.subject || !config.content) {
        return reply.status(400).send({
          error: 'Config must include subject and content for SEND_EMAIL trigger'
        });
      }
    }

    // Get the next order number if not provided
    let triggerOrder = order;
    if (triggerOrder === undefined) {
      const lastTrigger = await prisma.trigger.findFirst({
        where: { assistant_id: assistantId },
        orderBy: { order: 'desc' },
      });
      triggerOrder = lastTrigger ? lastTrigger.order + 1 : 0;
    }

    const trigger = await prisma.trigger.create({
      data: {
        assistant_id: assistantId,
        type,
        config,
        order: triggerOrder,
      },
    });

    return reply.status(201).send(trigger);
  } catch (error) {
    console.error('Error creating trigger:', error);
    return reply.status(500).send({ error: 'Failed to create trigger' });
  }
}

// Update a trigger
export async function updateTrigger(
  request: FastifyRequest<{ Params: TriggerParams; Body: UpdateTriggerBody }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { type, config, is_active, order } = request.body;

    // Verify trigger exists
    const existingTrigger = await prisma.trigger.findUnique({
      where: { id },
    });

    if (!existingTrigger) {
      return reply.status(404).send({ error: 'Trigger not found' });
    }

    // Validate config if provided
    if (config && type) {
      if (type === 'CHANGE_STAGE' && (!config.formId || !config.kanbanColumnId)) {
        return reply.status(400).send({
          error: 'Config must include formId and kanbanColumnId for CHANGE_STAGE trigger'
        });
      } else if (type === 'SEND_EMAIL' && (!config.subject || !config.content)) {
        return reply.status(400).send({
          error: 'Config must include subject and content for SEND_EMAIL trigger'
        });
      }
    }

    const trigger = await prisma.trigger.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(config && { config }),
        ...(is_active !== undefined && { is_active }),
        ...(order !== undefined && { order }),
      },
    });

    return reply.send(trigger);
  } catch (error) {
    console.error('Error updating trigger:', error);
    return reply.status(500).send({ error: 'Failed to update trigger' });
  }
}

// Delete a trigger
export async function deleteTrigger(
  request: FastifyRequest<{ Params: TriggerParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    // Verify trigger exists
    const existingTrigger = await prisma.trigger.findUnique({
      where: { id },
    });

    if (!existingTrigger) {
      return reply.status(404).send({ error: 'Trigger not found' });
    }

    await prisma.trigger.delete({
      where: { id },
    });

    return reply.send({ success: true });
  } catch (error) {
    console.error('Error deleting trigger:', error);
    return reply.status(500).send({ error: 'Failed to delete trigger' });
  }
}

// Reorder triggers
export async function reorderTriggers(
  request: FastifyRequest<{ Params: TriggerParams; Body: ReorderTriggersBody }>,
  reply: FastifyReply
) {
  try {
    const { assistantId } = request.params;
    const { triggerIds } = request.body;

    // Verify all triggers belong to the assistant
    const triggers = await prisma.trigger.findMany({
      where: {
        id: { in: triggerIds },
        assistant_id: assistantId,
      },
    });

    if (triggers.length !== triggerIds.length) {
      return reply.status(400).send({ error: 'Invalid trigger IDs' });
    }

    // Update order for each trigger
    const updatePromises = triggerIds.map((triggerId, index) =>
      prisma.trigger.update({
        where: { id: triggerId },
        data: { order: index },
      })
    );

    await Promise.all(updatePromises);

    // Return updated triggers
    const updatedTriggers = await prisma.trigger.findMany({
      where: { assistant_id: assistantId },
      orderBy: { order: 'asc' },
    });

    return reply.send(updatedTriggers);
  } catch (error) {
    console.error('Error reordering triggers:', error);
    return reply.status(500).send({ error: 'Failed to reorder triggers' });
  }
}
