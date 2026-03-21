/**
 * Email Service for Rebooked
 * 
 * Handles both SMTP sending and POP3 receiving
 * Integrates with lead creation and communication tracking
 */

import { sendEmail } from '../_core/email';
import { checkAndProcessEmails, testPOP3Connection } from '../_core/pop3';
import { logger } from '../_core/logger';
import type { Db } from '../_core/context';

export interface EmailServiceConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
  pop3: {
    host: string;
    port: number;
    tls: boolean;
    user: string;
    password: string;
  };
}

export class EmailService {
  /**
   * Send email using SMTP (local server) or fallback to SendGrid
   */
  static async sendEmail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await sendEmail(options);
      
      if (result.success) {
        logger.info('Email sent successfully', {
          to: options.to,
          subject: options.subject,
        });
      } else {
        logger.warn('Email sending failed', {
          to: options.to,
          subject: options.subject,
          error: result.error,
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = String(error);
      logger.error('Email service error', {
        to: options.to,
        subject: options.subject,
        error: errorMessage,
      });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check and process incoming emails from POP3
   */
  static async processIncomingEmails(db: Db): Promise<{
    success: boolean;
    error?: string;
    messagesProcessed?: number;
  }> {
    try {
      const result = await checkAndProcessEmails(db);
      
      if (result.success) {
        logger.info('Email processing completed', {
          messagesProcessed: result.messagesProcessed,
        });
      } else {
        logger.warn('Email processing failed', {
          error: result.error,
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = String(error);
      logger.error('Email processing service error', {
        error: errorMessage,
      });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test email configuration
   */
  static async testEmailConfiguration(): Promise<{
    smtp: { success: boolean; error?: string };
    pop3: { success: boolean; error?: string };
  }> {
    const results = {
      smtp: { success: false, error: 'SMTP not configured' } as { success: boolean; error?: string },
      pop3: { success: false, error: 'POP3 not configured' } as { success: boolean; error?: string },
    };

    // Test SMTP
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const testResult = await sendEmail({
          to: process.env.EMAIL_FROM_ADDRESS || 'test@rebooked.org',
          subject: 'SMTP Test',
          text: 'This is a test email to verify SMTP configuration.',
        });
        results.smtp = { success: testResult.success, error: testResult.error };
      } catch (error) {
        results.smtp = { success: false, error: String(error) };
      }
    }

    // Test POP3
    try {
      const pop3Result = await testPOP3Connection();
      results.pop3 = pop3Result;
    } catch (error) {
      results.pop3 = { success: false, error: String(error) };
    }

    return results;
  }

  /**
   * Get email configuration status
   */
  static getConfigurationStatus(): {
    smtp: boolean;
    pop3: boolean;
    sendgrid: boolean;
    details: {
      smtpHost?: string;
      smtpPort?: string;
      smtpUser?: string;
      pop3Host?: string;
      pop3Port?: string;
      pop3User?: string;
      hasSendGrid?: boolean;
    };
  } {
    return {
      smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      pop3: !!(process.env.POP3_USER && process.env.POP3_PASSWORD),
      sendgrid: !!process.env.SENDGRID_API_KEY,
      details: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        smtpUser: process.env.SMTP_USER,
        pop3Host: process.env.POP3_HOST,
        pop3Port: process.env.POP3_PORT,
        pop3User: process.env.POP3_USER,
        hasSendGrid: !!process.env.SENDGRID_API_KEY,
      },
    };
  }

  /**
   * Send welcome email to new lead
   */
  static async sendWelcomeEmail(
    leadName: string,
    leadEmail: string,
    tenantName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const subject = `Welcome to ${tenantName || 'Rebooked'}!`;
    const text = `Hi ${leadName},

Welcome to ${tenantName || 'Rebooked'}! We're excited to have you on board.

We'll be reaching out to you shortly to discuss how we can help you grow your business.

If you have any questions in the meantime, feel free to reply to this email.

Best regards,
The ${tenantName || 'Rebooked'} Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to ${tenantName || 'Rebooked'}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { padding: 20px 0; }
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to ${tenantName || 'Rebooked'}!</h1>
        </div>
        <div class="content">
            <p>Hi ${leadName},</p>
            <p>Welcome to ${tenantName || 'Rebooked'}! We're excited to have you on board.</p>
            <p>We'll be reaching out to you shortly to discuss how we can help you grow your business.</p>
            <p>If you have any questions in the meantime, feel free to reply to this email.</p>
            <p>Best regards,<br>The ${tenantName || 'Rebooked'} Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${tenantName || 'Rebooked'}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    return this.sendEmail({
      to: leadEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Send appointment confirmation email
   */
  static async sendAppointmentConfirmation(
    leadName: string,
    leadEmail: string,
    appointmentDate: Date,
    tenantName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const formattedDate = appointmentDate.toLocaleString();
    const subject = 'Appointment Confirmation';
    const text = `Hi ${leadName},

This is a confirmation of your appointment scheduled for:

${formattedDate}

We look forward to speaking with you!

Best regards,
The ${tenantName || 'Rebooked'} Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Appointment Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .appointment { 
            background: #f8f9fa; 
            border-left: 4px solid #007bff; 
            padding: 15px; 
            margin: 20px 0; 
        }
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Appointment Confirmation</h1>
        </div>
        <div class="content">
            <p>Hi ${leadName},</p>
            <p>This is a confirmation of your appointment:</p>
            <div class="appointment">
                <strong>${formattedDate}</strong>
            </div>
            <p>We look forward to speaking with you!</p>
            <p>Best regards,<br>The ${tenantName || 'Rebooked'} Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${tenantName || 'Rebooked'}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    return this.sendEmail({
      to: leadEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Send follow-up email
   */
  static async sendFollowUpEmail(
    leadName: string,
    leadEmail: string,
    message: string,
    tenantName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const subject = 'Following Up';
    const text = `Hi ${leadName},

${message}

Best regards,
The ${tenantName || 'Rebooked'} Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Following Up</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .message { 
            background: #f8f9fa; 
            border-left: 4px solid #28a745; 
            padding: 15px; 
            margin: 20px 0; 
            white-space: pre-wrap;
        }
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Following Up</h1>
        </div>
        <div class="content">
            <p>Hi ${leadName},</p>
            <div class="message">${message}</div>
            <p>Best regards,<br>The ${tenantName || 'Rebooked'} Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${tenantName || 'Rebooked'}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    return this.sendEmail({
      to: leadEmail,
      subject,
      text,
      html,
    });
  }
}
