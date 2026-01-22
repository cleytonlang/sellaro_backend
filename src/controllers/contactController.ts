import { FastifyRequest, FastifyReply } from 'fastify';
import { emailService } from '../services/emailService';

interface ContactFormBody {
  email: string;
  message: string;
}

export class ContactController {
  /**
   * Send contact form email
   */
  async sendContactEmail(
    request: FastifyRequest<{
      Body: ContactFormBody;
    }>,
    reply: FastifyReply
  ) {
    try {
      const { email, message } = request.body;

      // Validate input
      if (!email || !message) {
        return reply.status(400).send({
          success: false,
          error: 'Email and message are required',
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid email format',
        });
      }

      // Destination email
      const destinationEmail = 'cleytonb40@gmail.com';

      // Create HTML email content
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
              .content { background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
              .field { margin-bottom: 15px; }
              .label { font-weight: bold; color: #555; margin-bottom: 5px; }
              .value { color: #333; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Nova Mensagem do Formulário de Contato</h2>
              </div>
              <div class="content">
                <div class="field">
                  <div class="label">Email:</div>
                  <div class="value">${email}</div>
                </div>
                <div class="field">
                  <div class="label">Mensagem:</div>
                  <div class="value">${message.replace(/\n/g, '<br>')}</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      // Send email
      await emailService.sendEmail({
        to: [destinationEmail],
        subject: 'Nova Mensagem do Formulário de Contato',
        html,
      });

      return reply.send({
        success: true,
        message: 'Email sent successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to send contact email',
      });
    }
  }
}
