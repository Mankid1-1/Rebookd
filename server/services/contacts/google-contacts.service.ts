/**
 * Google Contacts Service
 *
 * Fetches contacts via Google People API, reusing Google OAuth tokens
 * from the calendar provider (contacts.readonly scope).
 */

import type { ParsedContact } from "./vcard-import.service";

const PEOPLE_API = "https://people.googleapis.com/v1";

export interface GoogleContactsResult {
  contacts: ParsedContact[];
  nextPageToken?: string;
  totalItems: number;
}

/**
 * Fetch contacts from Google People API using an OAuth access token.
 * The token must have the `contacts.readonly` scope.
 */
export async function fetchGoogleContacts(
  accessToken: string,
  pageToken?: string,
  pageSize: number = 100
): Promise<GoogleContactsResult> {
  const params = new URLSearchParams({
    personFields: "names,emailAddresses,phoneNumbers,addresses",
    pageSize: String(Math.min(pageSize, 1000)),
    sortOrder: "LAST_MODIFIED_DESCENDING",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${PEOPLE_API}/people/me/connections?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google People API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    connections?: Array<{
      names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>;
      emailAddresses?: Array<{ value: string }>;
      phoneNumbers?: Array<{ canonicalForm?: string; value: string }>;
      addresses?: Array<{ formattedValue?: string }>;
    }>;
    nextPageToken?: string;
    totalPeople?: number;
    totalItems?: number;
  };

  const contacts: ParsedContact[] = (data.connections || []).map((person) => {
    const name =
      person.names?.[0]?.displayName ||
      [person.names?.[0]?.givenName, person.names?.[0]?.familyName].filter(Boolean).join(" ") ||
      null;

    const phone = normalizePhone(
      person.phoneNumbers?.[0]?.canonicalForm || person.phoneNumbers?.[0]?.value || null
    );

    const email = person.emailAddresses?.[0]?.value || null;
    const address = person.addresses?.[0]?.formattedValue || null;

    return { name, phone, email, address, notes: null, source: "vcard" as const };
  });

  // Filter out contacts with no phone and no email
  const validContacts = contacts.filter((c) => c.phone || c.email);

  return {
    contacts: validContacts,
    nextPageToken: data.nextPageToken,
    totalItems: data.totalItems || data.totalPeople || validContacts.length,
  };
}

/**
 * Fetch ALL contacts (paginated) from Google.
 */
export async function fetchAllGoogleContacts(accessToken: string): Promise<ParsedContact[]> {
  const allContacts: ParsedContact[] = [];
  let pageToken: string | undefined;

  do {
    const result = await fetchGoogleContacts(accessToken, pageToken, 500);
    allContacts.push(...result.contacts);
    pageToken = result.nextPageToken;
  } while (pageToken);

  return allContacts;
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.length === 10) cleaned = `+1${cleaned}`;
  else if (cleaned.length === 11 && cleaned.startsWith("1")) cleaned = `+${cleaned}`;
  else if (!cleaned.startsWith("+")) cleaned = `+${cleaned}`;
  if (cleaned.replace(/\D/g, "").length < 10) return null;
  return cleaned;
}
