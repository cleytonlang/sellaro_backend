import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../lib/auth';
import prisma from '../utils/prisma';

type PermissionType = 'users' | 'threads' | 'integrations' | 'forms' | 'assistants';

// Estende o tipo FastifyRequest para incluir o user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      emailVerified: boolean;
    };
  }
}

/**
 * Middleware de autenticação que valida a sessão usando Better Auth
 * Extrai o userId do cookie de sessão e anexa ao request
 *
 * IMPORTANTE: Este middleware garante que:
 * 1. O usuário está autenticado
 * 2. O userId vem do token validado (não de parâmetros da request)
 * 3. Não há possibilidade de spoofing de identidade
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Extrai cookies do header
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return reply.status(401).send({
        success: false,
        error: 'No session cookie provided',
      });
    }

    // Valida a sessão usando Better Auth
    // Better Auth verifica automaticamente o cookie de sessão
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    if (!session || !session.user) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid or expired session',
      });
    }

    // Anexa o user ao request para uso nos controllers
    // CRÍTICO: O userId agora vem EXCLUSIVAMENTE do token validado
    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      emailVerified: session.user.emailVerified,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return reply.status(401).send({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Middleware opcional de autenticação
 * Não bloqueia a request se não houver sessão,
 * mas valida e anexa o user se houver
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    const cookieHeader = request.headers.cookie;

    if (cookieHeader) {
      const session = await auth.api.getSession({
        headers: request.headers as any,
      });

      if (session?.user) {
        request.user = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          emailVerified: session.user.emailVerified,
        };
      }
    }
  } catch (_error) {
    // Ignora erros em autenticação opcional
  }
}

/**
 * Cria um middleware de verificação de permissão para um módulo específico
 * Deve ser usado APÓS o authMiddleware
 *
 * @param permission - Nome da permissão a verificar (users, threads, integrations, forms, assistants)
 * @returns Middleware que verifica se o usuário tem a permissão necessária
 */
export function requirePermission(permission: PermissionType) {
  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const userId = request.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          owner_id: true,
          can_access_users: true,
          can_access_threads: true,
          can_access_integrations: true,
          can_access_forms: true,
          can_access_assistants: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      // Se o usuário é owner (não tem owner_id), ele tem todas as permissões
      if (user.owner_id === null) {
        return; // Permitir acesso
      }

      // Verificar a permissão específica
      const permissionMap: Record<PermissionType, boolean> = {
        users: user.can_access_users,
        threads: user.can_access_threads,
        integrations: user.can_access_integrations,
        forms: user.can_access_forms,
        assistants: user.can_access_assistants,
      };

      if (!permissionMap[permission]) {
        return reply.status(403).send({
          success: false,
          error: 'Você não tem permissão para acessar este módulo',
        });
      }

      // Permitir acesso
    } catch (error) {
      console.error('Permission check error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Permission verification failed',
      });
    }
  };
}
