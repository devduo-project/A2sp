export const leadCardElements = [
  { id: "direction", label: "Направление" },
  { id: "company", label: "Заказчик" },
  { id: "duration", label: "Срок в стадии" },
  { id: "service", label: "Услуга" },
  { id: "object", label: "Наименование объекта и адрес" },
  { id: "financials", label: "Сумма и статус КП" },
  { id: "owner", label: "Ответственный" },
] as const

export type LeadCardElementId = (typeof leadCardElements)[number]["id"]
export type LeadCardConfig = { order: LeadCardElementId[]; hidden: LeadCardElementId[] }

export const defaultLeadCardConfig: LeadCardConfig = {
  order: leadCardElements.map((element) => element.id),
  hidden: [],
}

export function normalizeLeadCardConfig(value?: Partial<LeadCardConfig> | null): LeadCardConfig {
  const valid = new Set<LeadCardElementId>(leadCardElements.map((element) => element.id))
  const order = [...(value?.order ?? []), ...defaultLeadCardConfig.order].filter((id, index, all) => valid.has(id) && all.indexOf(id) === index)
  return { order, hidden: (value?.hidden ?? []).filter((id, index, all) => valid.has(id) && all.indexOf(id) === index) }
}
