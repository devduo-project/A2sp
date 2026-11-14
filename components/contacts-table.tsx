"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Mail, Phone, Search, UserRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { parseRegistryDate, type ContactViewModel } from "@/lib/company-registry-data"

interface ContactsTableProps {
  contacts: ContactViewModel[]
  onContactSelect: (contact: ContactViewModel) => void
  onCompanySelect: (companyId: string) => void
}

type SortKey = "name" | "company" | "role" | "phone" | "email" | "messenger" | "createdAt" | "createdBy"
type SortDirection = "asc" | "desc"

function formatDate(value?: string) {
  const timestamp = parseRegistryDate(value)
  return timestamp === undefined ? "—" : new Intl.DateTimeFormat("ru-RU").format(timestamp)
}

function compareDate(direction: SortDirection, a?: string, b?: string) {
  const left = parseRegistryDate(a)
  const right = parseRegistryDate(b)
  if (left === undefined || right === undefined) return left === right ? 0 : left === undefined ? 1 : -1
  return direction === "asc" ? left - right : right - left
}

export function ContactsTable({ contacts, onContactSelect, onCompanySelect }: ContactsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "name", direction: "asc" })
  const [search, setSearch] = useState("")
  const [primaryFilter, setPrimaryFilter] = useState("all")

  const rows = useMemo(() => {
    const terms = search.toLocaleLowerCase("ru").trim().split(/\s+/).filter(Boolean)
    return contacts.filter((contact) => {
      const haystack = `${contact.name} ${contact.companyName} ${contact.role} ${contact.phones.join(" ")} ${contact.emails.join(" ")} ${contact.telegram ?? ""} ${(contact.contactMethods ?? []).map((method) => `${method.provider ?? ""} ${method.value}`).join(" ")}`.toLocaleLowerCase("ru")
      return terms.every((term) => haystack.includes(term))
        && (primaryFilter === "all" || (primaryFilter === "primary" ? contact.isPrimary : !contact.isPrimary))
    }).sort((a, b) => {
      if (sort.key === "createdAt") return compareDate(sort.direction, a.createdAt, b.createdAt)
      const left = sort.key === "name" ? a.name : sort.key === "company" ? a.companyName : sort.key === "role" ? a.role : sort.key === "phone" ? `${a.phones.join(" ")} ${(a.contactMethods ?? []).filter((method) => method.kind === "phone").map((method) => method.value).join(" ")}` : sort.key === "email" ? `${a.emails.join(" ")} ${(a.contactMethods ?? []).filter((method) => method.kind === "email").map((method) => method.value).join(" ")}` : sort.key === "messenger" ? `${a.telegram ?? ""} ${(a.contactMethods ?? []).filter((method) => method.kind === "messenger").map((method) => method.value).join(" ")}` : a.createdBy ?? ""
      const right = sort.key === "name" ? b.name : sort.key === "company" ? b.companyName : sort.key === "role" ? b.role : sort.key === "phone" ? `${b.phones.join(" ")} ${(b.contactMethods ?? []).filter((method) => method.kind === "phone").map((method) => method.value).join(" ")}` : sort.key === "email" ? `${b.emails.join(" ")} ${(b.contactMethods ?? []).filter((method) => method.kind === "email").map((method) => method.value).join(" ")}` : sort.key === "messenger" ? `${b.telegram ?? ""} ${(b.contactMethods ?? []).filter((method) => method.kind === "messenger").map((method) => method.value).join(" ")}` : b.createdBy ?? ""
      const result = left.localeCompare(right, "ru")
      return sort.direction === "asc" ? result : -result
    })
  }, [contacts, primaryFilter, search, sort])

  const toggleSort = (key: SortKey) => setSort((current) => {
    if (current.key !== key) return { key, direction: key === "createdAt" ? "desc" : "asc" }
    return { key, direction: current.direction === "asc" ? "desc" : "asc" }
  })
  const SortArrow = ({ column }: { column: SortKey }) => sort.key === column
    ? sort.direction === "asc" ? <ChevronUp aria-label="По возрастанию" /> : <ChevronDown aria-label="По убыванию" />
    : <ChevronDown className="table-sort-muted" aria-hidden="true" />

  const headers: Array<{ key: SortKey; label: string }> = [
    { key: "name", label: "Контакт" },
    { key: "company", label: "Компания" },
    { key: "role", label: "Должность" },
    { key: "createdAt", label: "Дата создания" },
    { key: "createdBy", label: "Создал" },
  ]

  return (
    <div className="registry-page">
      <div className="registry-toolbar">
        <label className="registry-search">
          <Search aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, компания, телефон, email или мессенджер" aria-label="Поиск контактов" />
        </label>
        <div className="registry-filters" aria-label="Фильтры контактов">
          <select className="registry-filter-select" aria-label="Фильтр по роли контакта" value={primaryFilter} onChange={(event) => setPrimaryFilter(event.target.value)}>
            <option value="all">Все контакты</option><option value="primary">Основные контакты</option><option value="other">Остальные контакты</option>
          </select>
        </div>
      </div>
      <div className="leads-table-shell registry-table-shell">
        <div className="leads-table-scroll">
          <table className="leads-table registry-table contacts-registry-table">
            <caption className="sr-only">Реестр контактов</caption>
            <thead><tr>
              {headers.slice(0, 3).map(({ key, label }) => <th key={key} aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === key && "is-sorted")} onClick={() => toggleSort(key)}>{label}<SortArrow column={key} /></button></th>)}
              {(["phone", "email", "messenger"] as const).map((key) => <th key={key} aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === key && "is-sorted")} onClick={() => toggleSort(key)}>{key === "phone" ? "Телефон" : key === "email" ? "Email" : "Мессенджеры"}<SortArrow column={key} /></button></th>)}
              {headers.slice(3).map(({ key, label }) => <th key={key} aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === key && "is-sorted")} onClick={() => toggleSort(key)}>{label}<SortArrow column={key} /></button></th>)}
            </tr></thead>
            <tbody>
              {rows.map((contact) => <tr key={contact.id} tabIndex={0} aria-label={`Контакт ${contact.name}`} onClick={() => onContactSelect(contact)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onContactSelect(contact) } }}>
                <td className="table-primary"><span className="registry-person"><span className="registry-person-avatar"><UserRound /></span><button type="button" className="registry-contact-name-button" onClick={(event) => { event.stopPropagation(); onContactSelect(contact) }}><strong>{contact.name}</strong></button></span></td>
                <td><button type="button" className="registry-company-link" onClick={(event) => { event.stopPropagation(); onCompanySelect(contact.companyId) }}>{contact.companyName}</button></td>
                <td>{contact.role || "—"}</td>
                <td>{contact.phones.length || contact.contactMethods?.some((method) => method.kind === "phone") ? <div className="registry-method-list">{contact.phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^+\d]/g, "")}`} onClick={(event) => event.stopPropagation()}><Phone />{phone}</a>)}{(contact.contactMethods ?? []).filter((method) => method.kind === "phone").map((method) => <a key={method.id} href={`tel:${method.value.replace(/[^+\d]/g, "")}`} onClick={(event) => event.stopPropagation()}><Phone />{method.value}</a>)}</div> : "—"}</td>
                <td>{contact.emails.length || contact.contactMethods?.some((method) => method.kind === "email") ? <div className="registry-method-list">{contact.emails.map((email) => <a key={email} href={`mailto:${email}`} onClick={(event) => event.stopPropagation()}><Mail />{email}</a>)}{(contact.contactMethods ?? []).filter((method) => method.kind === "email").map((method) => <a key={method.id} href={`mailto:${method.value}`} onClick={(event) => event.stopPropagation()}><Mail />{method.value}</a>)}</div> : "—"}</td>
                <td>{contact.telegram || contact.contactMethods?.some((method) => method.kind === "messenger" && method.id !== "__telegram__") ? <div className="registry-method-list">{contact.telegram && <a href={contact.telegram.startsWith("http") ? contact.telegram : `https://t.me/${contact.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Telegram: {contact.telegram}</a>}{(contact.contactMethods ?? []).filter((method) => method.kind === "messenger" && method.id !== "__telegram__").map((method) => <span key={method.id}>{method.provider}: {method.value}</span>)}</div> : "—"}</td>
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
