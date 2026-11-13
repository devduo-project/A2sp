"use client"

import { useMemo, useState } from "react"
import { Building2, ChevronDown, ChevronUp, ExternalLink, Mail, Phone, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { leadStageColors, type LeadStage } from "@/lib/lead-stages"
import { parseRegistryDate, type CompanyViewModel, type RegistryContact, type RegistryRecord } from "@/lib/company-registry-data"
import { CompanyContactsDialog, CompanyRecordsDialog } from "@/components/company-registry-dialogs"

type SortKey = "name" | "record" | "createdAt" | "createdBy" | "leadAmount" | "contractAmount" | "customerDebt"
type SortDirection = "asc" | "desc"

const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 })
const formatMoney = (value?: number) => value === undefined || !Number.isFinite(value) ? "—" : `${moneyFormatter.format(value)} ₽`
const formatDate = (value?: string) => {
  const time = parseRegistryDate(value)
  return time === undefined ? "—" : new Intl.DateTimeFormat("ru-RU").format(time)
}
const compareMissingLast = (a: number | undefined, b: number | undefined, direction: SortDirection) => {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1
  return direction === "asc" ? a - b : b - a
}

function newestRecord(company: CompanyViewModel) {
  const records = [...company.leads, ...company.deals]
  if (!records.length) return undefined
  return [...records].sort((a, b) => (parseRegistryDate(b.createdAt) ?? 0) - (parseRegistryDate(a.createdAt) ?? 0))[0]
}

function hasContactDetailsBeyondPrimary(company: CompanyViewModel) {
  const primary = company.contacts.find((contact) => contact.isPrimary)
  return company.contacts.some((contact) => {
    if (contact.id !== primary?.id) return contact.phones.length > 0 || contact.emails.length > 0
    return contact.phones.length > 1 || contact.emails.length > 1
  }) || (!primary && company.contacts.some((contact) => contact.phones.length || contact.emails.length))
}

