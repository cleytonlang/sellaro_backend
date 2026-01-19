import prisma from './prisma';

/**
 * Retorna o ID do owner efetivo para um usuário.
 * Se o usuário é um owner (não tem owner_id), retorna o próprio ID.
 * Se o usuário é um membro de um time, retorna o owner_id.
 *
 * @param userId - ID do usuário atual
 * @returns ID do owner efetivo
 */
export async function getEffectiveOwnerId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { owner_id: true },
  });

  // Se o usuário não tem owner_id, ele é o owner
  // Caso contrário, retorna o owner_id
  return user?.owner_id || userId;
}
