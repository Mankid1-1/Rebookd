/**
 * Message Encryption Service
 *
 * Provides secure encryption for message bodies and sensitive data
 * Uses AES-256-GCM with proper IV and authenticated encryption
 * Prevents data leakage and ensures GDPR compliance
 */

import crypto from 'crypto';

interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
}

interface DecryptionResult {
  decrypted: string;
  success: boolean;
}

class MessageEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly cbcAlgorithm = 'aes-256-cbc';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly key: Buffer;

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Derive a 32-byte key from the environment key using scrypt
    this.key = crypto.scryptSync(encryptionKey, 'rebooked-encryption-salt-v2', this.keyLength);
  }

  /**
   * Encrypt message body using AES-256-GCM with authenticated encryption
   */
  encrypt(message: string): EncryptionResult {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv, {
        authTagLength: this.tagLength,
      });
      cipher.setAAD(Buffer.from('message-body', 'utf8'));

      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
    } catch (error: any) {
      console.error('Encryption error:', error);
      throw new Error(`Failed to encrypt message: ${error.message}`);
    }
  }

  /**
   * Decrypt message body using AES-256-GCM with authenticated encryption
   */
  decrypt(encryptedData: EncryptionResult): DecryptionResult {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv, {
        authTagLength: this.tagLength,
      });
      decipher.setAAD(Buffer.from('message-body', 'utf8'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return { decrypted, success: true };
    } catch (error) {
      console.error('Decryption error:', error);
      return { decrypted: '', success: false };
    }
  }

  /**
   * Encrypt phone number using AES-256-CBC with proper IV
   */
  encryptPhoneNumber(phone: string): string {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      const iv = crypto.randomBytes(this.ivLength);

      const cipher = crypto.createCipheriv(this.cbcAlgorithm, this.key, iv);
      let encrypted = cipher.update(normalizedPhone, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error: any) {
      console.error('Phone encryption error:', error);
      throw new Error(`Failed to encrypt phone: ${error.message}`);
    }
  }

  /**
   * Decrypt phone number using AES-256-CBC with proper IV
   */
  decryptPhoneNumber(encryptedPhone: string): string {
    try {
      const parts = encryptedPhone.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted phone format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(this.cbcAlgorithm, this.key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      console.error('Phone decryption error:', error);
      throw new Error(`Failed to decrypt phone: ${error.message}`);
    }
  }

  /**
   * Hash sensitive data for comparison (one-way)
   */
  hashSensitiveData(data: string): string {
    return crypto
      .createHmac('sha256', this.key)
      .update(data)
      .digest('hex');
  }

  /**
   * Normalize phone number format
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[^+\d]/g, '');
  }
}

// Singleton wrapper with lazy initialization and isConfigured() check
class MessageEncryptionProxy {
  private _instance: MessageEncryption | null = null;
  private _configured: boolean | null = null;

  isConfigured(): boolean {
    if (this._configured !== null) return this._configured;
    try {
      this._getInstance();
      this._configured = true;
    } catch {
      this._configured = false;
    }
    return this._configured;
  }

  private _getInstance(): MessageEncryption {
    if (!this._instance) {
      this._instance = new MessageEncryption();
    }
    return this._instance;
  }

  encrypt(message: string): EncryptionResult {
    return this._getInstance().encrypt(message);
  }

  decrypt(encryptedData: EncryptionResult): DecryptionResult {
    return this._getInstance().decrypt(encryptedData);
  }

  encryptPhoneNumber(phone: string): string {
    return this._getInstance().encryptPhoneNumber(phone);
  }

  decryptPhoneNumber(encryptedPhone: string): string {
    return this._getInstance().decryptPhoneNumber(encryptedPhone);
  }

  hashSensitiveData(data: string): string {
    return this._getInstance().hashSensitiveData(data);
  }
}

/** Singleton instance with isConfigured() check */
export const messageEncryption = new MessageEncryptionProxy();

/** Convenience: encrypt a message string */
export function encryptMessage(message: string): EncryptionResult {
  return messageEncryption.encrypt(message);
}

/** Convenience: decrypt a message */
export function decryptMessage(encryptedData: EncryptionResult): DecryptionResult {
  return messageEncryption.decrypt(encryptedData);
}

export function getMessageEncryption(): MessageEncryptionProxy {
  return messageEncryption;
}

export { MessageEncryption };
export type { EncryptionResult, DecryptionResult };
