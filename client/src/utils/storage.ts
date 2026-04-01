// localStorage utilities for UI/preference state.
// Note: localStorage is NOT suitable for storing sensitive data (auth tokens,
// PII, secrets). Auth sessions are managed via httpOnly cookies server-side.

interface StorageItem<T = any> {
  value: T;
  timestamp: number;
  encrypted: boolean;
}

/**
 * Stores an item in localStorage with a timestamp.
 * Use this for non-sensitive UI state (preferences, feature flags, etc.).
 */
export function setSecureItem<T>(key: string, value: T): void {
  try {
    const item: StorageItem<T> = {
      value,
      timestamp: Date.now(),
      encrypted: false,
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error('Failed to set item:', error);
  }
}

/**
 * Retrieves a timestamped item from localStorage.
 */
export function getSecureItem<T>(key: string, defaultValue?: T): T | null {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return defaultValue ?? null;

    const item: StorageItem<T> = JSON.parse(itemStr);
    return item.value;
  } catch (error) {
    console.error('Failed to get item:', error);
    return defaultValue ?? null;
  }
}

/**
 * Removes item from localStorage.
 */
export function removeSecureItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Clears all items that were written by setSecureItem.
 */
export function clearSecureStorage(): void {
  Object.keys(localStorage).forEach(key => {
    const itemStr = localStorage.getItem(key);
    if (itemStr) {
      try {
        const item = JSON.parse(itemStr);
        if ('timestamp' in item) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  });
}

/**
 * Checks if item exists and was written within the last 24 hours.
 */
export function isSecureItemValid(key: string): boolean {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return false;

    const item: StorageItem = JSON.parse(itemStr);
    const maxAge = 24 * 60 * 60 * 1000;
    return (Date.now() - item.timestamp) < maxAge;
  } catch {
    return false;
  }
}

// Non-timestamped utilities for simple values
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
    if (!itemStr) return defaultValue ?? null;
    return JSON.parse(itemStr);
  } catch (error) {
    console.error('Failed to get item:', error);
    return defaultValue ?? null;
  }
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

export function clearStorage(): void {
  localStorage.clear();
}
