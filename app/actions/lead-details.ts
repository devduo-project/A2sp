"use server"

import { asc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { leadTasks, leads, type LeadData } from "@/lib/db/schema"
import { employees } from "@/lib/employees"
import type { Lead } from "@/components/lead-card"
import {
  ACTOR,
  appendHistory,
  communicationTypes,
  formatAddress,
  historyEntry,
  taskStatuses,
  type Communication,
  type HistoryEntry,
  type LeadDetails,
  type StoredFile,
  type TaskMeta,
} from "@/lib/lead-details"

export type LeadDetailsPatch = {
  request?: string
  objectName?: string
  value?: string
  owner?: string
  address?: string
  details?: Partial<Omit<LeadDetails, "history">>
  notes?: string[]
}

export type LeadTaskRow = {
  id: number
  title: string
  description: string
  dueDate: string
  owner: string
  priority: string
  createdAt: string
}

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

const numericFields = ["area", "floors", "volume"] as const
const textFields = ["projectDocumentation", "previousSurvey", "comment"] as const
const fieldLabels: Record<(typeof numericFields)[number] | (typeof textFields)[number], string> = {
  area: "Площадь",
  floors: "Этажность",
  volume: "Строительный объём",
  projectDocumentation: "Проектная документация",
  previousSurvey: "Данные предыдущего обследования",
  comment: "Комментарий",
}

function normalizeNumber(value: unknown): string {
  const text = clip(value, 24).replace(/\s/g, "").replace(",", ".")
  if (!text) return ""
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Числовые поля должны содержать только число")
  return text
}

function mergeFiles(
  stored: StoredFile[] | undefined,
  input: unknown,
  labels: { added: string; removed: string },
  entries: HistoryEntry[],
  appendOnly = false,
): StoredFile[] {
  if (!Array.isArray(input)) throw new Error("Некорректный список файлов")
  const previous = stored ?? []
  const byId = new Map(previous.map((file) => [file.id, file]))
  const seen = new Set<string>()
  const next: StoredFile[] = []
  for (const item of input.slice(0, 200)) {
    const candidate = (item ?? {}) as Partial<StoredFile>
    const id = clip(candidate.id, 64)
    const name = clip(candidate.name, 255)
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    const existing = byId.get(id)
    if (existing) {
      next.push(existing)
      continue
    }
    const size = typeof candidate.size === "number" && Number.isFinite(candidate.size) && candidate.size >= 0 ? Math.floor(candidate.size) : 0
    next.push({ id, name, size, addedAt: new Date().toISOString(), addedBy: ACTOR })
    entries.push(historyEntry(`${labels.added}: ${name}`))
  }
  if (appendOnly) {
    const kept = previous.filter((file) => !seen.has(file.id))
    return [...kept, ...next].sort((a, b) => Date.parse(a.addedAt) - Date.parse(b.addedAt))
  }
  for (const file of previous) if (!seen.has(file.id)) entries.push(historyEntry(`${labels.removed}: ${file.name}`))
  return next
}

function cleanPeople(input: unknown): string[] {
  if (!Array.isArray(input)) throw new Error("Некорректный список сотрудников")
  const list = [...new Set(input.map((name) => clip(name, 120)).filter(Boolean))]
  if (!list.every((name) => (employees as readonly string[]).includes(name))) throw new Error("Выберите сотрудника из списка")
  return list
}

function mergeCommunications(stored: Communication[] | undefined, input: unknown, entries: HistoryEntry[]): Communication[] {
  if (!Array.isArray(input)) throw new Error("Некорректный список коммуникаций")
  const previous = new Map((stored ?? []).map((item) => [item.id, item]))
  const result: Communication[] = []
  const seen = new Set<string>()
  for (const raw of input.slice(0, 500)) {
    const item = (raw ?? {}) as Partial<Communication>
    const id = clip(item.id, 64)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const taskIds = Array.isArray(item.taskIds) ? item.taskIds.filter((value): value is number => Number.isSafeInteger(value) && value > 0) : []
    const existing = previous.get(id)
    if (existing) {
      result.push({ ...existing, taskIds: [...new Set([...existing.taskIds, ...taskIds])] })
      continue
    }
    const subject = clip(item.subject, 200)
    if (!subject) throw new Error("Укажите тему или краткое описание коммуникации")
    const type = (communicationTypes as readonly string[]).includes(item.type as string) ? (item.type as Communication["type"]) : "Другое"
    const at = typeof item.at === "string" && !Number.isNaN(Date.parse(item.at)) ? new Date(item.at).toISOString() : new Date().toISOString()
    result.push({ id, type, at, participant: clip(item.participant, 200), subject, notes: clip(item.notes, 2000), taskIds })
    entries.push(historyEntry(`Добавлена коммуникация: ${type} — ${subject}`))
  }
  for (const [id, item] of previous) if (!seen.has(id)) result.push(item)
  return result.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

function mergeTaskMeta(stored: Record<string, TaskMeta> | undefined, input: unknown, entries: HistoryEntry[]): Record<string, TaskMeta> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Некорректные данные задач")
  const result: Record<string, TaskMeta> = {}
  for (const [key, raw] of Object.entries(input as Record<string, Partial<TaskMeta>>).slice(0, 1000)) {
    if (!/^\d{1,10}$/.test(key)) continue
    const status = (taskStatuses as readonly string[]).includes(raw?.status as string) ? (raw.status as TaskMeta["status"]) : "Новая"
    const communicationId = clip(raw?.communicationId, 64)
    const creatorId = raw?.creatorId === "crm-prototype-user" ? "crm-prototype-user" : stored?.[key]?.creatorId
    const executorId = clip(raw?.executorId, 120) || stored?.[key]?.executorId
    const coExecutors = raw?.coExecutors === undefined ? stored?.[key]?.coExecutors : cleanPeople(raw.coExecutors)
    const observers = raw?.observers === undefined ? stored?.[key]?.observers : cleanPeople(raw.observers)
    const assigned = [executorId, ...(coExecutors ?? []), ...(observers ?? [])].filter(Boolean)
    if (new Set(assigned).size !== assigned.length) throw new Error("Сотрудник уже назначен в другой роли")
    const attachments = raw?.attachments === undefined
      ? stored?.[key]?.attachments
      : mergeFiles(stored?.[key]?.attachments, raw.attachments, { added: "Добавлено вложение к задаче", removed: "Удалено вложение из задачи" }, entries)
    const rawSource = raw?.source
    const sourceType = rawSource?.type === "communication" || rawSource?.type === "task" ? rawSource.type : undefined
    const sourceId = sourceType ? clip(rawSource?.id, 64) : ""
    const source = sourceType && sourceId ? { type: sourceType, id: sourceId } : undefined
    const rawRecurrence = raw?.recurrence
    let recurrence: TaskMeta["recurrence"]
    if (rawRecurrence?.enabled === true) {
      const frequencies = ["daily", "weekly", "monthly", "yearly"]
      const frequency = frequencies.includes(rawRecurrence.frequency) ? rawRecurrence.frequency : "weekly"
      const interval = Number.isInteger(rawRecurrence.interval) ? Math.min(99, Math.max(1, rawRecurrence.interval)) : 1
      const weekdays = Array.isArray(rawRecurrence.weekdays)
        ? [...new Set(rawRecurrence.weekdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))]
        : []
      const startDate = /^\d{4}-\d{2}-\d{2}$/.test(rawRecurrence.startDate) ? rawRecurrence.startDate : new Date().toISOString().slice(0, 10)
      const endDate = typeof rawRecurrence.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawRecurrence.endDate) ? rawRecurrence.endDate : ""
      recurrence = { enabled: true, frequency, interval, weekdays, startDate, endDate }
    }
    result[key] = {
      status,
      ...(communicationId ? { communicationId } : {}),
      ...(creatorId ? { creatorId } : {}),
      ...(executorId ? { executorId } : {}),
      ...(coExecutors ? { coExecutors } : {}),
      ...(observers ? { observers } : {}),
      ...(attachments ? { attachments } : {}),
      ...(source ? { source } : {}),
      ...(recurrence ? { recurrence } : {}),
    }
    const before = stored?.[key]?.status
    if (before && before !== status) entries.push(historyEntry(`Изменён статус задачи №${key}`, before, status))
  }
  return result
}

