// Secure localStorage utilities with encryption
// This provides encrypted storage for sensitive data to prevent XSS attacks

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY || (() => {
  if (import.meta.env.MODE === 'production') {
    throw new Error('VITE_STORAGE_ENCRYPTION_KEY is not set in production');
  }
  return 'default-key-change-in-production';
})();

interface StorageItem<T = any> {
  value: T;
  timestamp: number;
  encrypted: boolean;
}

/**
 * Encrypts data before storing in localStorage
 */
export function setSecureItem<T>(key: string, value: T): void {
  try {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(value), ENCRYPTION_KEY).toString();
    const item: StorageItem<T> = {
      value: encrypted as any,
      timestamp: Date.now(),
      encrypted: true
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error('Failed to set secure item:', error);
    // Fallback to unencrypted storage
    localStorage.setItem(key, JSON.stringify({
      value,
      timestamp: Date.now(),
      encrypted: false
    }));
  }
}

/**
 * Decrypts data when retrieving from localStorage
 */
export function getSecureItem<T>(key: string, defaultValue?: T): T | null {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return defaultValue || null;
    
    const item: StorageItem<T> = JSON.parse(itemStr);
    
    if (!item.encrypted) {
      return item.value;
    }
    
    const decrypted = CryptoJS.AES.decrypt(item.value as string, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to get secure item:', error);
    return defaultValue || null;
  }
}

/**
 * Removes item from localStorage
 */
export function removeSecureItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Clears all secure storage
 */
export function clearSecureStorage(): void {
  Object.keys(localStorage).forEach(key => {
    const itemStr = localStorage.getItem(key);
    if (itemStr) {
      try {
        const item = JSON.parse(itemStr);
        if (item.encrypted) {
          localStorage.removeItem(key);
        }
      } catch {
        // Remove if we can't parse
        localStorage.removeItem(key);
      }
    }
  });
}

/**
 * Checks if item exists and is not expired (24 hours)
 */
export function isSecureItemValid(key: string): boolean {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return false;
    
    const item: StorageItem = JSON.parse(itemStr);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return (now - item.timestamp) < maxAge;
  } catch {
    return false;
  }
}

// Non-secure utilities for non-sensitive data
export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to set item:', error);
  }
}

export function getItem<T>(key: string, defaultValue?: T): T | null {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return defaultValue || null;
    return JSON.parse(itemStr);
  } catch (error) {
    console.error('Failed to get item:', error);
    return defaultValue || null;
  }
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

export function clearStorage(): void {
  localStorage.clear();
}
