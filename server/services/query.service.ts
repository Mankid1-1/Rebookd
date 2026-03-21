import { logger } from "../_core/logger";

export async function withQueryTimeout<T>(
  label: string,
  work: Promise<T>,
  timeoutMs = parseInt(process.env.DB_QUERY_TIMEOUT_MS || "5000", 10),
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } catch (error) {
    logger.warn("Query timeout or failure", { label, error: String(error) });
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
