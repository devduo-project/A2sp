"use server"

import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { leadContacts, leadTasks, leads } from "@/lib/db/schema"
import { taskPriorities } from "@/lib/task-priorities"

export type SavedContact = {
  id: number
  leadId: string
  name: string
  role: string
  phone: string
  email: string
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
  comment: string
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

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
      comment: text(input.comment, 2000),
    })
    .returning()
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
    comment: row.comment,
  }
}
