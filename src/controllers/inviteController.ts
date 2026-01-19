import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../utils/prisma'
import { emailService } from '../services/emailService'
import { auth } from '../lib/auth'
import crypto from 'crypto'
import { hashPassword } from 'better-auth/crypto'

// Gera uma senha aleatória segura com letras maiúsculas, minúsculas e números
function generateRandomPassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const allChars = uppercase + lowercase + numbers

  // Garantir pelo menos um de cada tipo
  let password = ''
  password += uppercase[crypto.randomInt(uppercase.length)]
  password += lowercase[crypto.randomInt(lowercase.length)]
  password += numbers[crypto.randomInt(numbers.length)]

  // Preencher o resto com caracteres aleatórios
  for (let i = 3; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)]
  }

  // Embaralhar a senha para que os caracteres obrigatórios não fiquem sempre no início
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('')
}

export class InviteController {
  async createInvite(
    request: FastifyRequest<{
      Body: {
        email: string
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      const { email } = request.body

      // Validar email
      if (!email || !email.includes('@')) {
        return reply.status(400).send({
          success: false,
          error: 'Email inválido',
        })
      }

      // Verificar se o email já está registrado
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: 'Este email já está registrado no sistema',
        })
      }

      // Verificar se já existe um convite pendente para este email
      const existingInvite = await prisma.userInvite.findFirst({
        where: {
          email,
          invited_by_id: userId,
          status: 'pending',
        },
      })

      if (existingInvite) {
        return reply.status(400).send({
          success: false,
          error: 'Já existe um convite pendente para este email',
        })
      }

