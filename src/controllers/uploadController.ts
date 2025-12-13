import { FastifyRequest, FastifyReply } from 'fastify'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

export const uploadController = {
  async uploadImage(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Get the file from multipart form data
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file provided',
        })
      }

      const { file, filename, mimetype } = data

      // Validate file type
      if (!mimetype.startsWith('image/')) {
        return reply.status(400).send({
          success: false,
          error: 'File must be an image',
        })
      }

      // Read file buffer
      const chunks: Buffer[] = []
      for await (const chunk of file) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)

      // Validate file size (max 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({
          success: false,
          error: 'File size must be less than 5MB',
        })
      }

      // Generate unique filename
      const uniqueFilename = `${uuidv4()}-${filename}`

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME || '',
        Key: uniqueFilename,
        Body: buffer,
        ContentType: mimetype,
      })

      await s3Client.send(command)

      // Construct the public URL
      const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uniqueFilename}`

      return reply.status(200).send({
        success: true,
        data: {
          url: imageUrl,
          fileName: uniqueFilename,
        },
      })
    } catch (error) {
      console.error('Upload error:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to upload image',
      })
    }
  },
}
