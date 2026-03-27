import { eq, and, isNull } from "drizzle-orm";
import { templates } from "../../drizzle/schema";

import type { Db } from "../_core/context";

export async function getTemplates(db: Db, tenantId: number) {
  return db
    .select()
    .from(templates)
    .where(and(eq(templates.tenantId, tenantId), isNull(templates.deletedAt)))
    .orderBy(templates.name);
}

export async function getTemplateById(db: Db, tenantId: number, templateId: number) {
  const result = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.tenantId, tenantId), isNull(templates.deletedAt)))
    .limit(1);
  return result[0];
}

export async function createTemplate(db: Db, data: {
  tenantId: number;
  key: string;
  name: string;
  body: string;
  tone?: "friendly" | "professional" | "casual" | "urgent" | "empathetic";
  category?: string;
}) {
  // Extract only columns that exist in the templates table (category is not a DB column)
  const { category, ...insertData } = data;
  await db.insert(templates).values(insertData);
  return { success: true };
}

export async function updateTemplate(
  db: Db,
  tenantId: number,
  templateId: number,
  data: { name?: string; body?: string; tone?: "friendly" | "professional" | "casual" | "urgent" | "empathetic" }
) {
  await db
    .update(templates)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(templates.id, templateId), eq(templates.tenantId, tenantId), isNull(templates.deletedAt)));
}

export async function deleteTemplate(db: Db, tenantId: number, templateId: number) {
  await db
    .update(templates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(templates.id, templateId), eq(templates.tenantId, tenantId), isNull(templates.deletedAt)));
}
