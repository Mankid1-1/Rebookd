import { z } from "zod";
import { protectedProcedure, tenantProcedure, router } from "../_core/trpc";
import * as TemplateService from "../services/template.service";

export const templatesRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => TemplateService.getTemplates(ctx.db, ctx.tenantId)),

  create: tenantProcedure
    .input(z.object({ key: z.string(), name: z.string(), body: z.string(), tone: z.enum(["friendly", "professional", "casual", "urgent"]).optional(), category: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await TemplateService.createTemplate(ctx.db, { ...input, tenantId: ctx.tenantId });
      return { success: true };
    }),

  update: tenantProcedure
    .input(z.object({ templateId: z.number(), name: z.string().optional(), body: z.string().optional(), tone: z.enum(["friendly", "professional", "casual", "urgent"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      await TemplateService.updateTemplate(ctx.db, ctx.tenantId, input.templateId, input);
      return { success: true };
    }),

  delete: tenantProcedure
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await TemplateService.deleteTemplate(ctx.db, ctx.tenantId, input.templateId);
      return { success: true };
    }),

  preview: protectedProcedure
    .input(z.object({ body: z.string(), tone: z.enum(["friendly", "professional", "casual", "urgent"]) }))
    .mutation(async ({ input }) => {
      const { rewriteMessage } = await import("../services/ai");
      const rewritten = await rewriteMessage(input.body, input.tone);
      return { rewritten };
    }),
});
