import prisma from '../utils/prisma';

export class FunctionExecutionService {
  /**
   * Execute a function call from OpenAI
   */
  async executeFunction(
    functionName: string,
    arguments_: any,
    leadId: string,
    userId: string
  ): Promise<any> {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔧 FUNCTION EXECUTION STARTED`);
      console.log(`📝 Function: ${functionName}`);
      console.log(`📋 Arguments:`, arguments_);
      console.log(`👤 Lead ID (from conversation): ${leadId}`);
      console.log(`👤 User ID: ${userId}`);
      console.log(`${'='.repeat(80)}\n`);

      switch (functionName) {
        case 'move_lead_column':
          // ALWAYS use leadId from conversation (the real lead ID)
          // Ignore lead_id from arguments as it may contain email or other field
          const targetLeadId = leadId;
          console.log(`🎯 Moving lead ${targetLeadId} to column ${arguments_.column_id}`);
          if (arguments_.lead_id && arguments_.lead_id !== leadId) {
            console.log(`⚠️ Ignoring lead_id from arguments: ${arguments_.lead_id} (using conversation lead_id instead)`);
          }

          console.log(`✅ Would move lead ${targetLeadId} to column ${arguments_.column_id} with reason: ${arguments_.reason || 'none'}`);
          console.log(`📝 (Database operation skipped for testing)\n`);
          console.log('===============================')
          return {
            success: true,
            message: `Lead would be moved to column ${arguments_.column_id}`,
            lead_id: targetLeadId,
            column_id: arguments_.column_id,
            reason: arguments_.reason || 'none'
          };

        case 'add_lead_comment':
          // ALWAYS use leadId from conversation (the real lead ID)
          // Ignore lead_id from arguments as it may contain email or other field
          const commentLeadId = leadId;
          console.log(`🎯 Adding comment to lead ${commentLeadId}`);
          if (arguments_.lead_id && arguments_.lead_id !== leadId) {
            console.log(`⚠️ Ignoring lead_id from arguments: ${arguments_.lead_id} (using conversation lead_id instead)`);
          }

          console.log(`✅ Would add comment to lead ${commentLeadId}: "${arguments_.comment}"`);
          console.log(`📝 (Database operation skipped for testing)\n`);
          console.log('===============================')
          return {
            success: true,
            message: 'Comment would be added successfully',
            lead_id: commentLeadId,
            comment: arguments_.comment,
            user_id: userId
          };

        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ ERROR executing function ${functionName}`);
      console.error(`📋 Error:`, error);
      console.error(`${'='.repeat(80)}\n`);
      throw error;
    }
  }

  /**
   * Move a lead to a different column
   * Currently disabled for testing - using mock response instead
   */
  // @ts-ignore - Will be used when database operations are enabled
  private async _moveLeadColumn(
    leadId: string,
    columnId: string,
    reason?: string
  ): Promise<any> {
    console.log(`📦 moveLeadColumn - Lead: ${leadId}, Column: ${columnId}, Reason: ${reason || 'none'}`);

    // Get current lead to save old column
    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { kanban_column_id: true },
    });

    if (!currentLead) {
      throw new Error(`Lead with id ${leadId} not found`);
    }

    // Verify column exists
    const column = await prisma.kanbanColumn.findUnique({
      where: { id: columnId },
    });

    if (!column) {
      throw new Error(`Column with id ${columnId} not found`);
    }

    // Update lead
    await prisma.lead.update({
      where: { id: leadId },
      data: { kanban_column_id: columnId },
      include: {
        kanban_column: true,
        form: true,
      },
    });

    console.log(`✅ Lead ${leadId} moved from column ${currentLead.kanban_column_id} to ${columnId}`);

    // Create event
    await prisma.leadEvent.create({
      data: {
        lead_id: leadId,
        type: 'COLUMN_CHANGED',
        data: {
          old_column_id: currentLead.kanban_column_id,
          new_column_id: columnId,
          reason: reason || 'Changed by assistant',
        },
      },
    });

    return {
      success: true,
      message: `Lead moved to column: ${column.name}`,
      lead_id: leadId,
      column_id: columnId,
      column_name: column.name,
    };
  }

  /**
   * Add a comment to a lead
   * Currently disabled for testing - using mock response instead
   */
  // @ts-ignore - Will be used when database operations are enabled
  private async _addLeadComment(
    leadId: string,
    comment: string,
    userId: string
  ): Promise<any> {
    console.log(`💬 addLeadComment - Lead: ${leadId}, User: ${userId}, Comment: ${comment.substring(0, 50)}...`);

    // Verify lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new Error(`Lead with id ${leadId} not found`);
    }

    // Create comment
    const leadComment = await prisma.leadComment.create({
      data: {
        lead_id: leadId,
        user_id: userId,
        content: comment,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    console.log(`✅ Comment ${leadComment.id} added to lead ${leadId}`);

    // Create event
    await prisma.leadEvent.create({
      data: {
        lead_id: leadId,
        type: 'COMMENT_ADDED',
        data: {
          comment_id: leadComment.id,
          content: comment.substring(0, 100),
        },
      },
    });

    return {
      success: true,
      message: 'Comment added successfully',
      comment_id: leadComment.id,
      lead_id: leadId,
    };
  }
}

export const functionExecutionService = new FunctionExecutionService();
