import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../utils/prisma'
import { emailService } from '../services/emailService'
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

export class PasswordResetController {
  async requestReset(
    request: FastifyRequest<{
      Body: {
        email: string
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { email } = request.body

      // Validar email
      if (!email || !email.includes('@')) {
        return reply.status(400).send({
          success: false,
          error: 'Email inválido',
        })
      }

      // Verificar se o usuário existe
      const user = await prisma.user.findUnique({
        where: { email },
      })

      // Por segurança, sempre retornar sucesso mesmo se o email não existir
      // Isso evita que atacantes descubram quais emails estão cadastrados
      if (!user) {
        return reply.send({
          success: true,
          message: 'Se o email existir, você receberá sua nova senha por email',
        })
      }

      // Gerar nova senha aleatória
      const newPassword = generateRandomPassword(12)

      // Atualizar a senha do usuário usando a função hashPassword do Better Auth
      try {
        const hashedPassword = await hashPassword(newPassword)

        // Buscar a conta do usuário
        let account = await prisma.account.findFirst({
          where: {
            userId: user.id,
            providerId: 'credential',
          },
        })

        if (!account) {
          // Usuário não tem autenticação por senha (ex: login com Google)
          // Criar uma nova conta credential
          const cuid = await import('@paralleldrive/cuid2')

          account = await prisma.account.create({
            data: {
              id: cuid.createId(),
              accountId: user.id,
              providerId: 'credential',
              userId: user.id,
              password: hashedPassword,
            },
          })
        } else {
          // Usuário já tem autenticação por senha, apenas atualizar
          await prisma.account.update({
            where: { id: account.id },
            data: {
              password: hashedPassword,
            },
          })
        }
      } catch (authError: any) {
        console.error('Erro ao atualizar senha:', authError)
        return reply.status(500).send({
          success: false,
          error: 'Erro ao gerar nova senha',
        })
      }

      // Enviar email com a nova senha
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const loginLink = `${frontendUrl}/login`

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Nova Senha - Sellaro</h2>
          <p>Olá,</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
          <p>Sua nova senha foi gerada. Use as credenciais abaixo para fazer login:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
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
          <p style="color: #666; font-size: 12px;">
            Se você não solicitou a redefinição de senha, entre em contato conosco imediatamente.
          </p>
        </div>
      `

      try {
        await emailService.sendEmail({
          to: [email],
          subject: 'Sua nova senha - Sellaro',
          html: emailHtml,
        })
      } catch (emailError) {
        console.error('Erro ao enviar email de reset:', emailError)
        return reply.status(500).send({
          success: false,
          error: 'Erro ao enviar email. Tente novamente mais tarde.',
        })
      }

      return reply.send({
        success: true,
        message: 'Se o email existir, você receberá sua nova senha por email',
      })
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Falha ao processar solicitação',
      })
    }
  }

}
