"use server"

import { and, asc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { leads } from "@/lib/db/schema"
import { isLeadStage, leadStages } from "@/lib/lead-stages"
import { seedLeads } from "@/lib/leads-seed"
import { employees } from "@/lib/employees"
import { createLeadContact, type SavedContact } from "@/app/actions/lead-records"
import type { Lead } from "@/components/lead-card"
import { cookies } from "next/headers"
import { defaultLeadCardConfig, normalizeLeadCardConfig, type LeadCardConfig } from "@/lib/lead-card-config"

const MAX_COLUMN_SIZE = 1000

async function leadCardPreferenceKey() {
  const cookieStore = await cookies()
  let key = cookieStore.get("crm-lead-card-user")?.value
  if (!key) {
    key = crypto.randomUUID()
    cookieStore.set("crm-lead-card-user", key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 })
  }
  return key
}

export async function getLeadCardConfig(): Promise<LeadCardConfig> {
  const userKey = await leadCardPreferenceKey()
  await db.execute(sql`CREATE TABLE IF NOT EXISTS lead_card_preferences (user_key text PRIMARY KEY, config jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`)
  const result = await db.execute<{ config: LeadCardConfig }>(sql`SELECT config FROM lead_card_preferences WHERE user_key = ${userKey} LIMIT 1`)
  return normalizeLeadCardConfig(result.rows[0]?.config ?? defaultLeadCardConfig)
}

export async function saveLeadCardConfig(config: LeadCardConfig): Promise<LeadCardConfig> {
  const userKey = await leadCardPreferenceKey()
  const normalized = normalizeLeadCardConfig(config)
  await db.execute(sql`CREATE TABLE IF NOT EXISTS lead_card_preferences (user_key text PRIMARY KEY, config jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`)
  await db.execute(sql`INSERT INTO lead_card_preferences (user_key, config) VALUES (${userKey}, ${JSON.stringify(normalized)}::jsonb) ON CONFLICT (user_key) DO UPDATE SET config = excluded.config, updated_at = now()`)
  return normalized
}

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
  owner?: string
  address?: NonNullable<Lead["address"]>
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

const NEW_LEAD_DIRECTIONS = ["А2-СП", "ИП", "МГСУ"] as const
const NEW_LEAD_QUOTE_STATUSES = ["КП озвучено", "КП отправлено"] as const

export type NewLeadInput = {
  direction: string
  company: string
  objectName: string
  request: string
  address: { city: string; street: string; building: string; additional: string }
  value: string
  quoteStatus: string
  owner: string
  phone: string
  contactName: string
  contactRole: string
  contactPhone: string
  contactEmail: string
}

export async function createLead(input: NewLeadInput): Promise<{ lead: Lead; contact: SavedContact | null }> {
  const company = clean(input?.company, 200)
  const objectName = clean(input?.objectName, 200)
  const request = clean(input?.request, 200)
  const owner = clean(input?.owner, 120)
  if (!company) throw new Error("Укажите заказчика")
  if (!objectName) throw new Error("Укажите наименование объекта")
  if (!request) throw new Error("Выберите услугу")
  if (!(employees as readonly string[]).includes(owner)) throw new Error("Выберите ответственного")

  const direction = clean(input.direction, 20)
  if (!(NEW_LEAD_DIRECTIONS as readonly string[]).includes(direction)) throw new Error("Выберите направление")
  const quoteStatus = clean(input.quoteStatus, 40)
  if (!(NEW_LEAD_QUOTE_STATUSES as readonly string[]).includes(quoteStatus)) throw new Error("Выберите статус КП")

  const digits = clean(input.value, 40).replace(/\D/g, "")
  if (digits && !Number.isSafeInteger(Number(digits))) throw new Error("Некорректная сумма")
  const value = `₽ ${Number(digits || 0).toLocaleString("ru-RU").replace(/\u00a0|\u202f/g, " ")}`

  const address = {
    city: clean(input.address?.city, 120),
    street: clean(input.address?.street, 200),
    building: clean(input.address?.building, 80),
    additional: clean(input.address?.additional, 200),
  }
  const contactName = clean(input.contactName, 240)
  const contactRole = clean(input.contactRole, 160)
  const stage = leadStages[0]

  const lead = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(724001)`)
    const rows = await tx.select({ id: leads.id, position: leads.position }).from(leads)
    const lastNumber = rows.reduce((max, row) => {
      const match = /^Л-(\d+)$/.exec(row.id)
      return match && Number(match[1]) > max ? Number(match[1]) : max
    }, 24000)
    const firstPosition = rows.reduce((min, row) => Math.min(min, row.position), 0)
    const id = `Л-${lastNumber + 1}`
    const data = {
      company,
      contact: contactName,
      role: contactRole,
      phone: clean(input.phone, 40),
      city: address.city,
      objectName,
      direction: direction as (typeof NEW_LEAD_DIRECTIONS)[number],
      address,
      request,
      source: "Создан вручную",
      owner,
      value,
      quoteStatus,
      next: "Не запланировано",
      days: 0,
    }
    await tx.insert(leads).values({ id, stage, position: firstPosition - 1, data })
    return { ...data, id, stage } satisfies Lead
  })

  let contact: SavedContact | null = null
  if (contactName) {
    const [firstName, ...rest] = contactName.split(/\s+/)
    try {
      contact = await createLeadContact({ leadId: lead.id, firstName, lastName: rest.join(" "), role: contactRole, phone: clean(input.contactPhone, 40), email: clean(input.contactEmail, 200), comment: "" })
    } catch {
      contact = null
    }
  }
  return { lead, contact }
}

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
  if (patch.owner !== undefined) {
    const owner = clean(patch.owner, 120)
    if (!(employees as readonly string[]).includes(owner)) throw new Error("Выберите ответственного")
    next.owner = owner
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
