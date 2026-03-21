/**
 * POP3 Email Integration for Rebooked
 * 
 * Handles incoming email processing from mail.rebooked.org
 * Supports multiple email accounts and automated processing
 */

import poplib from 'poplib';
import { simpleParser } from 'mailparser';
import { logger } from './logger';
import type { Db } from './context';

type POP3Client = InstanceType<typeof poplib.POP3Client>;

export interface POP3Config {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  date: Date;
  messageId: string;
  headers: Record<string, string>;
}

export interface POP3Result {
  success: boolean;
  error?: string;
  messagesProcessed?: number;
}

/**
 * Connect to POP3 server and retrieve emails
 */
export async function connectPOP3(config: POP3Config): Promise<POP3Client> {
  return new Promise((resolve, reject) => {
    const client = new POP3Client(config.port, config.host, {
      tls: config.tls,
    });

    client.on('connect', () => {
      logger.info('POP3 connected', { host: config.host, port: config.port });
      
      client.login(config.user, config.password, (err: any) => {
        if (err) {
          logger.error('POP3 login failed', { error: err.message, user: config.user });
          reject(err);
        } else {
          logger.info('POP3 login successful', { user: config.user });
          resolve(client);
        }
      });
    });

    client.on('error', (err: any) => {
      logger.error('POP3 connection error', { error: err.message });
      reject(err);
    });

    // Start connection
    client.connect();
  });
}

/**
 * Retrieve all emails from POP3 server
 */
export async function retrieveEmails(client: POP3Client): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    client.stat((err: any, stats: any) => {
      if (err) {
        logger.error('POP3 stat failed', { error: err.message });
        reject(err);
        return;
      }

      const messageCount = stats.count;
      logger.info('POP3 messages found', { count: messageCount });

      if (messageCount === 0) {
        resolve([]);
        return;
      }

      const messages: EmailMessage[] = [];
      let processedCount = 0;

      // Retrieve each message
      for (let i = 1; i <= messageCount; i++) {
        client.retr(i, (err: any, data: any) => {
          if (err) {
            logger.error('POP3 retr failed', { error: err.message, messageNumber: i });
            processedCount++;
            if (processedCount === messageCount) {
              resolve(messages);
            }
            return;
          }

          // Parse email
          simpleParser(Buffer.from(data), (parseErr: any, parsed: any) => {
            if (parseErr) {
              logger.error('Email parse failed', { error: parseErr.message, messageNumber: i });
            } else {
              const message: EmailMessage = {
                from: parsed.from?.text || '',
                to: parsed.to?.text || '',
                subject: parsed.subject || '',
                text: parsed.text || '',
                html: parsed.html || undefined,
                date: parsed.date || new Date(),
                messageId: parsed.messageId || '',
                headers: parsed.headers as Record<string, string>,
              };
              messages.push(message);
            }

            processedCount++;
            if (processedCount === messageCount) {
              resolve(messages);
            }
          });
        });
      }
    });
  });
}

/**
 * Delete processed emails from server
 */
export async function deleteEmails(client: POP3Client, messageCount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let deletedCount = 0;

    for (let i = 1; i <= messageCount; i++) {
      client.dele(i, (err: any) => {
        if (err) {
          logger.error('POP3 delete failed', { error: err.message, messageNumber: i });
        }

        deletedCount++;
        if (deletedCount === messageCount) {
          client.quit(() => {
            logger.info('POP3 session ended', { deletedCount });
            resolve();
          });
        }
      });
    }
  });
}

/**
 * Process incoming emails for lead creation
 */
