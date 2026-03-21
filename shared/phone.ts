/**
 * Shared E.164 normalization (no Node crypto). Used by Zod schemas and client validation.
 * Uses libphonenumber-js — `defaultRegion` is ISO 3166-1 alpha-2 (e.g. US, GB) for numbers without a country code.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

function asCountry(code: string): CountryCode {
  const c = code.trim().toUpperCase();
  return (c.length === 2 ? c : "US") as CountryCode;
}

export function normalizePhoneE164(input: string, defaultRegion: string = "US"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const region = asCountry(defaultRegion);
    const parsed = trimmed.startsWith("+")
      ? parsePhoneNumberFromString(trimmed)
      : parsePhoneNumberFromString(trimmed, region);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.format("E.164");
  } catch {
    return null;
  }
}