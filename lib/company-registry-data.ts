import type { Lead } from "@/components/lead-card"
import type { SavedContact } from "@/app/actions/lead-records"
import type { ContactMethod } from "@/lib/db/schema"

export type RegistryContact = {
  id: string
  name: string
  role: string
  phones: string[]
  emails: string[]
  telegram?: string
  contactMethods?: ContactMethod[]
  leadId?: string
  savedContactId?: number
  comment?: string
  isPrimary: boolean
  createdAt?: string
  createdBy?: string
}

export type RegistryRecord = {
  id: string
  name: string
  stage: string
  createdAt?: string
  amount?: number
  direction?: string
  originalLeadId?: string
}

export type CompanyViewModel = {
  id: string
  legalName: string
  contacts: RegistryContact[]
  leads: RegistryRecord[]
  deals: RegistryRecord[]
  createdAt?: string
  createdBy?: string
  leadAmount?: number
  contractAmount?: number
  customerDebt?: number
  direction?: string
  responsible?: string
  isDemo: boolean
}

export type ContactViewModel = RegistryContact & {
  companyId: string
  companyName: string
}

export type DemoCompany = {
  id: string
  legalName: string
  contacts: RegistryContact[]
  leads: RegistryRecord[]
  deals: RegistryRecord[]
  createdAt: string
  createdBy: string
  leadAmount?: number
  contractAmount?: number
  customerDebt?: number
  direction: string
}

export type ExistingDeal = {
  id: string
  company: string
  service: string
  stage: string
  value: string
  dates: string
  owner: string
}

export function parseRegistryAmount(value?: string | number | null): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (!value?.trim()) return undefined
  const normalized = value.trim().replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "").replace(",", ".")
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : undefined
}