export function CompaniesTable({
  companies,
  onCompanySelect,
  onContactsChange,
  onRecordSelect,
}: {
  companies: CompanyViewModel[]
  onCompanySelect: (company: CompanyViewModel) => void
  onContactsChange: (companyId: string, contacts: RegistryContact[]) => void
  onRecordSelect: (type: "Лид" | "Сделка", record: RegistryRecord) => boolean
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "name", direction: "asc" })
  const [search, setSearch] = useState("")
  const [creatorFilter, setCreatorFilter] = useState("all")
  const [responsibleFilter, setResponsibleFilter] = useState("all")
  const [stageFilter, setStageFilter] = useState("all")
  const [directionFilter, setDirectionFilter] = useState("all")
  const [contactsCompanyId, setContactsCompanyId] = useState<string | null>(null)
  const [recordsCompanyId, setRecordsCompanyId] = useState<string | null>(null)
  const contactsCompany = companies.find((company) => company.id === contactsCompanyId) ?? null
  const recordsCompany = companies.find((company) => company.id === recordsCompanyId) ?? null

  const creators = useMemo(() => [...new Set(companies.map((company) => company.createdBy).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "ru")), [companies])
  const responsibles = useMemo(() => [...new Set(companies.map((company) => company.responsible).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "ru")), [companies])
  const stages = useMemo(() => [...new Set(companies.flatMap((company) => [...company.leads, ...company.deals].map((record) => record.stage)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [companies])
  const directions = useMemo(() => [...new Set(companies.map((company) => company.direction).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "ru")), [companies])

  const rows = useMemo(() => {
    const terms = search.toLocaleLowerCase("ru").trim().split(/\s+/).filter(Boolean)
    const filtered = companies.filter((company) => {
      const primary = company.contacts.find((contact) => contact.isPrimary)
      const contactSearch = company.contacts.flatMap((contact) => [contact.name, contact.phones.join(" "), contact.emails.join(" ")]).join(" ")
      const haystack = `${company.legalName} ${primary?.name ?? ""} ${contactSearch}`.toLocaleLowerCase("ru")
      const stageMatch = stageFilter === "all" || [...company.leads, ...company.deals].some((record) => record.stage === stageFilter)
      return terms.every((term) => haystack.includes(term))
        && (creatorFilter === "all" || company.createdBy === creatorFilter)
        && (responsibleFilter === "all" || company.responsible === responsibleFilter)
        && stageMatch
        && (directionFilter === "all" || company.direction === directionFilter)
    })

    return filtered.sort((a, b) => {
      let result = 0
      if (sort.key === "name") result = a.legalName.localeCompare(b.legalName, "ru")
      if (sort.key === "record") {
        const aDate = parseRegistryDate(newestRecord(a)?.createdAt)
        const bDate = parseRegistryDate(newestRecord(b)?.createdAt)
        return compareMissingLast(aDate, bDate, sort.direction)
      }
      if (sort.key === "createdAt") return compareMissingLast(parseRegistryDate(a.createdAt), parseRegistryDate(b.createdAt), sort.direction)
      if (sort.key === "createdBy") result = (a.createdBy ?? "").localeCompare(b.createdBy ?? "", "ru")
      if (sort.key === "leadAmount") return compareMissingLast(a.leadAmount, b.leadAmount, sort.direction)
      if (sort.key === "contractAmount") return compareMissingLast(a.contractAmount, b.contractAmount, sort.direction)
      if (sort.key === "customerDebt") return compareMissingLast(a.customerDebt, b.customerDebt, sort.direction)
      return sort.direction === "asc" ? result : -result
    })
  }, [companies, creatorFilter, directionFilter, responsibleFilter, search, sort, stageFilter])

  const toggleSort = (key: SortKey) => setSort((current) => {
    if (current.key !== key) return { key, direction: key === "createdAt" ? "desc" : "asc" }
    return { key, direction: current.direction === "asc" ? "desc" : "asc" }
  })

  const SortArrow = ({ column }: { column: SortKey }) => sort.key === column
    ? sort.direction === "asc" ? <ChevronUp aria-label="По возрастанию" /> : <ChevronDown aria-label="По убыванию" />
    : <ChevronDown className="table-sort-muted" aria-hidden="true" />

  const headers: Array<{ key: SortKey; label: string; align?: "right" }> = [
    { key: "name", label: "Компания" },
    { key: "record", label: "Лид / Сделки" },
    { key: "createdAt", label: "Дата создания" },
    { key: "createdBy", label: "Создал" },
    { key: "leadAmount", label: "Стоимость лида", align: "right" },
    { key: "contractAmount", label: "Стоимость договора", align: "right" },
    { key: "customerDebt", label: "Задолженность заказчика", align: "right" },
  ]

  return (
    <div className="registry-page">
      <div className="registry-toolbar">
        <label className="registry-search">
          <Search aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Компания, контакт, телефон или email" aria-label="Поиск компаний" />
        </label>
        <div className="registry-filters" aria-label="Фильтры компаний">
          <select className="registry-filter-select" aria-label="Фильтр по создателю" value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)}>
            <option value="all">Все создатели</option>{creators.map((creator) => <option key={creator} value={creator}>{creator}</option>)}
          </select>
          <select className="registry-filter-select" aria-label="Фильтр по ответственному" value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)}>
            <option value="all">Все ответственные</option>{responsibles.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select className="registry-filter-select" aria-label="Фильтр по стадии" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
            <option value="all">Все стадии</option>{stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
          <select className="registry-filter-select" aria-label="Фильтр по направлению" value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}>
            <option value="all">Все направления</option>{directions.map((direction) => <option key={direction} value={direction}>{direction}</option>)}
          </select>
        </div>
      </div>

      <div className="leads-table-shell registry-table-shell">
        <div className="leads-table-scroll">
          <table className="leads-table registry-table companies-registry-table">
            <caption className="sr-only">Реестр компаний, связанных лидов и сделок</caption>
            <thead><tr>
              <th aria-sort={sort.key === "name" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === "name" && "is-sorted")} onClick={() => toggleSort("name")}>{headers[0].label}<SortArrow column="name" /></button></th>
              <th><span className="registry-static-header">Контакты компании</span></th>
              {headers.slice(1).map(({ key, label, align }) => <th key={key} aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === key && "is-sorted", align === "right" && "justify-end")} onClick={() => toggleSort(key)}>{label}<SortArrow column={key} /></button></th>)}
            </tr></thead>
            <tbody>
              {rows.map((company) => {
                const primary = company.contacts.find((contact) => contact.isPrimary)
                const latest = newestRecord(company)
                const relatedCount = company.leads.length + company.deals.length
                const hasAdditionalContacts = hasContactDetailsBeyondPrimary(company)
                const latestType = latest && company.leads.some((record) => record.id === latest.id) ? "Лид" : "Сделка"
                return (
                  <tr key={company.id} tabIndex={0} aria-label={`Компания ${company.legalName}`} onClick={() => onCompanySelect(company)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onCompanySelect(company) } }}>
                    <td className="table-primary">
                      <div className="registry-company-name"><Building2 aria-hidden="true" /><div><strong><button type="button" className="registry-company-name-button" onClick={(event) => { event.stopPropagation(); onCompanySelect(company) }}>{company.legalName}</button>{company.isDemo && <Badge className="registry-demo-badge" variant="outline">Демо</Badge>}</strong><button type="button" className="registry-primary-contact-link" onClick={(event) => { event.stopPropagation(); setContactsCompanyId(company.id) }}>{primary?.name || "Основной контакт не указан"}</button></div></div>
                    </td>
                    <td>
                      <div className="registry-contact-cell">
                        <div className="registry-contact-cell-content">
                          {primary?.phones[0] && <a href={`tel:${primary.phones[0].replace(/[^+\d]/g, "")}`} onClick={(event) => event.stopPropagation()}><Phone />{primary.phones[0]}</a>}
                          {primary?.emails[0] && <a href={`mailto:${primary.emails[0]}`} onClick={(event) => event.stopPropagation()}><Mail />{primary.emails[0]}</a>}
                          {!primary && <span className="registry-muted">Нет основного контакта</span>}
                        </div>
                        {hasAdditionalContacts && <Button className="registry-link-button" variant="ghost" size="icon" aria-label={`Открыть контакты компании ${company.legalName}`} title="Контакты компании" onClick={(event) => { event.stopPropagation(); setContactsCompanyId(company.id) }}><ExternalLink /></Button>}
                      </div>
                    </td>
                    <td>
                      <div className="registry-activity-cell">
                        {latest ? <button type="button" className="registry-record-summary" onClick={(event) => { event.stopPropagation(); if (!onRecordSelect(latestType, latest)) setRecordsCompanyId(company.id) }}><span className="registry-activity-kind">{latestType}</span><span className="registry-activity-name">{latest.name}</span><Badge className="registry-stage-badge" variant="secondary" data-kind={latestType.toLowerCase()} style={latestType === "Лид" && leadStageColors[latest.stage as LeadStage] ? { backgroundColor: `${leadStageColors[latest.stage as LeadStage]}22`, color: leadStageColors[latest.stage as LeadStage] } : undefined}>{latest.stage}</Badge></button> : <span className="registry-muted">Нет связанных записей</span>}
                        {relatedCount > 1 && <Button className="registry-link-button" variant="ghost" size="icon" aria-label={`Открыть лиды и сделки компании ${company.legalName}`} title="Лиды и сделки компании" onClick={(event) => { event.stopPropagation(); setRecordsCompanyId(company.id) }}><ExternalLink /></Button>}
                      </div>
                    </td>
                    <td>{formatDate(company.createdAt)}</td>
                    <td><div className="registry-creator">{company.createdBy && <span className="table-avatar">{company.createdBy.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>}{company.createdBy || "—"}</div></td>
                    <td className="table-amount">{formatMoney(company.leadAmount)}</td>
                    <td className="table-amount">{formatMoney(company.contractAmount)}</td>
                    <td className="table-amount">{formatMoney(company.customerDebt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length && <div className="leads-table-empty">Компании не найдены. Измените поиск или фильтры.</div>}
        </div>
      </div>
      <p className="registry-footnote">Демонстрационные строки помечены «Демо». Изменения контактов применяются только в текущем интерфейсе.</p>
      <CompanyContactsDialog company={contactsCompany} open={Boolean(contactsCompany)} onOpenChange={(open) => { if (!open) setContactsCompanyId(null) }} onContactsChange={(contacts) => { if (contactsCompany) onContactsChange(contactsCompany.id, contacts) }} />
      <CompanyRecordsDialog company={recordsCompany} open={Boolean(recordsCompany)} onOpenChange={(open) => { if (!open) setRecordsCompanyId(null) }} onRecordSelect={onRecordSelect} />
    </div>
  )
}
