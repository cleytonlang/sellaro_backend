import * as crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set')
}

// Ensure key is 32 bytes (256 bits) for AES-256
const key = crypto
  .createHash('sha256')
  .update(ENCRYPTION_KEY)
  .digest()

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Combine IV and encrypted data
  return iv.toString('hex') + ':' + encrypted
}

export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
