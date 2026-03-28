/**
 * Build version — injected at build time by scripts/build.mjs.
 * At runtime this resolves to the actual build timestamp.
 * In development it returns "dev".
 */
export const BUILD_VERSION: string =
  (globalThis as any).__BUILD_VERSION__ ?? "dev";
