/**
 * Phone number validation service.
 * Detects landlines, VoIP, and validates mobile numbers for SMS delivery.
 */

const NANP_LANDLINE_PREFIXES = new Set([
  // Known US/Canada landline area code patterns (non-exhaustive, common ones)
  // In production, use a lookup API like Twilio Lookup or NumVerify
]);

// Common VoIP provider number patterns
const VOIP_INDICATORS = [
  /^(\+1)?(500|521|522|533|544|566|577|588)/,  // US personal/follow-me numbers
  /^(\+1)?900/,                                   // Premium rate
];

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  type: "mobile" | "landline" | "voip" | "unknown";
  warnings: string[];
  canReceiveSms: boolean;
}

/**
 * Normalize a phone number to E.164 format.
 * Handles common US/international formats.
 */
export function normalizePhone(phone: string): string {
  // Strip all non-digit characters except leading +
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");

  if (!digits) return "";

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) return `+1${digits}`;

  // If it's 11 digits starting with 1, assume US
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // If it already had +, preserve it
  if (hasPlus) return `+${digits}`;

  // Otherwise return with + prefix
  return `+${digits}`;
}

/**
 * Validate a phone number for SMS delivery.
 */
export function validatePhone(phone: string): PhoneValidationResult {
  const normalized = normalizePhone(phone);
  const warnings: string[] = [];

  // Basic format check
  if (!normalized || normalized.length < 8) {
    return {
      valid: false,
      normalized,
      type: "unknown",
      warnings: ["Phone number is too short"],
      canReceiveSms: false,
    };
  }

  if (normalized.length > 16) {
    return {
      valid: false,
      normalized,
      type: "unknown",
      warnings: ["Phone number is too long"],
      canReceiveSms: false,
    };
  }

  // Check for VoIP patterns
  const isVoip = VOIP_INDICATORS.some((re) => re.test(normalized));
  if (isVoip) {
    warnings.push("This appears to be a VoIP number. SMS delivery may be unreliable.");
    return {
      valid: true,
      normalized,
      type: "voip",
      warnings,
      canReceiveSms: false,
    };
  }

  // Check for known non-SMS-capable patterns
  // Toll-free numbers (US)
  if (/^\+1(800|888|877|866|855|844|833)/.test(normalized)) {
    return {
      valid: false,
      normalized,
      type: "landline",
      warnings: ["Toll-free numbers cannot receive SMS"],
      canReceiveSms: false,
    };
  }

  // Emergency numbers
  if (/^\+1(911|411|611|711|811)$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      type: "unknown",
      warnings: ["This is a special service number"],
      canReceiveSms: false,
    };
  }

  // Standard mobile number - assume valid for SMS
  // In production, use Twilio Lookup API for carrier/type detection
  return {
    valid: true,
    normalized,
    type: "mobile",
    warnings,
    canReceiveSms: true,
  };
}

/**
 * Batch validate an array of phone numbers.
 * Returns results keyed by original phone.
 */
export function validatePhones(phones: string[]): Map<string, PhoneValidationResult> {
  const results = new Map<string, PhoneValidationResult>();
  for (const phone of phones) {
    results.set(phone, validatePhone(phone));
  }
  return results;
}

/**
 * Check if a phone number is a duplicate within a set.
 * Normalizes before comparing.
 */
export function findDuplicatePhones(phones: string[]): Set<string> {
  const seen = new Map<string, number>();
  const duplicates = new Set<string>();

  for (const phone of phones) {
    const normalized = normalizePhone(phone);
    const count = (seen.get(normalized) ?? 0) + 1;
    seen.set(normalized, count);
    if (count > 1) duplicates.add(phone);
  }

  return duplicates;
}
