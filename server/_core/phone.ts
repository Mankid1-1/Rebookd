import { createHash } from "crypto";
import { normalizePhoneE164 } from "../../shared/phone";
import { AppError } from "./appErrors";

const DEFAULT_REGION = (process.env.PHONE_DEFAULT_REGION || "US").trim() || "US";

export function normalizePhoneNumber(input: string): string {
  const normalized = normalizePhoneE164(input, DEFAULT_REGION);
  if (!normalized) {
    throw new AppError("PHONE_INVALID", "Phone must be in E.164 format (e.g. +15550001234)", 400);
  }
  return normalized;
}

export function hashPhoneNumber(normalizedPhone: string): string {
  return createHash("sha256").update(normalizedPhone).digest("hex");
}
