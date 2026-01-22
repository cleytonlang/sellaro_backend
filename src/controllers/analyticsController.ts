import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { getEffectiveOwnerId } from '../utils/ownership';

export class AnalyticsController {
  /**
   * Get leads created per day for the last 30 days (or custom date range)
   */
  async getLeadsCreatedPerDay(
    request: FastifyRequest<{
      Querystring: { form_id?: string; date_from?: string; date_to?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para ver dados de toda a conta/empresa
      const effectiveOwnerId = await getEffectiveOwnerId(userId);

      const { form_id, date_from, date_to } = request.query;

      // Determine date range
      let startDate: Date;
      let endDate: Date = new Date();
      
      if (date_from) {
        startDate = new Date(date_from);
        startDate.setHours(0, 0, 0, 0);
      } else {
        // Default: 30 days ago
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
      }

      if (date_to) {
        endDate = new Date(date_to);
        endDate.setHours(23, 59, 59, 999);
      }

      // Build where clause
      const where: any = {
        form: {
          userId: effectiveOwnerId,
        },
        deleted_at: null,
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      };

      // Add form filter if provided
      if (form_id && form_id.trim() !== '') {
        where.form_id = form_id;
      }

      // Get all leads created in the date range for owner's forms
      const leads = await prisma.lead.findMany({
        where,
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
   * Get leads updated per day for the last 30 days (or custom date range)
   * (leads that had their kanban column changed or form data updated)
   */
  async getLeadsUpdatedPerDay(
    request: FastifyRequest<{
      Querystring: { form_id?: string; date_from?: string; date_to?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para ver dados de toda a conta/empresa
      const effectiveOwnerId = await getEffectiveOwnerId(userId);

      const { form_id, date_from, date_to } = request.query;

      // Determine date range
      let startDate: Date;
      let endDate: Date = new Date();
      
      if (date_from) {
        startDate = new Date(date_from);
        startDate.setHours(0, 0, 0, 0);
      } else {
        // Default: 30 days ago
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
      }

      if (date_to) {
        endDate = new Date(date_to);
        endDate.setHours(23, 59, 59, 999);
      }

      // Get all leads updated in the date range for owner's forms
      // We need to filter leads where updated_at != created_at using raw SQL
      let leads: Array<{ updated_at: Date }>;
      
      if (form_id && form_id.trim() !== '') {
        leads = await prisma.$queryRaw<Array<{ updated_at: Date }>>`
          SELECT l.updated_at
          FROM "lead" l
          INNER JOIN "form" f ON l.form_id = f.id
          WHERE f."userId" = ${effectiveOwnerId}
            AND l.deleted_at IS NULL
            AND l.updated_at >= ${startDate}
            AND l.updated_at <= ${endDate}
            AND l.form_id = ${form_id}
            AND l.updated_at != l.created_at
        `;
      } else {
        leads = await prisma.$queryRaw<Array<{ updated_at: Date }>>`
          SELECT l.updated_at
          FROM "lead" l
          INNER JOIN "form" f ON l.form_id = f.id
          WHERE f."userId" = ${effectiveOwnerId}
            AND l.deleted_at IS NULL
            AND l.updated_at >= ${startDate}
            AND l.updated_at <= ${endDate}
            AND l.updated_at != l.created_at
        `;
      }

      // Group leads by day
      const leadsByDay: Record<string, number> = {};

      // Initialize all days in range with 0
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
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
   * Get messages sent per day for the last 30 days (or custom date range)
   */
  async getMessagesPerDay(
    request: FastifyRequest<{
      Querystring: { form_id?: string; date_from?: string; date_to?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      // Obtém o owner_id efetivo para ver dados de toda a conta/empresa
      const effectiveOwnerId = await getEffectiveOwnerId(userId);

      const { form_id, date_from, date_to } = request.query;

      // Determine date range
      let startDate: Date;
      let endDate: Date = new Date();
      
      if (date_from) {
        startDate = new Date(date_from);
        startDate.setHours(0, 0, 0, 0);
      } else {
        // Default: 30 days ago
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
      }

      if (date_to) {
        endDate = new Date(date_to);
        endDate.setHours(23, 59, 59, 999);
      }

      // Build where clause
      const where: any = {
        conversation: {
          lead: {
            form: {
              userId: effectiveOwnerId,
            },
          },
        },
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      };

      // Add form filter if provided
      if (form_id && form_id.trim() !== '') {
        where.conversation.lead.form_id = form_id;
      }

      // Get all messages from conversations of owner's forms in the date range
      const messages = await prisma.message.findMany({
        where,
        select: {
          created_at: true,
        },
      });

      // Group messages by day
      const messagesByDay: Record<string, number> = {};

      // Initialize all days in range with 0
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
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
