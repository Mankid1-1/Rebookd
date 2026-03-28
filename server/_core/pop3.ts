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

type POP3Client = any;

const POP3_TIMEOUT_MS = 30_000; // 30 second timeout for all POP3 operations

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

/** Wrap a promise with a timeout to prevent indefinite hangs */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Connect to POP3 server and retrieve emails
 */
export async function connectPOP3(config: POP3Config): Promise<POP3Client> {
  return withTimeout(new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

    const client = new (poplib as any).POP3Client(config.port, config.host, {
      tls: config.tls,
    });

    client.on('connect', () => {
      logger.info('POP3 connected', { host: config.host, port: config.port });

      client.login(config.user, config.password, (err: any) => {
        if (err) {
          logger.error('POP3 login failed', { error: err.message, user: config.user });
          settle(() => reject(err));
        } else {
          logger.info('POP3 login successful', { user: config.user });
          settle(() => resolve(client));
        }
      });
    });

    client.on('error', (err: any) => {
      logger.error('POP3 connection error', { error: err.message });
      settle(() => reject(err));
    });

    // Start connection
    client.connect();
  }), POP3_TIMEOUT_MS, 'POP3 connect');
}

/**
 * Retrieve all emails from POP3 server
 */
export async function retrieveEmails(client: POP3Client): Promise<EmailMessage[]> {
  return withTimeout(new Promise((resolve, reject) => {
    let settled = false;

    client.stat((err: any, stats: any) => {
      if (err) {
        logger.error('POP3 stat failed', { error: err.message });
        if (!settled) { settled = true; reject(err); }
        return;
      }

      const messageCount = stats.count;
      logger.info('POP3 messages found', { count: messageCount });

      if (messageCount === 0) {
        if (!settled) { settled = true; resolve([]); }
        return;
      }

      const messages: EmailMessage[] = [];
      let processedCount = 0;

      const checkDone = () => {
        processedCount++;
        if (processedCount === messageCount && !settled) {
          settled = true;
          resolve(messages);
        }
      };

      // Retrieve each message
      for (let i = 1; i <= messageCount; i++) {
        client.retr(i, (err: any, data: any) => {
          if (err) {
            logger.error('POP3 retr failed', { error: err.message, messageNumber: i });
            checkDone();
            return;
          }

          // Parse email
          try {
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
              checkDone();
            });
          } catch (parseError) {
            logger.error('Email parse threw', { error: String(parseError), messageNumber: i });
            checkDone();
          }
        });
      }
    });
  }), POP3_TIMEOUT_MS * 2, 'POP3 retrieve');
}

/**
 * Delete processed emails from server
 */
export async function deleteEmails(client: POP3Client, messageCount: number): Promise<void> {
  if (messageCount === 0) return;

  return withTimeout(new Promise((resolve, reject) => {
    let deletedCount = 0;
    let settled = false;

    for (let i = 1; i <= messageCount; i++) {
      client.dele(i, (err: any) => {
        if (err) {
          logger.error('POP3 delete failed', { error: err.message, messageNumber: i });
        }

        deletedCount++;
        if (deletedCount === messageCount && !settled) {
          settled = true;
          try {
            client.quit(() => {
              logger.info('POP3 session ended', { deletedCount });
              resolve();
            });
          } catch {
            resolve(); // quit failed, but deletions succeeded
          }
        }
      });
    }
  }), POP3_TIMEOUT_MS, 'POP3 delete');
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
          .from(require('../../drizzle/schema').leads)
          .where(
            require('drizzle-orm').eq(
              require('../../drizzle/schema').leads.phone,
              phoneNumber
            )
          )
          .limit(1);

        if (existingLead.length === 0) {
          // Create new lead from email
          await db.insert(require('../../drizzle/schema').leads).values({
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
        } else {
          logger.info('Lead already exists', {
            phone: phoneNumber,
            existingLeadId: existingLead[0].id,
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
  if (email.headers?.from) {
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
    const client = await connectPOP3(config);
    const emails = await retrieveEmails(client);

    if (emails.length > 0) {
      await processIncomingEmails(db, emails);
      await deleteEmails(client, emails.length);

      logger.info('Email processing completed', {
        count: emails.length,
        host: config.host,
      });
    }

    return { success: true, messagesProcessed: emails.length };
  } catch (error) {
    logger.error('Email processing failed', { error: String(error) });
    return { success: false, error: String(error) };
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

    return withTimeout(new Promise((resolve) => {
      client.stat((err: any) => {
        try { client.quit(() => {}); } catch { /* ignore */ }
        resolve(err ? { success: false, error: err.message } : { success: true });
      });
    }), POP3_TIMEOUT_MS, 'POP3 test');
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
