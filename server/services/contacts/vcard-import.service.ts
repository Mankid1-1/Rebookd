/**
 * vCard Import Service
 *
 * Parses .vcf files (vCard 3.0/4.0) and extracts structured contact data.
 */

export interface ParsedContact {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  source: "vcard";
}

/**
 * Parse a vCard (.vcf) file string into structured contacts.
 * Supports vCard 3.0 and 4.0 formats, including multi-contact files.
 */
export function parseVCard(vcfContent: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const cards = vcfContent.split(/(?=BEGIN:VCARD)/i);

  for (const card of cards) {
    if (!card.trim() || !card.toUpperCase().includes("BEGIN:VCARD")) continue;

    // Unfold continued lines (RFC 2425: line starting with space/tab is continuation)
    const unfolded = card.replace(/\r?\n[ \t]/g, "");

    const name = extractVCardField(unfolded, "FN") || buildNameFromN(unfolded);
    const phone = normalizePhone(
      extractVCardField(unfolded, "TEL") || null
    );
    const email = extractVCardField(unfolded, "EMAIL") || null;
    const address = extractVCardField(unfolded, "ADR") || null;
    const notes = extractVCardField(unfolded, "NOTE") || null;

    // Skip contacts with no phone (required for SMS platform)
    if (!phone && !email) continue;

    contacts.push({ name, phone, email, address, notes, source: "vcard" });
  }

  return contacts;
}

/** Extract a vCard property value, handling parameters */
function extractVCardField(card: string, prop: string): string | null {
  // Match property with optional parameters: PROP;params:value or PROP:value
  const regex = new RegExp(`^${prop}[;:][^\\n]*$`, "mi");
  const match = card.match(regex);
  if (!match) return null;

  // Extract value after the colon
  const colonIdx = match[0].indexOf(":");
  if (colonIdx === -1) return null;

  const value = match[0]
    .slice(colonIdx + 1)
    .trim()
    .replace(/\\n/g, " ")
    .replace(/\\;/g, ";")
    .replace(/\\,/g, ",");

  return value || null;
}

/** Build display name from structured N property */
function buildNameFromN(card: string): string | null {
  const nField = extractVCardField(card, "N");
  if (!nField) return null;

  // N format: LastName;FirstName;MiddleName;Prefix;Suffix
  const parts = nField.split(";").map((p) => p.trim());
  const firstName = parts[1] || "";
  const lastName = parts[0] || "";
  const full = `${firstName} ${lastName}`.trim();
  return full || null;
}

/** Normalize phone number to E.164-ish format */
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;

  // Strip everything except digits and leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If no country code, assume US (+1)
  if (cleaned.length === 10) {
    cleaned = `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    cleaned = `+${cleaned}`;
  } else if (!cleaned.startsWith("+")) {
    cleaned = `+${cleaned}`;
  }

  // Basic validation: must be at least 10 digits
  if (cleaned.replace(/\D/g, "").length < 10) return null;

  return cleaned;
}
