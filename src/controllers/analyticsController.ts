import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';

export class AnalyticsController {
  /**
   * Get leads created per day for the last 30 days
   */
  async getLeadsCreatedPerDay(
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

      // Get date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all leads created in the last 30 days for user's forms
      const leads = await prisma.lead.findMany({
        where: {
          form: {
            userId,
          },
          deleted_at: null,
          created_at: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          created_at: true,
        },
      });

      // Group leads by day
      const leadsByDay: Record<string, number> = {};

      // Initialize all days with 0
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        leadsByDay[dateKey] = 0;
      }

      // Count leads per day
      leads.forEach((lead) => {
        const dateKey = lead.created_at.toISOString().split('T')[0];
        if (leadsByDay[dateKey] !== undefined) {
          leadsByDay[dateKey]++;
        }
      });

      // Convert to array format
      const data = Object.entries(leadsByDay).map(([date, count]) => ({
        date,
        count,
      }));

      return reply.send({
        success: true,
        data,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch leads created per day',
      });
    }
  }

  /**
   * Get leads updated per day for the last 30 days
   * (leads that had their kanban column changed or form data updated)
   */
  async getLeadsUpdatedPerDay(
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

      // Get date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all leads updated in the last 30 days for user's forms
      // We use raw SQL to compare updated_at with created_at
      const leads = await prisma.$queryRaw<Array<{ updated_at: Date }>>`
        SELECT l.updated_at
        FROM "lead" l
        INNER JOIN "form" f ON l.form_id = f.id
        WHERE f."userId" = ${userId}
          AND l.deleted_at IS NULL
          AND l.updated_at >= ${thirtyDaysAgo}
          AND l.updated_at != l.created_at
      `;

      // Group leads by day
      const leadsByDay: Record<string, number> = {};

      // Initialize all days with 0
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        leadsByDay[dateKey] = 0;
      }

      // Count leads per day
      leads.forEach((lead) => {
        const dateKey = lead.updated_at.toISOString().split('T')[0];
        if (leadsByDay[dateKey] !== undefined) {
          leadsByDay[dateKey]++;
        }
      });

      // Convert to array format
      const data = Object.entries(leadsByDay).map(([date, count]) => ({
        date,
        count,
      }));

      return reply.send({
        success: true,
        data,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch leads updated per day',
      });
    }
  }

  /**
   * Get messages sent per day for the last 30 days
   */
  async getMessagesPerDay(
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

      // Get date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all messages from conversations of user's forms in the last 30 days
      const messages = await prisma.message.findMany({
        where: {
          conversation: {
            lead: {
              form: {
                userId,
              },
            },
          },
          created_at: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          created_at: true,
        },
      });

      // Group messages by day
      const messagesByDay: Record<string, number> = {};

      // Initialize all days with 0
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        messagesByDay[dateKey] = 0;
      }

      // Count messages per day
      messages.forEach((message) => {
        const dateKey = message.created_at.toISOString().split('T')[0];
        if (messagesByDay[dateKey] !== undefined) {
          messagesByDay[dateKey]++;
        }
      });

      // Convert to array format
      const data = Object.entries(messagesByDay).map(([date, count]) => ({
        date,
        count,
      }));

      return reply.send({
        success: true,
        data,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch messages per day',
      });
    }
  }
}