export function parseRegistryDate(value?: string | Date | null): number | undefined {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : undefined
  if (!value?.trim()) return undefined
  const localized = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  const timestamp = localized
    ? new Date(Number(localized[3]), Number(localized[2]) - 1, Number(localized[1]), Number(localized[4] ?? 0), Number(localized[5] ?? 0), Number(localized[6] ?? 0)).getTime()
    : Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function sortNewest(records: RegistryRecord[]) {
  return records.sort((a, b) => (parseRegistryDate(b.createdAt) ?? 0) - (parseRegistryDate(a.createdAt) ?? 0))
}

export function buildCompanyViewModels(
  leads: Lead[],
  savedContacts: SavedContact[],
  deals: ExistingDeal[],
  demoCompanies: DemoCompany[],
): CompanyViewModel[] {
  const byName = new Map<string, CompanyViewModel>()
  const leadById = new Map(leads.map((lead) => [lead.id, lead]))

  const getCompany = (legalName: string) => {
    const exactName = legalName.trim()
    if (!exactName) return undefined
    const existing = byName.get(exactName)
    if (existing) return existing
    const company: CompanyViewModel = {
      id: `source-company-${encodeURIComponent(exactName)}`, 
      legalName: exactName,
      contacts: [],
      leads: [],
      deals: [],
      isDemo: false,
    }
    byName.set(exactName, company)
    return company
  }

  for (const lead of leads) {
    const company = getCompany(lead.company)
    if (!company) continue
    const amount = parseRegistryAmount(lead.value)
    company.leads.push({
      id: lead.id,
      originalLeadId: lead.id,
      name: lead.objectName || lead.request || "Лид",
      stage: lead.stage,
      createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : lead.createdAt,
      amount,
      direction: lead.direction,
    })
    company.direction = company.direction ?? lead.direction
    company.responsible = company.responsible ?? lead.owner

    if (lead.contact?.trim()) {
      const matchedSaved = savedContacts.find((contact) => contact.leadId === lead.id && contact.name.trim() === lead.contact.trim())
      if (!company.contacts.some((contact) => contact.name === lead.contact && contact.phones.includes(lead.phone))) {
        company.contacts.push({
          id: `lead-contact-${lead.id}`,
          name: lead.contact,
          role: lead.role || matchedSaved?.role || "",
          phones: [...new Set([lead.phone, matchedSaved?.phone].filter((value): value is string => Boolean(value)))],
          emails: matchedSaved?.email ? [matchedSaved.email] : [],
          telegram: matchedSaved?.telegram,
          contactMethods: matchedSaved?.contactMethods ?? [],
          leadId: lead.id,
          savedContactId: matchedSaved?.id,
          comment: matchedSaved?.comment || undefined,
          isPrimary: false,
        })
      }
    }
  }

  for (const contact of savedContacts) {
    const lead = leadById.get(contact.leadId)
    if (!lead || !contact.name.trim()) continue
    const company = getCompany(lead.company)
    if (!company) continue
    const existing = company.contacts.find((item) => item.id === `lead-contact-${lead.id}` && item.name === contact.name)
    if (existing) {
      if (contact.phone && !existing.phones.includes(contact.phone)) existing.phones.push(contact.phone)
      if (contact.email && !existing.emails.includes(contact.email)) existing.emails.push(contact.email)
      existing.telegram ||= contact.telegram
      existing.contactMethods = [...(existing.contactMethods ?? []), ...contact.contactMethods.filter((method) => !existing.contactMethods?.some((item) => item.id === method.id))]
      existing.leadId = contact.leadId
      existing.savedContactId = contact.id
      existing.role ||= contact.role
      existing.comment ||= contact.comment || undefined
    } else {
      company.contacts.push({
        id: `saved-contact-${contact.id}`,
        name: contact.name,
        role: contact.role,
        phones: contact.phone ? [contact.phone] : [],
        emails: contact.email ? [contact.email] : [],
        telegram: contact.telegram,
        contactMethods: contact.contactMethods,
        leadId: contact.leadId,
        savedContactId: contact.id,
        comment: contact.comment || undefined,
        isPrimary: false,
      })
    }
  }

  for (const deal of deals) {
    const company = getCompany(deal.company)
    if (!company) continue
    company.deals.push({
      id: deal.id,
      name: deal.service,
      stage: deal.stage,
      amount: parseRegistryAmount(deal.value),
    })
    company.responsible = company.responsible ?? deal.owner
  }

  const sourceCompanies = [...byName.values()]
  for (const company of sourceCompanies) {
    company.leads = sortNewest(company.leads)
    company.deals = sortNewest(company.deals)
    // Preserve the CRM's existing per-lead amount; avoid inventing an aggregation rule.
    company.leadAmount = company.leads.length === 1 ? company.leads[0].amount : undefined
    company.contractAmount = company.deals.length === 1 ? company.deals[0].amount : undefined
  }

  const realNames = new Set(sourceCompanies.map((company) => company.legalName))
  const merged = [...sourceCompanies]
  let contactCount = merged.reduce((count, company) => count + company.contacts.length, 0)

  for (const demo of demoCompanies) {
    if (realNames.has(demo.legalName)) continue
    if (merged.length >= 5 && contactCount >= 8) break
    const demoRow: CompanyViewModel = {
      ...demo,
      contacts: [...demo.contacts],
      leads: sortNewest([...demo.leads]),
      deals: sortNewest([...demo.deals]),
      isDemo: true,
    }
    merged.push(demoRow)
    contactCount += demoRow.contacts.length
  }

  return merged
}

export function flattenCompanyContacts(companies: CompanyViewModel[]): ContactViewModel[] {
  return companies.flatMap((company) => company.contacts.map((contact) => ({
    ...contact,
    companyId: company.id,
    companyName: company.legalName,
    createdAt: contact.createdAt ?? (company.isDemo ? company.createdAt : undefined),
    createdBy: contact.createdBy ?? (company.isDemo ? company.createdBy : undefined),
  })))
}
