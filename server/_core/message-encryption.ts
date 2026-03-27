/**
 * Message Encryption Service
 * 
 * Provides secure encryption for message bodies and sensitive data
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
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly key: Buffer;

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Derive a 32-byte key from the environment key
    this.key = crypto.scryptSync(encryptionKey, 'salt', this.keyLength);
  }

  /**
   * Encrypt message body
   */
  encrypt(message: string): EncryptionResult {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      cipher.setAAD(Buffer.from('message-body', 'utf8'));

      // Encrypt the message
      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
      
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error(`Failed to encrypt message: ${error.message}`);
    }
  }

  /**
   * Decrypt message body
   */
  decrypt(encryptedData: EncryptionResult): DecryptionResult {
    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(encryptedData.iv, 'hex'));

      // Set authentication tag
      decipher.setAAD(Buffer.from('message-body', 'utf8'));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
      
      // Decrypt the message
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        decrypted,
        success: true
      };
      
    } catch (error) {
      console.error('Decryption error:', error);
      return {
        decrypted: '',
        success: false
      };
    }
  }

  /**
   * Encrypt phone number (for storage)
   */
  encryptPhoneNumber(phone: string): string {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
      let encrypted = cipher.update(normalizedPhone, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
      
    } catch (error) {
      console.error('Phone encryption error:', error);
      throw new Error(`Failed to encrypt phone: ${error.message}`);
    }
  }

  /**
   * Decrypt phone number
   */
  decryptPhoneNumber(encryptedPhone: string): string {
    try {
      const parts = encryptedPhone.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted phone format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('Phone decryption error:', error);
      throw new Error(`Failed to decrypt phone: ${error.message}`);
    }
  }

  /**
   * Hash sensitive data for comparison
   */
  hashSensitiveData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data + process.env.HASH_SALT || 'default-salt')
      .digest('hex');
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Verify data integrity
   */
  verifyIntegrity(data: string, hash: string): boolean {
    const computedHash = this.hashSensitiveData(data);
    return computedHash === hash;
  }

  /**
   * Normalize phone number format
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Ensure it starts with country code (default to US)
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length > 10 && !digits.startsWith('+')) {
      return `+${digits}`;
    }
    
    return digits.startsWith('+') ? digits : `+${digits}`;
  }

  /**
   * Check if encryption key is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 16;
  }

  /**
   * Rotate encryption key (for security maintenance)
   */
  rotateKey(newKey: string): void {
    process.env.ENCRYPTION_KEY = newKey;
    // Re-derive the key
    const newDerivedKey = crypto.scryptSync(newKey, 'salt', this.keyLength);
    (this as any).key = newDerivedKey;
    console.log('🔑 Encryption key rotated successfully');
  }
}

// Global instance
const messageEncryption = new MessageEncryption();

export { messageEncryption, MessageEncryption };

// Utility functions for easy import
export const encryptMessage = (message: string) => messageEncryption.encrypt(message);
export const decryptMessage = (data: any) => messageEncryption.decrypt(data);
export const encryptPhone = (phone: string) => messageEncryption.encryptPhoneNumber(phone);
export const decryptPhone = (encryptedPhone: string) => messageEncryption.decryptPhoneNumber(encryptedPhone);
export const generateSecureToken = (length?: number) => messageEncryption.generateSecureToken(length);
