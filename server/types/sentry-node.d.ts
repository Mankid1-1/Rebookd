/**
 * Optional dependency — @sentry/node may not be installed.
 * Runtime code catches missing module; this satisfies tsc.
 */
declare module "@sentry/node" {
  export function init(options: Record<string, unknown>): void;
  export function withScope(callback: (scope: { setExtras: (extras: Record<string, unknown>) => void }) => void): void;
  export function captureException(exception: unknown): string;
}
