export const ACTOR = "Пользователь CRM"
export const OTHER_REQUEST = "Другой запрос"
export const HISTORY_LIMIT = 500

export const taskStatuses = ["Новая", "В работе", "Выполнена"] as const
export type TaskStatus = (typeof taskStatuses)[number]

export const communicationTypes = ["Звонок", "Электронное письмо", "Переписка", "Другое"] as const
export type CommunicationType = (typeof communicationTypes)[number]

export type StoredFile = { id: string; name: string; size: number; addedAt: string; addedBy: string }

export type Communication = {
  id: string
  type: CommunicationType
  at: string
  participant: string
  subject: string
  notes: string
  taskIds: number[]
}

export type TaskMeta = { status: TaskStatus; communicationId?: string }

export type HistoryEntry = { id: string; at: string; actor: string; text: string; from?: string; to?: string }

export type LeadDetails = {
  area?: string
  floors?: string
  volume?: string
  projectDocumentation?: string
  previousSurvey?: string
  comment?: string
  sourceFiles?: StoredFile[]
  documents?: StoredFile[]
  kpVersions?: StoredFile[]
  coExecutors?: string[]
  observers?: string[]
  communications?: Communication[]
  taskMeta?: Record<string, TaskMeta>
  history?: HistoryEntry[]
}

export function historyEntry(text: string, from?: string, to?: string): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: ACTOR,
    text,
    ...(from !== undefined ? { from: from || "—" } : {}),
    ...(to !== undefined ? { to: to || "—" } : {}),
  }
}

export function appendHistory(details: LeadDetails | undefined, entries: HistoryEntry[]): LeadDetails {
  if (!entries.length) return details ?? {}
  return { ...details, history: [...(details?.history ?? []), ...entries].slice(-HISTORY_LIMIT) }
}

export function amountFromValue(value: string | undefined): number | null {
  const digits = (value ?? "").replace(/[^\d]/g, "")
  if (!digits) return null
  const amount = Number(digits)
  return Number.isFinite(amount) ? amount : null
}

export function parsePositive(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function unitCost(amount: number | null, divisor: number | null): number | null {
  if (amount === null || divisor === null || amount <= 0 || divisor <= 0) return null
  return amount / divisor
}

const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 })

export function formatRubles(amount: number | null): string {
  return amount === null ? "—" : `${numberFormatter.format(amount)}\u00a0₽`
}

export function formatMeasure(value: string | undefined, unit: string): string {
  const parsed = parsePositive(value)
  return parsed === null ? "—" : `${numberFormatter.format(parsed)}\u00a0${unit}`
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
}

export function formatDate(value: string | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ru-RU").format(date)
}

export function fileExtension(name: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name)
  return match ? match[1].toUpperCase() : "—"
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes}\u00a0Б`
  if (bytes < 1024 * 1024) return `${numberFormatter.format(bytes / 1024)}\u00a0КБ`
  return `${numberFormatter.format(bytes / (1024 * 1024))}\u00a0МБ`
}

export function formatAddress(address?: { city?: string; street?: string; building?: string; additional?: string }): string {
  return [address?.city, address?.street, address?.building, address?.additional].filter((part): part is string => Boolean(part?.trim())).join(", ")
}
