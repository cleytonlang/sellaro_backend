import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../lib/auth';

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
