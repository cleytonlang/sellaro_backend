import { FastifyInstance } from 'fastify'
import { SettingsController } from '../controllers/settingsController'
import { authMiddleware } from '../middlewares/auth'

export async function settingsRoutes(app: FastifyInstance) {
  const controller = new SettingsController()

  // IMPORTANTE: Removemos :userId dos paths - o userId vem do token autenticado
  // Todas as rotas requerem autenticação

  // Get user settings
  app.get('/api/settings',
    { preHandler: authMiddleware },
    (request, reply) => controller.getSettings(request as any, reply)
  )

  // Update user settings
  app.put('/api/settings',
    { preHandler: authMiddleware },
    (request, reply) => controller.updateSettings(request as any, reply)
  )

  // Get decrypted API key (internal use only)
  app.get('/api/settings/api-key',
    { preHandler: authMiddleware },
    (request, reply) => controller.getDecryptedApiKey(request as any, reply)
  )

  // Validate API key credits
  app.post('/api/settings/validate-api-key',
    { preHandler: authMiddleware },
    (request, reply) => controller.validateApiKey(request as any, reply)
  )
}
