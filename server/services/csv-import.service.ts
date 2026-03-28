import { eq, and, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import crypto from "crypto";
import * as schema from "../../drizzle/schema";
import { normalizePhone, validatePhone } from "./phone-validation.service";

export const PLATFORM_MAPPINGS: Record<string, Record<string, string>> = {
  square: { "Customer Name": "name", "Phone Number": "phone", "Email Address": "email" },
  vagaro: { "Client Name": "name", "Mobile Phone": "phone", "Email": "email" },
  booksy: { "Full Name": "name", "Phone": "phone", "Email": "email" },
  fresha: { "Client name": "name", "Mobile": "phone", "Email": "email" },
  generic: { name: "name", phone: "phone", email: "email" },
};

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

function isValidPhoneForImport(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return phone.startsWith("+") || digits.length >= 10;
}

export async function importLeadsFromCSV(
  db: MySql2Database<typeof schema>,
  tenantId: number,
  csvContent: string,
  platform: string = "generic",
): Promise<ImportResult> {
  const mapping = PLATFORM_MAPPINGS[platform] ?? PLATFORM_MAPPINGS.generic;
  const { rows } = parseCSV(csvContent);
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  if (rows.length === 0) {
    return { imported: 0, skipped: 0, errors: ["CSV file is empty or has no data rows"] };
  }

  // Collect all phones to check for duplicates in one query
  const phonesToCheck: string[] = [];
  const validRows: Array<{ name: string; phone: string; email: string; rowIndex: number }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = getMappedValue(row, mapping, "name");
    const phone = getMappedValue(row, mapping, "phone");
    const email = getMappedValue(row, mapping, "email");

    if (!phone) {
      errors.push(`Row ${i + 2}: Missing phone number`);
      skipped++;
      continue;
    }

    if (!isValidPhoneForImport(phone)) {
      errors.push(`Row ${i + 2}: Invalid phone format "${phone}"`);
      skipped++;
      continue;
    }

    const normalized = normalizePhone(phone);
    const validation = validatePhone(phone);
    if (!validation.canReceiveSms) {
      errors.push(`Row ${i + 2}: Phone "${phone}" cannot receive SMS (${validation.warnings.join(", ")})`);
      skipped++;
      continue;
    }

    phonesToCheck.push(normalized);
    validRows.push({ name: name || "Unknown", phone: normalized, email, rowIndex: i });
  }

  // Check existing leads for duplicate phones
  const existingPhones = new Set<string>();
  if (phonesToCheck.length > 0) {
    const existing = await db
      .select({ phone: schema.leads.phone })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenantId),
          inArray(schema.leads.phone, phonesToCheck),
        ),
      );
    for (const e of existing) {
      if (e.phone) existingPhones.add(e.phone);
    }
  }

  // Insert non-duplicate leads
  for (const { name, phone, email, rowIndex } of validRows) {
    if (existingPhones.has(phone)) {
      errors.push(`Row ${rowIndex + 2}: Duplicate phone "${phone}" (already exists)`);
      skipped++;
      continue;
    }

    try {
      const phoneHash = crypto.createHash("sha256").update(phone).digest("hex");
      await db.insert(schema.leads).values({
        tenantId,
        name,
        phone,
        phoneHash,
        email: email || null,
        source: `csv_import_${platform}`,
        status: "new",
      });
      existingPhones.add(phone); // Prevent in-batch duplicates
      imported++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Row ${rowIndex + 2}: Insert failed - ${msg}`);
      skipped++;
    }
  }

  return { imported, skipped, errors: errors.slice(0, 50) }; // Cap errors at 50
}

function getMappedValue(row: Record<string, string>, mapping: Record<string, string>, field: string): string {
  for (const [csvCol, mappedField] of Object.entries(mapping)) {
    if (mappedField === field && row[csvCol] !== undefined) {
      return row[csvCol];
    }
  }
  return "";
}
