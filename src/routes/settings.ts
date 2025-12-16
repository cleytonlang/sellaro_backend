import { FastifyInstance } from 'fastify'
import { SettingsController } from '../controllers/settingsController'

export async function settingsRoutes(app: FastifyInstance) {
  const controller = new SettingsController()

  // Get user settings
  app.get('/api/settings/:userId', (request, reply) =>
    controller.getSettings(request as any, reply)
  )

  // Update user settings
  app.put('/api/settings/:userId', (request, reply) =>
    controller.updateSettings(request as any, reply)
  )

  // Get decrypted API key (internal use only)
  app.get('/api/settings/:userId/api-key', (request, reply) =>
    controller.getDecryptedApiKey(request as any, reply)
  )

  // Validate API key credits
  app.post('/api/settings/:userId/validate-api-key', (request, reply) =>
    controller.validateApiKey(request as any, reply)
  )
}
