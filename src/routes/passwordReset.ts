import { FastifyInstance } from 'fastify'
import { PasswordResetController } from '../controllers/passwordResetController'

export async function passwordResetRoutes(app: FastifyInstance) {
  const controller = new PasswordResetController()

  // Request password reset - Gera nova senha e envia por email (public)
  app.post('/api/password-reset/request',
    (request, reply) => controller.requestReset(request as any, reply)
  )
}
