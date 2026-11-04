export const leadStages = [
  "Новый лид",
  "Подготовка КП",
  "КП отправлено: ожидает решения",
  "Потенциальный",
  "Нецелевой лид",
  "Отложенный",
  "Несостоявшийся",
] as const

export type LeadStage = (typeof leadStages)[number]

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (leadStages as readonly string[]).includes(value)
}
