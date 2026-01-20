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

// Tipos de arquivo permitidos para anexos
const ALLOWED_FILE_TYPES = [
  // Imagens
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Texto
  'text/plain',
  'text/csv',
  // Compactados
  'application/zip',
  'application/x-rar-compressed',
]

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

  async uploadFile(request: FastifyRequest, reply: FastifyReply) {
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
      if (!ALLOWED_FILE_TYPES.includes(mimetype)) {
        return reply.status(400).send({
          success: false,
          error: 'File type not allowed. Allowed types: images, PDF, Word, Excel, PowerPoint, text, CSV, ZIP, RAR',
        })
      }

      // Read file buffer
      const chunks: Buffer[] = []
      for await (const chunk of file) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)

      // Validate file size (max 10MB for attachments)
      const maxSize = 10 * 1024 * 1024
      if (buffer.length > maxSize) {
        return reply.status(400).send({
          success: false,
          error: 'File size must be less than 10MB',
        })
      }

      // Generate unique filename with folder prefix
      const uniqueFilename = `attachments/${uuidv4()}-${filename}`

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME || '',
        Key: uniqueFilename,
        Body: buffer,
        ContentType: mimetype,
      })

      await s3Client.send(command)

      // Construct the public URL
      const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uniqueFilename}`

      return reply.status(200).send({
        success: true,
        data: {
          url: fileUrl,
          fileName: filename,
          fileType: mimetype,
          fileSize: buffer.length,
        },
      })
    } catch (error) {
      console.error('Upload error:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to upload file',
      })
    }
  },
}
