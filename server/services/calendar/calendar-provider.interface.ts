/**
 * Calendar Provider Interface
 *
 * All calendar integrations implement this interface for consistent
 * OAuth, event fetching, and sync behavior.
 */

export interface CalendarProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface ExternalCalendarEvent {
  externalEventId: string;
  title: string | null;
  startTime: Date;
  endTime: Date;
  status: "confirmed" | "cancelled" | "tentative";
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface CalendarAuthResult {
  accessToken: string;
  refreshToken: string | null;
  externalCalendarId: string;
  externalAccountId: string;
  label: string;
  tokenExpiresAt: Date | null;
  metadata?: Record<string, unknown>;
}

export interface CalendarProvider {
  readonly providerName: "google" | "outlook" | "caldav" | "calendly" | "acuity";

  /** Build the OAuth authorization URL */
  getAuthUrl(state: string): string;

  /** Exchange auth code for tokens */
  handleCallback(code: string): Promise<CalendarAuthResult>;

  /** Fetch events from the external calendar */
  fetchEvents(
    accessToken: string,
    calendarId: string,
    since?: Date,
    until?: Date
  ): Promise<ExternalCalendarEvent[]>;

  /** Refresh an expired access token */
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: Date | null;
  }>;

  /** Disconnect / revoke access */
  revokeAccess(accessToken: string): Promise<void>;
}
