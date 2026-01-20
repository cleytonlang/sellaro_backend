import { FastifyInstance } from 'fastify'
import { uploadController } from '../controllers/uploadController'
import { authMiddleware } from '../middlewares/auth'

export default async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/images',
    {
      schema: {
        description: 'Upload image to S3',
        tags: ['Upload'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            description: 'Image uploaded successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  fileName: { type: 'string' },
                },
              },
            },
          },
          400: {
            description: 'Bad request',
          },
          500: {
            description: 'Internal server error',
          },
        },
      },
    },
    uploadController.uploadImage
  )

  // Upload de arquivos genérico (para anexos em comentários)
  fastify.post(
    '/files',
    {
      preHandler: authMiddleware,
      schema: {
        description: 'Upload file to S3 (for attachments)',
        tags: ['Upload'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            description: 'File uploaded successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  fileName: { type: 'string' },
                  fileType: { type: 'string' },
                  fileSize: { type: 'number' },
                },
              },
            },
          },
          400: {
            description: 'Bad request',
          },
          500: {
            description: 'Internal server error',
          },
        },
      },
    },
    uploadController.uploadFile
  )
}
