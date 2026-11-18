"use client"

import { useMemo, useState } from "react"
import { ArrowUpDown, Building2, Check, ChevronDown, ChevronUp, ExternalLink, Mail, Phone, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { employees } from "@/lib/employees"
import { leadStages } from "@/lib/lead-stages"
import { cn } from "@/lib/utils"
import { leadStageColors, type LeadStage } from "@/lib/lead-stages"
import { parseRegistryDate, type CompanyViewModel, type RegistryContact, type RegistryRecord } from "@/lib/company-registry-data"
import { CompanyContactsDialog, CompanyRecordsDialog } from "@/components/company-registry-dialogs"
import type { SavedContact } from "@/app/actions/lead-records"
import type { CompanyContactMethod } from "@/lib/db/schema"

type SortKey = "name" | "record" | "createdAt" | "createdBy" | "leadAmount" | "contractAmount" | "customerDebt"
type SortDirection = "asc" | "desc"

const stageLabels: Record<(typeof leadStages)[number], string> = {
  "Новый лид": "Новый лид",
  "Подготовка КП": "Подготовка КП",
  "КП отправлено: ожидает решения": "КП отправлено",
  "Потенциальный": "Потенциальный",
  "Нецелевой лид": "Нецелевой",
  "Отложенный": "Отложенный",
  "Несостоявшийся": "Несостоявшийся",
}

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

export function CompaniesTable({
  companies,
  onCompanySelect,
  onContactsChange,
  onCompanyMethodsChange,
  onRecordSelect,
  onSavedContact,
}: {
  companies: CompanyViewModel[]
  onCompanySelect: (company: CompanyViewModel) => void
  onContactsChange: (companyId: string, contacts: RegistryContact[]) => void
  onCompanyMethodsChange: (companyId: string, methods: CompanyContactMethod[]) => Promise<void>
  onRecordSelect: (type: "Лид" | "Сделка", record: RegistryRecord) => boolean
  onSavedContact?: (contact: SavedContact) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "name", direction: "asc" })
  const [search, setSearch] = useState("")
  const [selectedCreators, setSelectedCreators] = useState<string[]>([])
  const [creatorSearch, setCreatorSearch] = useState("")
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [stageOpen, setStageOpen] = useState(false)
  const [directionFilter, setDirectionFilter] = useState("all")
  const [sortOpen, setSortOpen] = useState(false)
  const [contactsCompanyId, setContactsCompanyId] = useState<string | null>(null)
  const [recordsCompanyId, setRecordsCompanyId] = useState<string | null>(null)
  const contactsCompany = companies.find((company) => company.id === contactsCompanyId) ?? null
  const recordsCompany = companies.find((company) => company.id === recordsCompanyId) ?? null

  const creators = useMemo(() => [...new Set([...employees, ...companies.map((company) => company.createdBy).filter((value): value is string => Boolean(value))])].sort((a, b) => a.localeCompare(b, "ru")), [companies])
  const visibleCreators = creators.filter((creator) => creator.toLocaleLowerCase("ru").includes(creatorSearch.toLocaleLowerCase("ru").trim()))
  const directions = useMemo(() => [...new Set(companies.map((company) => company.direction).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "ru")), [companies])

  const rows = useMemo(() => {
    const terms = search.toLocaleLowerCase("ru").trim().split(/\s+/).filter(Boolean)
    const filtered = companies.filter((company) => {
      const primary = company.contacts.find((contact) => contact.isPrimary)
      const contactSearch = company.contacts.flatMap((contact) => [contact.name, contact.phones.join(" "), contact.emails.join(" "), contact.telegram ?? "", (contact.contactMethods ?? []).map((method) => `${method.provider ?? ""} ${method.value}`).join(" ")]).join(" ")
      const haystack = `${company.legalName} ${primary?.name ?? ""} ${contactSearch}`.toLocaleLowerCase("ru")
      const stageMatch = selectedStages.length === 0 || company.leads.some((lead) => selectedStages.includes(lead.stage))
      return terms.every((term) => haystack.includes(term))
        && (selectedCreators.length === 0 || selectedCreators.includes(company.createdBy ?? ""))
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
  }, [companies, directionFilter, search, selectedCreators, selectedStages, sort])

  const toggleSort = (key: SortKey) => setSort((current) => {
    if (current.key !== key) return { key, direction: key === "createdAt" ? "desc" : "asc" }
    return { key, direction: current.direction === "asc" ? "desc" : "asc" }
  })

  const sortOptions: Array<{ key: SortKey; label: string; ascendingLabel: string; descendingLabel: string; defaultDirection: SortDirection }> = [
    { key: "name", label: "Компания", ascendingLabel: "А–Я", descendingLabel: "Я–А", defaultDirection: "asc" },
    { key: "leadAmount", label: "Стоимость лида", ascendingLabel: "От меньшей к большей", descendingLabel: "От большей к меньшей", defaultDirection: "asc" },
    { key: "contractAmount", label: "Стоимость договора", ascendingLabel: "От меньшей к большей", descendingLabel: "От большей к меньшей", defaultDirection: "asc" },
    { key: "createdAt", label: "Дата создания", ascendingLabel: "Сначала старые", descendingLabel: "Сначала новые", defaultDirection: "desc" },
  ]

  const selectSort = (key: SortKey) => setSort((current) => current.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: key === "createdAt" ? "desc" : "asc" })

  const SortArrow = ({ column }: { column: SortKey }) => sort.key === column
    ? sort.direction === "asc" ? <ChevronUp aria-label="По возрастанию" /> : <ChevronDown aria-label="По убыванию" />
    : <ChevronDown className="table-sort-muted" aria-hidden="true" />

  const headers: Array<{ key: SortKey; label: string; align?: "right" }> = [
    { key: "name", label: "Компания" },
    { key: "record", label: "Лид / Сделки" },
    { key: "leadAmount", label: "Стоимость лида", align: "right" },
    { key: "contractAmount", label: "Стоимость договора", align: "right" },
    { key: "createdAt", label: "Дата создания" },
    { key: "createdBy", label: "Кто создал" },
  ]

  return (
    <div className="registry-page companies-registry-page">
      <div className="registry-toolbar">
        <label className="registry-search">
          <Search aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Компания, контакт, телефон или email" aria-label="Поиск компаний" />
        </label>
        <div className="registry-filters" aria-label="Фильтры компаний">
          <Popover open={creatorOpen} onOpenChange={(open) => { setCreatorOpen(open); if (open) { setStageOpen(false); setSortOpen(false) } }}>
            <PopoverTrigger asChild><button type="button" className="registry-stage-filter" aria-label={`Фильтр по создателям${selectedCreators.length ? `: выбрано ${selectedCreators.length}` : ""}`}>{selectedCreators.length ? `Создатели · ${selectedCreators.length}` : "Все создатели"}<ChevronDown aria-hidden="true" /></button></PopoverTrigger>
            <PopoverContent align="start" className="registry-stage-popover registry-creator-popover">
              <Input value={creatorSearch} onChange={(event) => setCreatorSearch(event.target.value)} placeholder="Поиск сотрудника..." aria-label="Поиск сотрудника" />
              <div className="registry-stage-options registry-creator-options" role="group" aria-label="Сотрудники-создатели">
                {visibleCreators.map((creator) => <label className="registry-stage-option" key={creator}><Checkbox checked={selectedCreators.includes(creator)} onCheckedChange={(checked) => setSelectedCreators((current) => checked ? [...current, creator] : current.filter((name) => name !== creator))} /><span>{creator}</span></label>)}
                {!visibleCreators.length && <span className="registry-muted">Сотрудники не найдены</span>}
              </div>
              <button type="button" className="registry-stage-clear" disabled={!selectedCreators.length} onClick={() => setSelectedCreators([])}>Очистить выбор</button>
            </PopoverContent>
          </Popover>
          <Popover open={stageOpen} onOpenChange={(open) => { setStageOpen(open); if (open) { setCreatorOpen(false); setSortOpen(false) } }}>
            <PopoverTrigger asChild><button type="button" className="registry-stage-filter" aria-label={`Фильтр по стадиям${selectedStages.length ? `: выбрано ${selectedStages.length}` : ""}`}>{selectedStages.length ? `Стадии · ${selectedStages.length}` : "Все стадии"}<ChevronDown aria-hidden="true" /></button></PopoverTrigger>
            <PopoverContent align="start" className="registry-stage-popover">
              <p className="registry-stage-description">Выберите стадии лидов, которым принадлежит компания</p>
              <div className="registry-stage-options" role="group" aria-label="Стадии лидов">
                {leadStages.map((stage) => <label className="registry-stage-option" key={stage}><Checkbox checked={selectedStages.includes(stage)} onCheckedChange={(checked) => setSelectedStages((current) => checked ? [...current, stage] : current.filter((item) => item !== stage))} /><span>{stageLabels[stage]}</span></label>)}
              </div>
              <button type="button" className="registry-stage-clear" disabled={!selectedStages.length} onClick={() => setSelectedStages([])}>Очистить выбор</button>
            </PopoverContent>
          </Popover>
          <select className="registry-filter-select" aria-label="Фильтр по направлению" value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}>
            <option value="all">Все направления</option>{directions.map((direction) => <option key={direction} value={direction}>{direction}</option>)}
          </select>
          <Popover open={sortOpen} onOpenChange={(open) => { setSortOpen(open); if (open) { setCreatorOpen(false); setStageOpen(false) } }}>
            <PopoverTrigger asChild><button type="button" className="lead-sort-trigger" aria-label="Сортировать по" title="Сортировать по"><ArrowUpDown aria-hidden="true" /></button></PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="lead-sort-popover">
              <div className="lead-sort-title">Сортировать по</div>
              <div className="lead-sort-options">{sortOptions.map((option) => { const active = sort.key === option.key; const direction = active ? sort.direction : option.defaultDirection; return <button key={option.key} type="button" className="lead-sort-option" aria-pressed={active} onClick={() => { selectSort(option.key); setSortOpen(false) }}><span className="lead-sort-option-label">{option.label}</span><span className="lead-sort-option-direction">{direction === "asc" ? option.ascendingLabel : option.descendingLabel}</span><span className="lead-sort-option-check" aria-hidden="true">{active && <Check />}</span></button> })}</div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <p className="registry-contact-summary" aria-live="polite">Всего компаний: {rows.length}</p>

      <div className="leads-table-shell registry-table-shell">
        <div className="leads-table-scroll">
          <table className="leads-table registry-table companies-registry-table">
            <caption className="sr-only">Реестр компаний, связанных лидов и сделок</caption>
            <thead><tr>
              <th aria-sort={sort.key === "name" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === "name" && "is-sorted")} onClick={() => toggleSort("name")}><span className="registry-sort-label">{headers[0].label}</span><SortArrow column="name" /></button></th>
              <th><span className="registry-static-header">Телефоны и почта</span></th>
              {headers.slice(1).map(({ key, label, align }) => <th key={key} aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === key && "is-sorted", align === "right" && "justify-end")} onClick={() => toggleSort(key)}><span className="registry-sort-label">{label}</span><SortArrow column={key} /></button></th>)}
            </tr></thead>
            <tbody>
              {rows.map((company) => {
                const latest = newestRecord(company)
                const relatedCount = company.leads.length + company.deals.length
                const latestType = latest && company.leads.some((record) => record.id === latest.id) ? "Лид" : "Сделка"
                return (
                  <tr key={company.id} tabIndex={0} aria-label={`Компания ${company.legalName}`} onClick={() => onCompanySelect(company)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onCompanySelect(company) } }}>
                    <td className="table-primary">
                      <div className="registry-company-name"><Building2 aria-hidden="true" /><div><strong><button type="button" className="registry-company-name-button" onClick={(event) => { event.stopPropagation(); onCompanySelect(company) }}>{company.legalName}</button>{company.isDemo && <Badge className="registry-demo-badge" variant="outline">Демо</Badge>}</strong></div></div>
                    </td>
                    <td><div className="registry-company-method-cell"><div className="registry-method-list">
                      {[...company.contactMethods.filter((method) => method.kind === "phone"), ...company.contactMethods.filter((method) => method.kind === "email")].map((method) => { const Icon = method.kind === "phone" ? Phone : Mail; return <a key={method.id} href={method.kind === "phone" ? `tel:${method.value.replace(/[^+\d]/g, "")}` : `mailto:${method.value}`} title={method.label || method.value} onClick={(event) => event.stopPropagation()}><Icon /><span>{method.value}</span></a> })}
                      {!company.contactMethods.length && <span className="registry-muted">Не добавлено</span>}
                    </div><Button className="registry-link-button" variant="ghost" size="icon" aria-label={`Изменить телефоны и почту компании ${company.legalName}`} title="Изменить телефоны и почту" onClick={(event) => { event.stopPropagation(); setContactsCompanyId(company.id) }}><ExternalLink /></Button></div></td>
                    <td>
                      <div className="registry-activity-cell">
                        {latest ? <button type="button" className="registry-record-summary" onClick={(event) => { event.stopPropagation(); if (!onRecordSelect(latestType, latest)) setRecordsCompanyId(company.id) }}><span className="registry-activity-title"><span className="registry-activity-kind">{latestType}</span><span className="registry-activity-name">{latest.name}</span></span><Badge className="registry-stage-badge" variant="secondary" data-kind={latestType.toLowerCase()} style={latestType === "Лид" && leadStageColors[latest.stage as LeadStage] ? { backgroundColor: `${leadStageColors[latest.stage as LeadStage]}22`, color: leadStageColors[latest.stage as LeadStage] } : undefined}>{latest.stage}</Badge></button> : <span className="registry-muted">Нет связанных записей</span>}
                        {relatedCount > 1 && <Button className="registry-link-button" variant="ghost" size="icon" aria-label={`Открыть лиды и сделки компании ${company.legalName}`} title="Лиды и сделки компании" onClick={(event) => { event.stopPropagation(); setRecordsCompanyId(company.id) }}><ExternalLink /></Button>}
                      </div>
                    </td>
                    <td className="table-amount">{formatMoney(company.leadAmount)}</td>
                    <td className="table-amount">{formatMoney(company.contractAmount)}</td>
                    <td>{formatDate(company.createdAt)}</td>
                    <td><div className="registry-creator">{company.createdBy && <span className="table-avatar">{company.createdBy.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>}{company.createdBy || "—"}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length && <div className="leads-table-empty">Компании не найдены. Измените поиск или фильтры.</div>}
        </div>
      </div>
      <p className="registry-footnote">Демонстрационные строки помечены «Демо»; их изменения остаются только в интерфейсе. Данные контактов реальных компаний сохраняются в CRM.</p>
      <CompanyContactsDialog company={contactsCompany} open={Boolean(contactsCompany)} onOpenChange={(open) => { if (!open) setContactsCompanyId(null) }} onContactsChange={(contacts) => { if (contactsCompany) onContactsChange(contactsCompany.id, contacts) }} onCompanyMethodsChange={(methods) => { if (!contactsCompany) return Promise.reject(new Error("Компания не найдена")); return onCompanyMethodsChange(contactsCompany.id, methods) }} onSavedContact={onSavedContact} />
      <CompanyRecordsDialog company={recordsCompany} open={Boolean(recordsCompany)} onOpenChange={(open) => { if (!open) setRecordsCompanyId(null) }} onRecordSelect={onRecordSelect} />
    </div>
  )
}
