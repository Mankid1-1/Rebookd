/**
 * Contact Import Router
 *
 * tRPC procedures for importing contacts from vCard files,
 * Google Contacts, and CSV.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../_core/trpc";
import { parseVCard } from "../services/contacts/vcard-import.service";
import { fetchAllGoogleContacts } from "../services/contacts/google-contacts.service";
import * as ContactImportService from "../services/contacts/contact-import.service";
import { calendarConnections } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const contactSchema = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  source: z.enum(["vcard", "google_contacts", "csv"]).default("vcard"),
});

export const contactImportRouter = router({
  /** Parse a vCard file and return preview */
  parseVcard: tenantProcedure
    .input(z.object({ vcfContent: z.string().max(10_000_000) }))
    .mutation(async ({ input, ctx }) => {
      const contacts = parseVCard(input.vcfContent);
      if (contacts.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No valid contacts found in file" });
      }
      const preview = await ContactImportService.previewImport(ctx.db, ctx.tenantId, contacts);
      return {
        contacts,
        preview: {
          total: preview.total,
          new: preview.newContacts.length,
          duplicates: preview.duplicates.length,
          skipped: preview.skipped.length,
        },
      };
    }),

  /** Fetch contacts from Google (uses existing Google calendar OAuth tokens) */
  fetchGoogleContacts: tenantProcedure.mutation(async ({ ctx }) => {
    // Find the Google calendar connection to reuse its OAuth token
    const [googleConn] = await ctx.db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.tenantId, ctx.tenantId),
          eq(calendarConnections.provider, "google")
        )
      )
      .limit(1);

    if (!googleConn || !googleConn.accessToken) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Connect Google Calendar first to sync contacts (uses same Google account)",
      });
    }

    const contacts = await fetchAllGoogleContacts(googleConn.accessToken);
    const preview = await ContactImportService.previewImport(ctx.db, ctx.tenantId, contacts);

    return {
      contacts,
      preview: {
        total: preview.total,
        new: preview.newContacts.length,
        duplicates: preview.duplicates.length,
        skipped: preview.skipped.length,
      },
    };
  }),

  /** Preview import with dedup analysis */
  preview: tenantProcedure
    .input(z.object({ contacts: z.array(contactSchema) }))
    .mutation(async ({ input, ctx }) => {
      const preview = await ContactImportService.previewImport(
        ctx.db,
        ctx.tenantId,
        input.contacts as any
      );
      return {
        total: preview.total,
        new: preview.newContacts.length,
        duplicates: preview.duplicates.length,
        skipped: preview.skipped.length,
        duplicateDetails: preview.duplicates.map((d) => ({
          name: d.name,
          phone: d.phone,
          email: d.email,
          existingLeadId: d.existingLeadId,
        })),
      };
    }),

  /** Execute the import */
  execute: tenantProcedure
    .input(z.object({
      contacts: z.array(contactSchema),
      mode: z.enum(["skip_duplicates", "merge_info", "overwrite"]).default("skip_duplicates"),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await ContactImportService.executeImport(
        ctx.db,
        ctx.tenantId,
        input.contacts as any,
        { mode: input.mode }
      );
      return result;
    }),

  /** Get import history */
  history: tenantProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input, ctx }) => {
      return ContactImportService.getImportHistory(ctx.db, ctx.tenantId, input?.limit);
    }),
});
