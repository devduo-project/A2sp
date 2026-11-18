"use client"

import { useMemo, useState } from "react"
import { ArrowUpDown, Check, ChevronDown, ChevronUp, Mail, Phone, Search } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Lead } from "@/components/lead-card"
import { leadStages } from "@/lib/lead-stages"
import { cn } from "@/lib/utils"
import { parseRegistryDate, type ContactViewModel } from "@/lib/company-registry-data"

interface ContactsTableProps {
  contacts: ContactViewModel[]
  leads: Lead[]
  onContactSelect: (contact: ContactViewModel) => void
  onCompanySelect: (companyId: string) => void
}

type SortKey = "name" | "company" | "createdBy"
type SortDirection = "asc" | "desc"

function formatDate(value?: string) {
  const timestamp = parseRegistryDate(value)
  return timestamp === undefined ? "—" : new Intl.DateTimeFormat("ru-RU").format(timestamp)
}

export function ContactsTable({ contacts, leads, onContactSelect, onCompanySelect }: ContactsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "name", direction: "asc" })
  const [search, setSearch] = useState("")
  const [primaryFilter, setPrimaryFilter] = useState("all")
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [sortOpen, setSortOpen] = useState(false)
  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads])

  const rows = useMemo(() => {
    const terms = search.toLocaleLowerCase("ru").trim().split(/\s+/).filter(Boolean)
    return contacts.filter((contact) => {
      const haystack = `${contact.name} ${contact.companyName} ${contact.role} ${contact.phones.join(" ")} ${contact.emails.join(" ")} ${contact.telegram ?? ""} ${(contact.contactMethods ?? []).map((method) => `${method.provider ?? ""} ${method.value}`).join(" ")}`.toLocaleLowerCase("ru")
      const linkedLead = contact.leadId ? leadById.get(contact.leadId) : undefined
      return terms.every((term) => haystack.includes(term))
        && (primaryFilter === "all" || (primaryFilter === "primary" ? contact.isPrimary : !contact.isPrimary))
        && (selectedStages.length === 0 || Boolean(linkedLead && selectedStages.includes(linkedLead.stage)))
    }).sort((a, b) => {
      const left = sort.key === "name" ? a.name : sort.key === "company" ? a.companyName : a.createdBy ?? ""
      const right = sort.key === "name" ? b.name : sort.key === "company" ? b.companyName : b.createdBy ?? ""
      const result = left.localeCompare(right, "ru", { sensitivity: "base" })
      return sort.direction === "asc" ? result : -result
    })
  }, [contacts, leadById, primaryFilter, search, selectedStages, sort])

  const SortArrow = ({ column }: { column: SortKey }) => sort.key === column
    ? sort.direction === "asc" ? <ChevronUp aria-label="По возрастанию" /> : <ChevronDown aria-label="По убыванию" />
    : <ChevronDown className="table-sort-muted" aria-hidden="true" />

  const sortOptions: Array<{ key: SortKey; label: string; ascendingLabel: string; descendingLabel: string }> = [
    { key: "name", label: "Контакт", ascendingLabel: "А–Я", descendingLabel: "Я–А" },
    { key: "company", label: "Компания", ascendingLabel: "А–Я", descendingLabel: "Я–А" },
    { key: "createdBy", label: "Кто создал", ascendingLabel: "А–Я", descendingLabel: "Я–А" },
  ]

  const toggleSort = (key: SortKey) => setSort((current) => ({
    key,
    direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
  }))

  return (
    <div className="registry-page contacts-registry-page">
      <div className="registry-toolbar">
        <label className="registry-search">
          <Search aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, компания, телефон, email или мессенджер" aria-label="Поиск контактов" />
        </label>
        <div className="registry-filters" aria-label="Фильтры контактов">
          <select className="registry-filter-select" aria-label="Фильтр по роли контакта" value={primaryFilter} onChange={(event) => setPrimaryFilter(event.target.value)}>
            <option value="all">Все контакты</option><option value="primary">Основные контакты</option><option value="other">Остальные контакты</option>
          </select>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="registry-stage-filter" aria-label={`Фильтр по стадиям лидов${selectedStages.length ? `: выбрано ${selectedStages.length}` : ""}`}>
                Стадия{selectedStages.length > 0 ? ` · ${selectedStages.length}` : ""}<ChevronDown aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="registry-stage-popover">
              <p className="registry-stage-description">Выберите стадии лидов, которым принадлежит контакт</p>
              <div className="registry-stage-options" role="group" aria-label="Стадии лидов">
                {leadStages.map((stage) => {
                  const checked = selectedStages.includes(stage)
                  return <label className="registry-stage-option" key={stage}>
                    <Checkbox checked={checked} onCheckedChange={(next) => setSelectedStages((current) => next ? [...current, stage] : current.filter((item) => item !== stage))} />
                    <span>{stage}</span>
                  </label>
                })}
              </div>
              <button type="button" className="registry-stage-clear" disabled={selectedStages.length === 0} onClick={() => setSelectedStages([])}>Очистить выбор</button>
            </PopoverContent>
          </Popover>
          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="lead-sort-trigger" aria-label="Сортировать по" title="Сортировать по"><ArrowUpDown aria-hidden="true" /></button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="lead-sort-popover">
              <div className="lead-sort-title">Сортировать по</div>
              <div className="lead-sort-options">
                {sortOptions.map((option) => {
                  const isActive = sort.key === option.key
                  return <button key={option.key} type="button" className="lead-sort-option" aria-pressed={isActive} onClick={() => { toggleSort(option.key); setSortOpen(false) }}>
                    <span className="lead-sort-option-label">{option.label}</span>
                    <span className="lead-sort-option-direction">{isActive && sort.direction === "desc" ? option.descendingLabel : option.ascendingLabel}</span>
                    <span className="lead-sort-option-check" aria-hidden="true">{isActive && <Check />}</span>
                  </button>
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <p className="registry-contact-summary" aria-live="polite">Всего контактов: {contacts.length}</p>
      <div className="leads-table-shell registry-table-shell">
        <div className="leads-table-scroll">
          <table className="leads-table registry-table contacts-registry-table">
            <caption className="sr-only">Реестр контактов</caption>
            <thead><tr>
              <th aria-sort={sort.key === "name" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === "name" && "is-sorted")} onClick={() => toggleSort("name")}>Контакт<SortArrow column="name" /></button></th>
              <th aria-sort={sort.key === "company" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === "company" && "is-sorted")} onClick={() => toggleSort("company")}>Компания<SortArrow column="company" /></button></th>
              <th><span className="registry-static-header">Телефон</span></th>
              <th><span className="registry-static-header">Email</span></th>
              <th><span className="registry-static-header">Мессенджеры</span></th>
              <th><span className="registry-static-header">Дата создания</span></th>
              <th aria-sort={sort.key === "createdBy" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === "createdBy" && "is-sorted")} onClick={() => toggleSort("createdBy")}>Кто создал<SortArrow column="createdBy" /></button></th>
            </tr></thead>
            <tbody>
              {rows.map((contact) => <tr key={contact.id} tabIndex={0} aria-label={`Контакт ${contact.name}`} onClick={() => onContactSelect(contact)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onContactSelect(contact) } }}>
                <td className="table-primary"><div className="registry-person"><button type="button" className="registry-contact-name-button" onClick={(event) => { event.stopPropagation(); onContactSelect(contact) }}><strong>{contact.name}</strong></button>{contact.role && <span className="registry-contact-role">{contact.role}</span>}</div></td>
                <td><button type="button" className="registry-company-link" onClick={(event) => { event.stopPropagation(); onCompanySelect(contact.companyId) }}>{contact.companyName}</button></td>
                <td>{contact.phones.length || contact.contactMethods?.some((method) => method.kind === "phone") ? <div className="registry-method-list">{contact.phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^+\d]/g, "")}`} onClick={(event) => event.stopPropagation()}><Phone />{phone}</a>)}{(contact.contactMethods ?? []).filter((method) => method.kind === "phone").map((method) => <a key={method.id} href={`tel:${method.value.replace(/[^+\d]/g, "")}`} onClick={(event) => event.stopPropagation()}><Phone />{method.value}</a>)}</div> : "—"}</td>
                <td>{contact.emails.length || contact.contactMethods?.some((method) => method.kind === "email") ? <div className="registry-method-list">{contact.emails.map((email) => <a key={email} href={`mailto:${email}`} onClick={(event) => event.stopPropagation()}><Mail />{email}</a>)}{(contact.contactMethods ?? []).filter((method) => method.kind === "email").map((method) => <a key={method.id} href={`mailto:${method.value}`} onClick={(event) => event.stopPropagation()}><Mail />{method.value}</a>)}</div> : "—"}</td>
                <td>{contact.telegram || contact.contactMethods?.some((method) => method.kind === "messenger" && method.id !== "__telegram__") ? <div className="registry-method-list">{contact.telegram && <a href={contact.telegram.startsWith("http") ? contact.telegram : `https://t.me/${contact.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><span className="registry-messenger-category">Telegram:</span><span>{contact.telegram}</span></a>}{(contact.contactMethods ?? []).filter((method) => method.kind === "messenger" && method.id !== "__telegram__").map((method) => <span className="registry-messenger-item" key={method.id}><span className="registry-messenger-category">{method.provider}:</span><span>{method.value}</span></span>)}</div> : "—"}</td>
                <td>{formatDate(contact.createdAt)}</td>
                <td><div className="registry-creator">{contact.createdBy && <span className="table-avatar">{contact.createdBy.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>}{contact.createdBy || "—"}</div></td>
              </tr>)}
            </tbody>
          </table>
          {!rows.length && <div className="leads-table-empty">Контакты не найдены. Измените поиск или фильтры.</div>}
        </div>
      </div>
      <p className="registry-footnote">Контактные данные сохраняются и доступны во всех разделах.</p>
    </div>
  )
}
