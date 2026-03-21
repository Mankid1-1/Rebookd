import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

type RequestContextValue = {
  correlationId: string;
};

const storage = new AsyncLocalStorage<RequestContextValue>();

export function runWithCorrelationId<T>(correlationId: string | undefined, fn: () => T): T {
  return storage.run({ correlationId: correlationId || randomUUID() }, fn);
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function ensureCorrelationId(existing?: string): string {
  return existing || getCorrelationId() || randomUUID();
}
