"use server"

import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { leadContacts, leadTasks, leads, type ContactMethod } from "@/lib/db/schema"
import { taskPriorities } from "@/lib/task-priorities"

export type SavedContact = {
  id: number
  leadId: string
  name: string
  role: string
  phone: string
  email: string
  telegram: string
  contactMethods: ContactMethod[]
  comment: string
}

export type TaskInput = {
  leadId: string
  title: string
  description: string
  dueDate: string
  owner: string
  priority: string
}

export type ContactInput = {
  leadId: string
  firstName: string
  lastName: string
  role: string
  phone: string
  email: string
  telegram?: string
  contactMethods?: ContactMethod[]
  comment: string
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

function normalizeContactMethods(input: unknown, telegram: unknown): ContactMethod[] {
  const methods = Array.isArray(input) ? input.flatMap((method, index) => {
    if (!method || typeof method !== "object") return []
    const item = method as Partial<ContactMethod>
    if (item.kind !== "messenger" && item.kind !== "phone" && item.kind !== "email") return []
    const value = text(item.value, 500)
    if (!value) return []
    if (item.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Некорректный email")
    return [{ id: text(item.id, 100) || `method-${index}`, kind: item.kind, provider: item.kind === "messenger" ? text(item.provider, 60) || "Мессенджер" : undefined, value }]
  }) : []
  const telegramValue = text(telegram, 500)
  const withoutTelegram = methods.filter((method) => method.id !== "__telegram__")
  return telegramValue ? [{ id: "__telegram__", kind: "messenger", provider: "Telegram", value: telegramValue }, ...withoutTelegram] : withoutTelegram
}

async function assertLeadExists(leadId: string) {
  const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId)).limit(1)
  if (!lead) throw new Error("Лид не найден")
}

export async function createLeadTask(input: TaskInput) {
  const leadId = text(input.leadId, 64)
  const title = text(input.title, 200)
  if (!leadId) throw new Error("Некорректный лид")
  if (!title) throw new Error("Укажите название задачи")
  const priority = (taskPriorities as readonly string[]).includes(input.priority) ? input.priority : "Средний"

  await assertLeadExists(leadId)
  const [task] = await db
    .insert(leadTasks)
    .values({
      leadId,
      title,
      description: text(input.description, 2000),
      dueDate: text(input.dueDate, 32),
      owner: text(input.owner, 120),
      priority,
    })
    .returning({ id: leadTasks.id })
  return { id: task.id }
}

export async function createLeadContact(input: ContactInput): Promise<SavedContact> {
  const leadId = text(input.leadId, 64)
  const firstName = text(input.firstName, 120)
  if (!leadId) throw new Error("Некорректный лид")
  if (!firstName) throw new Error("Укажите имя контакта")
  const email = text(input.email, 200)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Некорректный email")
  const contactMethods = normalizeContactMethods(input.contactMethods, input.telegram)

  await assertLeadExists(leadId)
  const lastName = text(input.lastName, 120)
  const [row] = await db
    .insert(leadContacts)
    .values({
      leadId,
      firstName,
      lastName,
      role: text(input.role, 160),
      phone: text(input.phone, 40),
      email,
      contactMethods,
      comment: text(input.comment, 2000),
    })
    .returning()
  return toSavedContact(row)
}

export async function updateLeadContact(id: number, input: ContactInput): Promise<SavedContact> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Некорректный контакт")
  const leadId = text(input.leadId, 64)
  const firstName = text(input.firstName, 120)
  if (!leadId || !firstName) throw new Error("Укажите имя контакта")
  const email = text(input.email, 200)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Некорректный email")
  await assertLeadExists(leadId)
  const [row] = await db.update(leadContacts).set({
    leadId,
    firstName,
    lastName: text(input.lastName, 120),
    role: text(input.role, 160),
    phone: text(input.phone, 40),
    email,
    contactMethods: normalizeContactMethods(input.contactMethods, input.telegram),
    comment: text(input.comment, 2000),
  }).where(and(eq(leadContacts.id, id), eq(leadContacts.leadId, leadId))).returning()
  if (!row) throw new Error("Контакт не найден")
  return toSavedContact(row)
}

export async function getSavedContacts(): Promise<SavedContact[]> {
  const rows = await db.select().from(leadContacts).orderBy(asc(leadContacts.id))
  return rows.map(toSavedContact)
}

function toSavedContact(row: typeof leadContacts.$inferSelect): SavedContact {
  return {
    id: row.id,
    leadId: row.leadId,
    name: [row.firstName, row.lastName].filter(Boolean).join(" "),
    role: row.role,
    phone: row.phone,
    email: row.email,
    telegram: row.contactMethods.find((method) => method.id === "__telegram__")?.value ?? "",
    contactMethods: row.contactMethods,
    comment: row.comment,
  }
}
