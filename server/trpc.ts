// Re-export trpc configuration
export { createRouter as router, createRouter, publicProcedure, protectedProcedure, tenantProcedure, adminProcedure } from './_core/trpc';
export type { TrpcContext } from './_core/context';
