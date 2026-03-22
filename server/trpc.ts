// Re-export trpc configuration
export { createRouter as router, publicProcedure, protectedProcedure, tenantProcedure, adminProcedure, appRouter } from './_core/trpc';
export type { TrpcContext } from './_core/context';
