import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../utils/prisma';
import { getEffectiveOwnerId } from '../utils/ownerHelper';

export class UserController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      });

      return reply.send({
        success: true,
        data: users,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  }

  // Buscar membros do time com permissões
  async getTeamMembers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const effectiveOwnerId = await getEffectiveOwnerId(userId);

      // Buscar todos os membros do time (usuários que têm o mesmo owner_id ou que são o próprio owner)
      const teamMembers = await prisma.user.findMany({
        where: {
          OR: [
            { owner_id: effectiveOwnerId },
            { id: effectiveOwnerId }
          ]
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          owner_id: true,
          can_access_users: true,
          can_access_threads: true,
          can_access_integrations: true,
          can_access_forms: true,
          can_access_assistants: true,
          can_access_leads: true,
          can_access_crm: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      // Marcar quem é o owner
      const membersWithRole = teamMembers.map(member => ({
        ...member,
        is_owner: member.id === effectiveOwnerId
      }));

      return reply.send({
        success: true,
        data: membersWithRole,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch team members',
      });
    }
  }

  // Atualizar permissões de um membro do time
  async updatePermissions(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        can_access_users?: boolean;
        can_access_threads?: boolean;
        can_access_integrations?: boolean;
        can_access_forms?: boolean;
        can_access_assistants?: boolean;
        can_access_leads?: boolean;
        can_access_crm?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user!.id;
      const { id: targetUserId } = request.params;
      const permissions = request.body;

      const effectiveOwnerId = await getEffectiveOwnerId(userId);

      // Verificar se o usuário atual é o owner
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { owner_id: true }
      });

      const isOwner = currentUser?.owner_id === null || userId === effectiveOwnerId;

      if (!isOwner) {
        return reply.status(403).send({
          success: false,
          error: 'Apenas o proprietário da conta pode alterar permissões',
        });
      }

      // Verificar se o usuário alvo pertence ao mesmo time
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { owner_id: true }
      });

      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado',
        });
      }

      // Não pode alterar permissões do próprio owner
      if (targetUserId === effectiveOwnerId) {
        return reply.status(400).send({
          success: false,
          error: 'Não é possível alterar permissões do proprietário da conta',
        });
      }

      // Verificar se pertence ao mesmo time
      if (targetUser.owner_id !== effectiveOwnerId) {
        return reply.status(403).send({
          success: false,
          error: 'Usuário não pertence ao seu time',
        });
      }

      // Atualizar permissões
      const updatedUser = await prisma.user.update({
        where: { id: targetUserId },
        data: {
          can_access_users: permissions.can_access_users,
          can_access_threads: permissions.can_access_threads,
          can_access_integrations: permissions.can_access_integrations,
          can_access_forms: permissions.can_access_forms,
          can_access_assistants: permissions.can_access_assistants,
          can_access_leads: permissions.can_access_leads,
          can_access_crm: permissions.can_access_crm,
        },
        select: {
          id: true,
          name: true,
          email: true,
          can_access_users: true,
          can_access_threads: true,
          can_access_integrations: true,
          can_access_forms: true,
          can_access_assistants: true,
          can_access_leads: true,
          can_access_crm: true,
        },
      });

      return reply.send({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update permissions',
      });
    }
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.send({
        success: true,
        data: user,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  }

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; image?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const data = request.body;

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });

      return reply.send({
        success: true,
        data: user,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update user',
      });
    }
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      await prisma.user.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete user',
      });
    }
  }
}
