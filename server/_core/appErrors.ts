export type AppErrorCode =
  | "RATE_LIMITED"
  | "USAGE_CAP_EXCEEDED"
  | "LLM_TIMEOUT"
  | "LLM_CIRCUIT_OPEN"
  | "LLM_UPSTREAM_ERROR"
  | "PHONE_INVALID";

export class AppError extends Error {
  code: AppErrorCode;
  statusCode: number;
  retryable: boolean;

  constructor(code: AppErrorCode, message: string, statusCode = 400, retryable = false) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
