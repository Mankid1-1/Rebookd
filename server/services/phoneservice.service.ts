/**
 * HTTP client for the Phoneservice server API.
 * Used by Rebooked to manage devices, setup tokens, and tenant stats.
 */

import { ENV } from "../_core/env";
import { logger } from "../_core/logger";

const TIMEOUT_MS = 10_000;

export interface PhoneserviceDevice {
  id: number;
  tenantId: number;
  phoneNumber: string;
  label: string | null;
  status: "online" | "offline" | "error";
  lastSeenAt: string | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  appVersion: string | null;
  androidVersion: string | null;
  carrier: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetupTokenResult {
  token: string;
  expiresAt: string;
  qrData: string;
  serverUrl: string;
}

export interface TenantStats {
  devices: { total: number; online: number };
  messagesToday: { total: number; delivered: number; failed: number };
}

function getBaseUrl(): string {
  return ENV.phoneserviceUrl;
}

function getApiKey(): string {
  return ENV.phoneserviceApiKey;
}

function isConfigured(): boolean {
  return !!(ENV.phoneserviceUrl && ENV.phoneserviceApiKey);
}

async function phoneserviceFetch(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    const msg = error instanceof Error && error.name === "AbortError"
      ? `Phoneservice request timed out after ${TIMEOUT_MS}ms`
      : String(error);
    logger.warn("Phoneservice API call failed", { path, error: msg });
    return { ok: false, status: 0, data: { error: msg } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create a one-time setup token for QR-based device onboarding.
 */
export async function createSetupToken(tenantId: number): Promise<SetupTokenResult | null> {
  if (!isConfigured()) return null;

  const { ok, data } = await phoneserviceFetch("/api/setup/token", {
    method: "POST",
    body: JSON.stringify({ tenantId }),
  });

  if (!ok) {
    logger.warn("Failed to create setup token", { tenantId, error: data?.error });
    return null;
  }

  return data as SetupTokenResult;
}

/**
 * List all devices for a tenant.
 */
export async function listDevices(tenantId: number): Promise<PhoneserviceDevice[]> {
  if (!isConfigured()) return [];

  const { ok, data } = await phoneserviceFetch(`/api/admin/devices?tenantId=${tenantId}`);

  // The admin endpoint wraps in { devices: [...] } but currently listDevices returns all
  // We filter in the admin route via query param, but the response format is { devices, total }
  if (!ok) {
    logger.warn("Failed to list devices", { tenantId, error: data?.error });
    return [];
  }

  return (data?.devices || []) as PhoneserviceDevice[];
}

/**
 * Deactivate a device by ID, scoped to a tenant for ownership verification.
 */
export async function deactivateDevice(deviceId: number, tenantId: number): Promise<boolean> {
  if (!isConfigured()) return false;

  const { ok, data } = await phoneserviceFetch(`/api/admin/devices/${deviceId}/deactivate?tenantId=${tenantId}`, {
    method: "POST",
  });

  if (!ok) {
    logger.warn("Failed to deactivate device", { deviceId, tenantId, error: data?.error });
    return false;
  }

  return true;
}

/**
 * Get per-tenant device and message stats.
 */
export async function getTenantStats(tenantId: number): Promise<TenantStats | null> {
  if (!isConfigured()) return null;

  const { ok, data } = await phoneserviceFetch(`/api/admin/tenant/${tenantId}/stats`);

  if (!ok) {
    logger.warn("Failed to get tenant stats", { tenantId, error: data?.error });
    return null;
  }

  return data as TenantStats;
}
