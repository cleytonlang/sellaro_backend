import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../utils/prisma'
import { encryptToken, decryptToken } from '../utils/crypto'

export class SettingsController {
  async getSettings(
    request: FastifyRequest<{
      Params: { userId: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          openai_api_key: true,
        },
      })

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        })
      }

      // Decrypt the API key if it exists
      let decryptedApiKey = ''
      if (user.openai_api_key) {
        try {
          decryptedApiKey = decryptToken(user.openai_api_key)
        } catch (err) {
          console.error('Error decrypting API key:', err)
          decryptedApiKey = ''
        }
      }

      // Return masked API key (show only last 4 characters)
      const maskedApiKey = decryptedApiKey
        ? `sk-...${decryptedApiKey.slice(-4)}`
        : ''

      return reply.send({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          openai_api_key: maskedApiKey,
          hasApiKey: !!user.openai_api_key,
        },
      })
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch settings',
      })
    }
  }

  async updateSettings(
    request: FastifyRequest<{
      Params: { userId: string }
      Body: {
        openai_api_key?: string
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params
      const { openai_api_key } = request.body

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        })
      }

      let updateData: any = {}

      // Encrypt the API key if provided
      if (openai_api_key) {
        // Validate API key format (should start with sk-)
        if (!openai_api_key.startsWith('sk-')) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid API key format',
          })
        }

        updateData.openai_api_key = encryptToken(openai_api_key)
      } else if (openai_api_key === '') {
        // Allow empty string to clear the API key
        updateData.openai_api_key = null
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          openai_api_key: true,
        },
      })

      // Return masked API key
      const maskedApiKey = updatedUser.openai_api_key
        ? `sk-...${decryptToken(updatedUser.openai_api_key).slice(-4)}`
        : ''

      return reply.send({
        success: true,
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          openai_api_key: maskedApiKey,
          hasApiKey: !!updatedUser.openai_api_key,
        },
      })
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to update settings',
      })
    }
  }

  async getDecryptedApiKey(
    request: FastifyRequest<{
      Params: { userId: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          openai_api_key: true,
        },
      })

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        })
      }

      if (!user.openai_api_key) {
        return reply.status(400).send({
          success: false,
          error: 'API key not configured',
        })
      }

      try {
        const decryptedKey = decryptToken(user.openai_api_key)
        return reply.send({
          success: true,
          data: {
            api_key: decryptedKey,
          },
        })
      } catch (err) {
        console.error('Error decrypting API key:', err)
        return reply.status(500).send({
          success: false,
          error: 'Failed to decrypt API key',
        })
      }
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch API key',
      })
    }
  }

  async validateApiKey(
    request: FastifyRequest<{
      Params: { userId: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          openai_api_key: true,
        },
      })

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        })
      }

      if (!user.openai_api_key) {
        return reply.status(400).send({
          success: false,
          error: 'API key not configured',
        })
      }

      let decryptedKey: string
      try {
        decryptedKey = decryptToken(user.openai_api_key)
      } catch (err) {
        console.error('Error decrypting API key:', err)
        return reply.status(500).send({
          success: false,
          error: 'Failed to decrypt API key',
        })
      }

      // Validate the API key by making a request to OpenAI
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${decryptedKey}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.status === 401) {
          return reply.send({
            success: false,
            error: 'Chave de API inválida ou expirada',
            valid: false,
          })
        }

        if (!response.ok) {
          return reply.send({
            success: false,
            error: 'Erro ao validar a chave de API',
            valid: false,
          })
        }

        // Check billing/usage information
        const billingResponse = await fetch('https://api.openai.com/v1/dashboard/billing/subscription', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${decryptedKey}`,
            'Content-Type': 'application/json',
          },
        })

        let hasCredits = true
        let billingInfo = null

        if (billingResponse.ok) {
          billingInfo = await billingResponse.json()
          // Check if account has access
          hasCredits = billingInfo.has_payment_method || billingInfo.soft_limit_usd > 0
        }

        return reply.send({
          success: true,
          valid: true,
          hasCredits,
          message: hasCredits
            ? 'Chave de API válida e com créditos disponíveis'
            : 'Chave de API válida, mas sem créditos ou método de pagamento configurado',
        })
      } catch (err) {
        console.error('Error validating API key:', err)
        return reply.status(500).send({
          success: false,
          error: 'Erro ao conectar com a OpenAI',
          valid: false,
        })
      }
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to validate API key',
      })
    }
  }
}
