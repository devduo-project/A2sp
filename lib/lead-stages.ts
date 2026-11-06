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

export const leadStageColors: Record<LeadStage, string> = {
  "Новый лид": "#F28A45",
  "Подготовка КП": "#4B83D8",
  "КП отправлено: ожидает решения": "#36A879",
  "Потенциальный": "#9270D9",
  "Нецелевой лид": "#7C8798",
  "Отложенный": "#D6A13D",
  "Несостоявшийся": "#C87575",
}

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (leadStages as readonly string[]).includes(value)
}
