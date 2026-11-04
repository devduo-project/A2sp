"use server"

import { and, asc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { leads } from "@/lib/db/schema"
import { isLeadStage } from "@/lib/lead-stages"
import { seedLeads } from "@/lib/leads-seed"
import type { Lead } from "@/components/lead-card"

const MAX_COLUMN_SIZE = 1000

export async function getLeads(): Promise<Lead[]> {
  const rows = await db.select().from(leads).orderBy(asc(leads.position), asc(leads.id))
  if (rows.length > 0) return rows.map((row) => ({ ...row.data, id: row.id, stage: row.stage }))

  await db
    .insert(leads)
    .values(seedLeads.map(({ id, stage, ...data }, position) => ({ id, stage, position, data })))
    .onConflictDoNothing()
  return seedLeads
}

export async function moveLead(leadId: string, stage: string, orderedIds: string[]) {
  if (typeof leadId !== "string" || !leadId) throw new Error("Некорректный лид")
  if (!isLeadStage(stage)) throw new Error("Некорректная стадия")
  if (!Array.isArray(orderedIds) || orderedIds.length > MAX_COLUMN_SIZE || !orderedIds.every((id) => typeof id === "string") || !orderedIds.includes(leadId)) {
    throw new Error("Некорректный порядок")
  }

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(leads)
      .set({ stage, updatedAt: sql`now()` })
      .where(eq(leads.id, leadId))
      .returning({ id: leads.id })
    if (updated.length === 0) throw new Error("Лид не найден")

    for (const [position, id] of orderedIds.entries()) {
      await tx.update(leads).set({ position }).where(and(eq(leads.id, id), eq(leads.stage, stage)))
    }
  })
}
