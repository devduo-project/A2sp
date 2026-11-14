export const leadCardElements = [
  { id: "direction", label: "Направление" },
  { id: "company", label: "Заказчик" },
  { id: "duration", label: "Срок в стадии" },
  { id: "service", label: "Услуга" },
  { id: "object", label: "Объект и адрес" },
  { id: "financials", label: "Сумма и статус КП" },
  { id: "owner", label: "Ответственный" },
] as const

export type LeadCardElementId = (typeof leadCardElements)[number]["id"]
export type LeadCardConfig = { order: LeadCardElementId[]; hidden: LeadCardElementId[] }
export type LeadCardTitleStyle = "primary" | "secondary"

export function getLeadCardTitleStyle(index: number): LeadCardTitleStyle {
  return index === 0 ? "primary" : "secondary"
}

export const defaultLeadCardConfig: LeadCardConfig = {
  order: leadCardElements.map(({ id }) => id),
  hidden: [],
}

export function normalizeLeadCardConfig(value?: Partial<LeadCardConfig> | null): LeadCardConfig {
  const valid = new Set<LeadCardElementId>(defaultLeadCardConfig.order)
  const order = [...(value?.order ?? []), ...defaultLeadCardConfig.order].filter((id, index, all) => valid.has(id) && all.indexOf(id) === index)
  const hidden = (value?.hidden ?? []).filter((id, index, all) => valid.has(id) && all.indexOf(id) === index)
  return { order, hidden }
}
