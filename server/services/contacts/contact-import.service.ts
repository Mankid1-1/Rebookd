/**
 * Contact Import Orchestrator
 *
 * Handles previewing, deduplicating, and executing bulk imports from
 * vCard files or Google Contacts into the leads table.
 */

import { eq, and, sql } from "drizzle-orm";
import { contactImports, leads } from "../../../drizzle/schema";
import type { Db } from "../../_core/context";
import type { ParsedContact } from "./vcard-import.service";
import * as LeadService from "../lead.service";
import { emitEvent } from "../event-bus.service";

export interface ImportPreview {
  total: number;
  newContacts: ParsedContact[];
  duplicates: Array<ParsedContact & { existingLeadId: number }>;
  skipped: ParsedContact[];
}

export interface ImportOptions {
  mode: "skip_duplicates" | "merge_info" | "overwrite";
}

export interface ImportResult {
  importId: number;
  total: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Preview an import — deduplicate contacts against existing leads.
 */
export async function previewImport(
  db: Db,
  tenantId: number,
  contacts: ParsedContact[]
): Promise<ImportPreview> {
  const newContacts: ParsedContact[] = [];
  const duplicates: Array<ParsedContact & { existingLeadId: number }> = [];
  const skipped: ParsedContact[] = [];

  // Get existing leads for matching
  const existingLeads = await db
    .select({ id: leads.id, phone: leads.phone, email: leads.email })
    .from(leads)
    .where(eq(leads.tenantId, tenantId));

  const phoneSet = new Map<string, number>();
  const emailSet = new Map<string, number>();
  for (const lead of existingLeads) {
    if (lead.phone) phoneSet.set(normalizeForMatch(lead.phone), lead.id);
    if (lead.email) emailSet.set(lead.email.toLowerCase(), lead.id);
  }

  for (const contact of contacts) {
    if (!contact.phone && !contact.email) {
      skipped.push(contact);
      continue;
    }

    // Check for duplicates by phone first, then email
    let existingId: number | undefined;
    if (contact.phone) {
      existingId = phoneSet.get(normalizeForMatch(contact.phone));
    }
    if (!existingId && contact.email) {
      existingId = emailSet.get(contact.email.toLowerCase());
    }

    if (existingId) {
      duplicates.push({ ...contact, existingLeadId: existingId });
    } else {
      newContacts.push(contact);
    }
  }

  return {
    total: contacts.length,
    newContacts,
    duplicates,
    skipped,
  };
}

/**
 * Execute a contact import.
 */
export async function executeImport(
  db: Db,
  tenantId: number,
  contacts: ParsedContact[],
  options: ImportOptions
): Promise<ImportResult> {
  // Create import record
  const [importRecord] = await db.insert(contactImports).values({
    tenantId,
    source: contacts[0]?.source === "vcard" ? "vcard" : "csv",
    status: "processing",
    totalContacts: contacts.length,
  }).$returningId();

  const importId = importRecord.id;
  const errors: Array<{ row: number; message: string }> = [];
  let imported = 0;
  let skipped = 0;
  let duplicateCount = 0;

  // Get preview for dedup info
  const preview = await previewImport(db, tenantId, contacts);

  // Import new contacts
  for (let i = 0; i < preview.newContacts.length; i++) {
    const contact = preview.newContacts[i];
    try {
      if (!contact.phone) {
        skipped++;
        continue;
      }

      await LeadService.createLead(db, {
        tenantId,
        phone: contact.phone,
        name: contact.name || undefined,
        email: contact.email || undefined,
        source: `import_${contact.source}`,
        notes: contact.notes || undefined,
      });

      imported++;
    } catch (err) {
      errors.push({
        row: i,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Handle duplicates based on mode
  for (const dup of preview.duplicates) {
    try {
      if (options.mode === "skip_duplicates") {
        skipped++;
        duplicateCount++;
        continue;
      }

      if (options.mode === "merge_info" || options.mode === "overwrite") {
        // Update existing lead with new info
        const updates: Record<string, unknown> = {};
        if (dup.name && (options.mode === "overwrite" || !dup.name)) {
          updates.name = dup.name;
        }
        if (dup.email && (options.mode === "overwrite" || !dup.email)) {
          updates.email = dup.email;
        }
        if (dup.notes) {
          updates.notes = dup.notes;
        }

        if (Object.keys(updates).length > 0) {
          await db
            .update(leads)
            .set(updates)
            .where(and(eq(leads.id, dup.existingLeadId), eq(leads.tenantId, tenantId)));
          imported++;
        } else {
          skipped++;
        }
        duplicateCount++;
      }
    } catch (err) {
      errors.push({
        row: preview.newContacts.length + preview.duplicates.indexOf(dup),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  skipped += preview.skipped.length;

  // Update import record
  await db
    .update(contactImports)
    .set({
      status: errors.length > 0 && imported === 0 ? "failed" : "complete",
      imported,
      skipped,
      duplicates: duplicateCount,
      errors: errors.length > 0 ? errors : null,
      completedAt: new Date(),
    })
    .where(eq(contactImports.id, importId));

  // Emit event for automation triggers
  if (imported > 0) {
    await emitEvent({
      type: "lead.created",
      tenantId,
      data: {
        source: "contact_import",
        importId,
        contactsImported: imported,
      },
      timestamp: new Date(),
    });
  }

  return { importId, total: contacts.length, imported, skipped, duplicates: duplicateCount, errors };
}

/**
 * Get import history for a tenant.
 */
export async function getImportHistory(db: Db, tenantId: number, limit: number = 20) {
  return db
    .select()
    .from(contactImports)
    .where(eq(contactImports.tenantId, tenantId))
    .orderBy(sql`${contactImports.createdAt} DESC`)
    .limit(limit);
}

function normalizeForMatch(phone: string): string {
  return phone.replace(/[^\d]/g, "").slice(-10);
}