export async function updateLeadDetails(leadId: string, patch: LeadDetailsPatch): Promise<Lead> {
  if (typeof leadId !== "string" || !leadId) throw new Error("Некорректный лид")
  if (!patch || typeof patch !== "object") throw new Error("Нет изменений")

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(leads).where(eq(leads.id, leadId)).for("update")
    if (!row) throw new Error("Лид не найден")

    const data: LeadData = { ...row.data }
    const previous: LeadDetails = row.data.details ?? {}
    const details: LeadDetails = { ...previous }
    const entries: HistoryEntry[] = []

    if (patch.request !== undefined) {
      const next = clip(patch.request, 200)
      if (!next) throw new Error("Укажите услугу")
      if (next !== data.request) {
        entries.push(historyEntry("Изменена услуга запроса", data.request, next))
        data.request = next
      }
    }

    if (patch.objectName !== undefined) {
      const next = clip(patch.objectName, 200)
      if (!next) throw new Error("Укажите наименование объекта")
      if (next !== (data.objectName ?? "")) {
        entries.push(historyEntry("Изменено название объекта", data.objectName ?? "", next))
        data.objectName = next
      }
    }

    if (patch.value !== undefined) {
      const digits = clip(patch.value, 40).replace(/\D/g, "")
      if (!digits || !Number.isSafeInteger(Number(digits))) throw new Error("Некорректная сумма")
      const next = `₽ ${Number(digits).toLocaleString("ru-RU").replace(/\u00a0|\u202f/g, " ")}`
      if (next !== data.value) {
        entries.push(historyEntry("Изменена сумма расчёта", data.value, next))
        data.value = next
      }
    }

    if (patch.owner !== undefined) {
      const next = clip(patch.owner, 120)
      if (!(employees as readonly string[]).includes(next)) throw new Error("Выберите ответственного")
      if (next !== data.owner) {
        entries.push(historyEntry("Изменён ответственный", data.owner, next))
        data.owner = next
      }
    }

    if (patch.address !== undefined) {
      const parts = clip(patch.address, 500).split(",").map((part) => part.trim()).filter(Boolean)
      if (!parts.length) throw new Error("Укажите адрес объекта")
      const address = { city: parts[0] ?? "", street: parts[1] ?? "", building: parts[2] ?? "", additional: parts.slice(3).join(", ") }
      const before = formatAddress(data.address)
      const after = formatAddress(address)
      if (before !== after) {
        entries.push(historyEntry("Изменён адрес объекта", before, after))
        data.address = address
        if (address.city) data.city = address.city
      }
    }

    const incoming = patch.details
    if (incoming) {
      const changes: { key: keyof typeof fieldLabels; from: string; to: string }[] = []
      for (const key of numericFields) {
        if (incoming[key] === undefined) continue
        const next = normalizeNumber(incoming[key])
        if ((previous[key] ?? "") !== next) changes.push({ key, from: previous[key] ?? "", to: next })
        details[key] = next
      }
      for (const key of textFields) {
        if (incoming[key] === undefined) continue
        const next = clip(incoming[key], 2000)
        if ((previous[key] ?? "") !== next) changes.push({ key, from: previous[key] ?? "", to: next })
        details[key] = next
      }
      if (changes.length === 1) entries.push(historyEntry(`Обновлена характеристика объекта: ${fieldLabels[changes[0].key]}`, changes[0].from, changes[0].to))
      else if (changes.length > 1) entries.push(historyEntry(`Обновлены характеристики объекта: ${changes.map((change) => fieldLabels[change.key]).join(", ")}`))

      if (incoming.sourceFiles !== undefined) details.sourceFiles = mergeFiles(previous.sourceFiles, incoming.sourceFiles, { added: "Добавлен исходный материал", removed: "Удалён исходный материал" }, entries)
      if (incoming.documents !== undefined) details.documents = mergeFiles(previous.documents, incoming.documents, { added: "Добавлен документ заказчика", removed: "Удалён документ заказчика" }, entries)
      if (incoming.kpVersions !== undefined) details.kpVersions = mergeFiles(previous.kpVersions, incoming.kpVersions, { added: "Добавлена версия КП", removed: "Удалена версия КП" }, entries, true)

      if (incoming.coExecutors !== undefined) {
        details.coExecutors = cleanPeople(incoming.coExecutors)
        if ((previous.coExecutors ?? []).join(", ") !== details.coExecutors.join(", ")) entries.push(historyEntry("Изменены соисполнители", (previous.coExecutors ?? []).join(", "), details.coExecutors.join(", ")))
      }
      if (incoming.observers !== undefined) {
        details.observers = cleanPeople(incoming.observers)
        if ((previous.observers ?? []).join(", ") !== details.observers.join(", ")) entries.push(historyEntry("Изменены наблюдатели", (previous.observers ?? []).join(", "), details.observers.join(", ")))
      }
      if (incoming.communications !== undefined) details.communications = mergeCommunications(previous.communications, incoming.communications, entries)
      if (incoming.taskMeta !== undefined) {
        details.taskMeta = mergeTaskMeta(previous.taskMeta, incoming.taskMeta, entries)
        const taskRows = await tx.select({ id: leadTasks.id, owner: leadTasks.owner }).from(leadTasks).where(eq(leadTasks.leadId, leadId))
        const ownerById = new Map(taskRows.map((task) => [String(task.id), task.owner]))
        const communicationIds = new Set((details.communications ?? []).map((communication) => communication.id))
        for (const [taskId, meta] of Object.entries(details.taskMeta)) {
          const executorId = ownerById.get(taskId)
          if (executorId === undefined) throw new Error("Задача не принадлежит этому лиду")
          const assigned = [executorId, ...(meta.coExecutors ?? []), ...(meta.observers ?? [])].filter(Boolean)
          if (new Set(assigned).size !== assigned.length) throw new Error("Сотрудник уже назначен в другой роли")
          if (meta.communicationId && !communicationIds.has(meta.communicationId)) throw new Error("Коммуникация не принадлежит этому лиду")
          if (meta.source?.type === "communication" && !communicationIds.has(meta.source.id)) throw new Error("Коммуникация не принадлежит этому лиду")
          if (meta.source?.type === "task" && (meta.source.id === taskId || !ownerById.has(meta.source.id))) throw new Error("Выберите другую задачу этого лида")
          meta.executorId = executorId
        }
      }
    }

    for (const note of Array.isArray(patch.notes) ? patch.notes.slice(0, 10) : []) {
      const text = clip(note, 300)
      if (text) entries.push(historyEntry(text))
    }

    const assigned = [data.owner, ...(details.coExecutors ?? []), ...(details.observers ?? [])]
    if (new Set(assigned).size !== assigned.length) throw new Error("Сотрудник уже назначен в другой роли")

    data.details = appendHistory(details, entries)
    await tx.update(leads).set({ data, updatedAt: sql`now()` }).where(eq(leads.id, leadId))
    return { ...data, id: row.id, stage: row.stage }
  })
}

export async function getLeadTasks(leadId: string): Promise<LeadTaskRow[]> {
  if (typeof leadId !== "string" || !leadId) throw new Error("Некорректный лид")
  const rows = await db.select().from(leadTasks).where(eq(leadTasks.leadId, leadId)).orderBy(asc(leadTasks.createdAt), asc(leadTasks.id))
  const sortKey = (row: (typeof rows)[number]) => {
    const due = Date.parse(row.dueDate)
    return Number.isNaN(due) ? row.createdAt.getTime() : due
  }
  return rows
    .map((row) => ({ row, key: sortKey(row) }))
    .sort((a, b) => a.key - b.key)
    .map(({ row }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      dueDate: row.dueDate,
      owner: row.owner,
      priority: row.priority,
      createdAt: row.createdAt.toISOString(),
    }))
}