export async function processIncomingEmails(db: Db, emails: EmailMessage[]): Promise<void> {
  for (const email of emails) {
    try {
      // Extract phone number from email body or subject
      const phoneNumber = extractPhoneNumber(email);
      
      if (phoneNumber) {
        // Check if lead already exists
        const existingLead = await db
          .select()
          .from(require('../drizzle/schema').leads)
          .where(
            require('drizzle-orm').eq(
              require('../drizzle/schema').leads.phone,
              phoneNumber
            )
          )
          .limit(1);

        if (existingLead.length === 0) {
          // Create new lead from email
          await db.insert(require('../drizzle/schema').leads).values({
            phone: phoneNumber,
            name: extractNameFromEmail(email),
            email: email.from,
            tenantId: 1, // Default tenant - you may want to configure this
            status: 'new',
            source: 'email',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          logger.info('Lead created from email', {
            phone: phoneNumber,
            email: email.from,
            subject: email.subject,
          });

          // Log the communication
          await db.insert(require('../drizzle/schema').messages).values({
            leadId: null, // Will be updated with actual lead ID
            tenantId: 1,
            direction: 'inbound',
            body: email.text,
            subject: email.subject,
            fromEmail: email.from,
            toEmail: email.to,
            createdAt: email.date,
            updatedAt: new Date(),
          });

          logger.info('Email communication logged', {
            from: email.from,
            to: email.to,
            subject: email.subject,
          });
        } else {
          logger.info('Lead already exists', {
            phone: phoneNumber,
            existingLeadId: existingLead[0].id,
          });

          // Log communication to existing lead
          await db.insert(require('../drizzle/schema').messages).values({
            leadId: existingLead[0].id,
            tenantId: existingLead[0].tenantId,
            direction: 'inbound',
            body: email.text,
            subject: email.subject,
            fromEmail: email.from,
            toEmail: email.to,
            createdAt: email.date,
            updatedAt: new Date(),
          });
        }
      } else {
        logger.warn('No phone number found in email', {
          from: email.from,
          subject: email.subject,
        });
      }
    } catch (error) {
      logger.error('Failed to process email', {
        error: String(error),
        messageId: email.messageId,
      });
    }
  }
}

/**
 * Extract phone number from email content
 */
function extractPhoneNumber(email: EmailMessage): string | null {
  const text = `${email.subject} ${email.text}`;
  
  // Phone number patterns
  const patterns = [
    /(\+?1[\s-]?)?\(?(\d{3})\)?[\s-]?(\d{3})[\s-]?(\d{4})/g, // US format
    /(\+44[\s-]?)?(\d{4})[\s-]?(\d{3})[\s-]?(\d{3})/g, // UK format
    /(\+\d{1,3}[\s-]?)?\(?(\d{1,4})\)?[\s-]?(\d{1,4})[\s-]?(\d{1,4})[\s-]?(\d{1,9})/g, // International
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      // Return the first valid match, normalized
      const match = matches[0].replace(/[^\d+]/g, '');
      if (match.length >= 10) {
        return match.startsWith('+') ? match : `+1${match}`;
      }
    }
  }

  return null;
}

/**
 * Extract name from email
 */
function extractNameFromEmail(email: EmailMessage): string {
  // Try to extract name from email headers
  if (email.headers.from) {
    const nameMatch = email.headers.from.match(/^(.+?)\s+</);
    if (nameMatch) {
      return nameMatch[1].replace(/['"]/g, '').trim();
    }
  }

  // Try to extract from subject
  if (email.subject) {
    const subjectNameMatch = email.subject.match(/^(.+?)(?:\s+[-:]\s+.*)?$/);
    if (subjectNameMatch && subjectNameMatch[1].length > 2) {
      return subjectNameMatch[1].trim();
    }
  }

  // Fallback to email address
  const emailMatch = email.from.match(/([^@]+)@/);
  return emailMatch ? emailMatch[1] : 'Unknown';
}

/**
 * Main function to check and process emails
 */
export async function checkAndProcessEmails(db: Db): Promise<POP3Result> {
  const config: POP3Config = {
    host: process.env.POP3_HOST || 'mail.rebooked.org',
    port: parseInt(process.env.POP3_PORT || '995', 10),
    user: process.env.POP3_USER || '',
    password: process.env.POP3_PASSWORD || '',
    tls: process.env.POP3_TLS !== 'false',
  };

  if (!config.user || !config.password) {
    return { success: false, error: 'POP3 credentials not configured' };
  }

  try {
    // Connect to POP3 server
    const client = await connectPOP3(config);

    // Retrieve emails
    const emails = await retrieveEmails(client);
    
    if (emails.length > 0) {
      // Process emails
      await processIncomingEmails(db, emails);
      
      // Delete processed emails
      await deleteEmails(client, emails.length);
      
      logger.info('Email processing completed', {
        count: emails.length,
        host: config.host,
      });
    }

    return { 
      success: true, 
      messagesProcessed: emails.length 
    };
  } catch (error) {
    logger.error('Email processing failed', { error: String(error) });
    return { 
      success: false, 
      error: String(error) 
    };
  }
}

/**
 * Test POP3 connection
 */
export async function testPOP3Connection(): Promise<{ success: boolean; error?: string }> {
  const config: POP3Config = {
    host: process.env.POP3_HOST || 'mail.rebooked.org',
    port: parseInt(process.env.POP3_PORT || '995', 10),
    user: process.env.POP3_USER || '',
    password: process.env.POP3_PASSWORD || '',
    tls: process.env.POP3_TLS !== 'false',
  };

  if (!config.user || !config.password) {
    return { success: false, error: 'POP3 credentials not configured' };
  }

  try {
    const client = await connectPOP3(config);
    
    // Test stat command
    return new Promise((resolve) => {
      client.stat((err: any, stats: any) => {
        client.quit(() => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    });
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
