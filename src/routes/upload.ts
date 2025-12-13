import { FastifyInstance } from 'fastify'
import { uploadController } from '../controllers/uploadController'

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
}
