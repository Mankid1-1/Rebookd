/**
 * Structured logger — emits JSON in production, pretty-prints in dev.
 * Drop-in replacement for console.log/error/warn.
 *
 * Usage:
 *   import { logger } from "./_core/logger";
 *   logger.info("SMS sent", { to, provider, sid });
 *   logger.error("Automation failed", { automationId, error });
 */

import { getCorrelationId } from "./requestContext";

type Level = "debug" | "info" | "warn" | "error";
type Meta = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";

function emit(level: Level, message: string, meta?: Meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    correlationId: getCorrelationId(),
    ...meta,
  };

  if (isProd) {
    // JSON lines — easy to ingest by Datadog, CloudWatch, Logtail, etc.
    const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + "\n");
  } else {
    const colors: Record<Level, string> = {
      debug: "\x1b[90m",
      info:  "\x1b[36m",
      warn:  "\x1b[33m",
      error: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`${prefix} ${message}${metaStr}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Meta) => emit("debug", msg, meta),
  info:  (msg: string, meta?: Meta) => emit("info",  msg, meta),
  warn:  (msg: string, meta?: Meta) => emit("warn",  msg, meta),
  error: (msg: string, meta?: Meta) => emit("error", msg, meta),
};
