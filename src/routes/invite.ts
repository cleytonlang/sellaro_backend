import { FastifyInstance } from 'fastify'
import { InviteController } from '../controllers/inviteController'
import { authMiddleware } from '../middlewares/auth'

export async function inviteRoutes(app: FastifyInstance) {
  const controller = new InviteController()

  // Create new invite (protected)
  app.post('/api/invites',
    { preHandler: authMiddleware },
    (request, reply) => controller.createInvite(request as any, reply)
  )

  // Get all invites for current user (protected)
  app.get('/api/invites',
    { preHandler: authMiddleware },
    (request, reply) => controller.getAllInvites(request as any, reply)
  )

  // Delete invite (protected)
  app.delete('/api/invites/:id',
    { preHandler: authMiddleware },
    (request, reply) => controller.deleteInvite(request as any, reply)
  )

  // Resend invite (protected) - Gera nova senha e reenvia email
  app.post('/api/invites/:id/resend',
    { preHandler: authMiddleware },
    (request, reply) => controller.resendInvite(request as any, reply)
  )
}
