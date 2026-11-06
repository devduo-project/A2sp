"use server"

import { and, asc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { leads } from "@/lib/db/schema"
import { isLeadStage, leadStages } from "@/lib/lead-stages"
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

export type LeadFieldsPatch = {
  company?: string
  objectName?: string
  value?: string
  address?: NonNullable<Lead["address"]>
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

export async function updateLeadFields(leadId: string, patch: LeadFieldsPatch): Promise<Lead> {
  if (typeof leadId !== "string" || !leadId) throw new Error("Некорректный лид")
  const next: Partial<Lead> = {}

  if (patch.company !== undefined) {
    next.company = clean(patch.company, 200)
    if (!next.company) throw new Error("Укажите заказчика")
  }
  if (patch.objectName !== undefined) {
    next.objectName = clean(patch.objectName, 200)
    if (!next.objectName) throw new Error("Укажите наименование объекта")
  }
  if (patch.value !== undefined) {
    const digits = clean(patch.value, 40).replace(/\D/g, "")
    if (!digits || !Number.isSafeInteger(Number(digits))) throw new Error("Некорректная сумма")
    next.value = `₽ ${Number(digits).toLocaleString("ru-RU").replace(/\u00a0|\u202f/g, " ")}`
  }
  if (patch.address !== undefined) {
    const address = {
      city: clean(patch.address.city, 120),
      street: clean(patch.address.street, 200),
      building: clean(patch.address.building, 80),
      additional: clean(patch.address.additional, 200),
    }
    if (!Object.values(address).some(Boolean)) throw new Error("Укажите адрес")
    next.address = address
    if (address.city) next.city = address.city
  }

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(leads).where(eq(leads.id, leadId)).for("update")
    if (!row) throw new Error("Лид не найден")
    const data = { ...row.data, ...next }
    await tx.update(leads).set({ data, updatedAt: sql`now()` }).where(eq(leads.id, leadId))
    return { ...data, id: row.id, stage: row.stage }
  })
}

export async function duplicateLead(leadId: string): Promise<Lead> {
  if (typeof leadId !== "string" || !leadId) throw new Error("Некорректный лид")

  return db.transaction(async (tx) => {
    const [source] = await tx.select().from(leads).where(eq(leads.id, leadId))
    if (!source) throw new Error("Лид не найден")

    const all = await tx.select({ id: leads.id, position: leads.position }).from(leads)
    const prefix = leadId.match(/^\D*/)?.[0] || "Л-"
    const maxNumber = all.reduce((max, { id }) => Math.max(max, Number(id.replace(/\D/g, "")) || 0), 0)
    const id = `${prefix}${maxNumber + 1}`
    const position = all.reduce((max, row) => Math.max(max, row.position), 0) + 1
    const stage = leadStages[0]
    const data = { ...source.data, days: 0 }

    await tx.insert(leads).values({ id, stage, position, data })
    return { ...data, id, stage }
  })
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