      // Buscar informações de quem está convidando
      const invitingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          owner_id: true,
        },
      })

      if (!invitingUser) {
        return reply.status(400).send({
          success: false,
          error: 'Usuário não encontrado',
        })
      }

      // Gerar senha aleatória
      const randomPassword = generateRandomPassword(12)

      // Criar usuário com a senha aleatória usando Better Auth
      let signUpResult
      try {
        signUpResult = await auth.api.signUpEmail({
          body: {
            email: email,
            password: randomPassword,
            name: email.split('@')[0], // Nome provisório baseado no email
          },
        })
      } catch (authError: any) {
        console.error('Erro ao criar usuário:', authError)
        return reply.status(400).send({
          success: false,
          error: 'Falha ao criar conta do usuário convidado',
        })
      }

      if (!signUpResult || signUpResult.error) {
        return reply.status(400).send({
          success: false,
          error: 'Falha ao criar conta do usuário convidado',
        })
      }

      // Determinar o owner_id efetivo:
      // Se quem convidou já é membro de um time, usar o owner dele
      // Caso contrário, quem convidou é o owner
      const effectiveOwnerId = invitingUser.owner_id || userId

      // Marcar email como verificado e definir owner_id (vincula à mesma conta/empresa)
      await prisma.user.update({
        where: { email: email },
        data: {
          emailVerified: true,
          owner_id: effectiveOwnerId,
        },
      })

      // Criar convite com status 'accepted' (já que o usuário foi criado)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const invite = await prisma.userInvite.create({
        data: {
          email,
          invited_by_id: userId,
          expires_at: expiresAt,
          status: 'accepted',
        },
      })

      // Enviar email de convite com a senha
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const loginLink = `${frontendUrl}/login`

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Você foi convidado para o Sellaro!</h2>
          <p>Olá,</p>
          <p><strong>${invitingUser.name}</strong> (${invitingUser.email}) convidou você para se juntar à conta dele no Sellaro.</p>
          <p>Sua conta já foi criada! Use as credenciais abaixo para fazer login:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Senha:</strong> ${randomPassword}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginLink}" style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Fazer Login
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Recomendamos que você altere sua senha após o primeiro login.
          </p>
        </div>
      `

      try {
        await emailService.sendEmail({
          to: email,
          subject: `Você foi convidado para o Sellaro por ${invitingUser.name}`,
          html: emailHtml,
        })
      } catch (emailError) {
        console.error('Erro ao enviar email de convite:', emailError)
        // Não falhar a criação do convite se o email falhar
      }

      return reply.send({
        success: true,
        data: {
          id: invite.id,
          email: invite.email,
          status: invite.status,
          expires_at: invite.expires_at,
          created_at: invite.created_at,
        },
      })
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Falha ao criar convite',
      })
    }
  }

  async getAllInvites(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;

      const invites = await prisma.userInvite.findMany({
        where: {
          invited_by_id: userId,
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          email: true,
          status: true,
          expires_at: true,
          created_at: true,
        },
      })

      return reply.send({
        success: true,
        data: invites,
      })
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Falha ao buscar convites',
      })
    }
  }

  async deleteInvite(
    request: FastifyRequest<{
      Params: {
        id: string
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      const { id } = request.params

      // Verificar se o convite existe e pertence ao usuário
      const invite = await prisma.userInvite.findUnique({
        where: { id },
      })

      if (!invite) {
        return reply.status(404).send({
          success: false,
          error: 'Convite não encontrado',
        })
      }

      if (invite.invited_by_id !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Você não tem permissão para deletar este convite',
        })
      }

      await prisma.userInvite.delete({
        where: { id },
      })

      return reply.send({
        success: true,
        message: 'Convite deletado com sucesso',
      })
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Falha ao deletar convite',
      })
    }
  }

  async resendInvite(
    request: FastifyRequest<{
      Params: {
        id: string
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      // SEGURANÇA: userId vem do token autenticado
      const userId = request.user!.id;
      const { id } = request.params

      // Verificar se o convite existe e pertence ao usuário
      const invite = await prisma.userInvite.findUnique({
        where: { id },
        include: {
          invited_by: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })

      if (!invite) {
        return reply.status(404).send({
          success: false,
          error: 'Convite não encontrado',
        })
      }

      if (invite.invited_by_id !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Você não tem permissão para reenviar este convite',
        })
      }

      // Buscar o usuário convidado
      const invitedUser = await prisma.user.findUnique({
        where: { email: invite.email },
      })

      if (!invitedUser) {
        return reply.status(400).send({
          success: false,
          error: 'Usuário convidado não encontrado',
        })
      }

      // Gerar nova senha aleatória
      const newPassword = generateRandomPassword(12)

      // Atualizar a senha do usuário usando a função hashPassword do Better Auth
      try {
        const hashedPassword = await hashPassword(newPassword)

        // Atualizar a conta na tabela de accounts do Better Auth
        await prisma.account.updateMany({
          where: {
            userId: invitedUser.id,
            providerId: 'credential',
          },
          data: {
            password: hashedPassword,
          },
        })
      } catch (updateError) {
        console.error('Erro ao atualizar senha:', updateError)
        return reply.status(500).send({
          success: false,
          error: 'Falha ao gerar nova senha',
        })
      }

      // Reenviar email com nova senha
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const loginLink = `${frontendUrl}/login`

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Suas credenciais do Sellaro foram atualizadas!</h2>
          <p>Olá,</p>
          <p><strong>${invite.invited_by.name}</strong> (${invite.invited_by.email}) reenviou seu convite para o Sellaro.</p>
          <p>Uma nova senha foi gerada para sua conta. Use as credenciais abaixo para fazer login:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${invite.email}</p>
            <p style="margin: 5px 0;"><strong>Nova Senha:</strong> ${newPassword}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginLink}" style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Fazer Login
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Recomendamos que você altere sua senha após o login.
          </p>
        </div>
      `

      try {
        await emailService.sendEmail({
          to: invite.email,
          subject: `Suas credenciais do Sellaro foram atualizadas`,
          html: emailHtml,
        })

        return reply.send({
          success: true,
          message: 'Convite reenviado com nova senha',
        })
      } catch (emailError) {
        console.error('Erro ao reenviar email de convite:', emailError)
        return reply.status(500).send({
          success: false,
          error: 'Falha ao enviar email de convite',
        })
      }
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Falha ao reenviar convite',
      })
    }
  }

}
