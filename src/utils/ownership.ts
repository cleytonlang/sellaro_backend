import prisma from './prisma'

/**
 * Obtém o owner_id efetivo de um usuário.
 *
 * Se o usuário for um membro de time (tem owner_id), retorna o owner_id.
 * Se o usuário for um owner (não tem owner_id), retorna o próprio id do usuário.
 *
 * Isso permite que todos os membros de uma mesma conta/empresa
 * compartilhem os mesmos dados (Forms, Leads, Assistants, etc.)
 */
export async function getEffectiveOwnerId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, owner_id: true },
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  // Se o usuário tem owner_id, ele é membro de um time - retorna o owner
  // Se não tem owner_id, ele é o owner - retorna o próprio id
  return user.owner_id || user.id
}

/**
 * Versão síncrona que recebe o usuário já carregado
 */
export function getEffectiveOwnerIdFromUser(user: { id: string; owner_id: string | null }): string {
  return user.owner_id || user.id
}

/**
 * Verifica se um usuário é owner (conta principal) ou membro do time.
 *
 * @returns true se o usuário é owner (owner_id === null), false se é membro do time (owner_id !== null)
 */
export async function isOwner(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, owner_id: true },
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  // DEBUG LOG
  console.log('🔍 [isOwner] userId:', userId);
  console.log('🔍 [isOwner] user.owner_id:', user.owner_id);
  console.log('🔍 [isOwner] result (owner_id === null):', user.owner_id === null);

  // Se owner_id é null, o usuário é owner
  return user.owner_id === null
}
