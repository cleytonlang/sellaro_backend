import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string[];
  subject: string;
  html: string;
  from?: string;
}

export const emailService = {
  /**
   * Send an email using Resend
   * @param params - Email parameters
   * @returns Promise with the email sending result
   */
  async sendEmail({ to, subject, html, from }: SendEmailParams) {
    try {
      // Default sender email
      const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'contact@resend.dev';

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        console.error('Error sending email with Resend:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }

      console.log('Email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error in emailService.sendEmail:', error);
      throw error;
    }
  },

  /**
   * Send lead data email
   * @param recipients - Comma-separated email addresses
   * @param subject - Email subject
   * @param content - Email content
   * @param leadData - Lead form data to include in email
   */
  async sendLeadEmail(
    recipients: string,
    subject: string,
    content: string,
    leadData: Record<string, any>
  ) {
    // Split and clean recipient emails
    const recipientEmails = recipients
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (recipientEmails.length === 0) {
      throw new Error('No valid recipient emails provided');
    }

    // Build HTML email with lead data
    const leadDataHtml = Object.entries(leadData)
      .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
      .join('');

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
            .lead-data { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50; margin-top: 20px; }
            ul { list-style: none; padding: 0; }
            li { padding: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Novo Lead Capturado</h2>
            </div>
            <div class="content">
              <div>${content}</div>

              <div class="lead-data">
                <h3>Dados do Lead:</h3>
                <ul>
                  ${leadDataHtml}
                </ul>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmails,
      subject,
      html,
    });
  },
};
