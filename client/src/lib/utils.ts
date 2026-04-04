import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatCurrency as formatCurrencyI18n, getStoredCurrency } from "@/utils/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency?: string): string {
  return formatCurrencyI18n(amount, (currency ?? getStoredCurrency()) as any);
}
