"use client"

import { useState } from "react"
import { Building2, Check, ChevronDown, Columns3, RotateCcw, Search, SearchX, UserRound, Wrench, X, type LucideIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { employees } from "@/lib/employees"
import type { Lead } from "@/components/lead-card"

export type FilterKey = "owner" | "direction" | "workType" | "stage"
export type LeadFilterState = Record<FilterKey, string[]>
export type LeadFilterOptions = Record<FilterKey, string[]>

export const emptyLeadFilters: LeadFilterState = { owner: [], direction: [], workType: [], stage: [] }

const filterDefinitions: { key: FilterKey; label: string; icon: LucideIcon }[] = [
  { key: "owner", label: "Ответственный", icon: UserRound },
  { key: "direction", label: "Направление", icon: Building2 },
  { key: "workType", label: "Тип работы", icon: Wrench },
  { key: "stage", label: "Стадия", icon: Columns3 },
]

export function leadFilterValue(lead: Lead, key: FilterKey) {
  if (key === "owner") return lead.owner
  if (key === "direction") return lead.direction ?? "А2-СП"
  if (key === "workType") return lead.request
  return lead.stage
}

export function matchesLeadFilters(lead: Lead, filters: LeadFilterState) {
  return filterDefinitions.every(({ key }) => filters[key].length === 0 || filters[key].includes(leadFilterValue(lead, key)))
}

export function buildLeadFilterOptions(leads: Lead[], stages: readonly string[]): LeadFilterOptions {
  const unique = (key: Exclude<FilterKey, "stage">) => [...new Set(leads.map(lead => leadFilterValue(lead, key)).filter(Boolean))]
  return { owner: [...new Set([...employees, ...unique("owner")])], direction: unique("direction"), workType: unique("workType"), stage: [...stages] }
}

export function countActiveFilters(filters: LeadFilterState) {
  return filterDefinitions.reduce((total, { key }) => total + filters[key].length, 0)
}

function toggleValue(filters: LeadFilterState, key: FilterKey, value: string): LeadFilterState {
  const current = filters[key]
  return { ...filters, [key]: current.includes(value) ? current.filter(item => item !== value) : [...current, value] }
}

type FilterProps = {
  options: LeadFilterOptions
  value: LeadFilterState
  onChange: (next: LeadFilterState) => void
}

function OptionList({ label, options, selected, onToggle, searchable }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void; searchable?: boolean }) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const visible = needle ? options.filter(option => option.toLowerCase().includes(needle)) : options
  return (
    <>
      {searchable && (
        <div className="filter-search">
          <Search aria-hidden="true" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по сотрудникам" aria-label="Поиск по сотрудникам" autoFocus />
        </div>
      )}
      <ul className="filter-options" role="listbox" aria-label={label} aria-multiselectable="true">
        {visible.map(option => {
          const checked = selected.includes(option)
          return (
            <li key={option} role="presentation">
              <button type="button" role="option" aria-selected={checked} className="filter-option" data-checked={checked} onClick={() => onToggle(option)}>
                <span className="filter-check" aria-hidden="true">{checked && <Check />}</span>
                <span className="filter-option-label">{option}</span>
              </button>
            </li>
          )
        })}
        {visible.length === 0 && <li className="filter-options-empty">{options.length === 0 ? "Нет значений" : "Ничего не найдено"}</li>}
      </ul>
    </>
  )
}

function FilterDropdown({ definition, options, value, onChange }: FilterProps & { definition: (typeof filterDefinitions)[number] }) {
  const { key, label, icon: Icon } = definition
  const selected = value[key]
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="filter-trigger" data-active={selected.length > 0} aria-label={`${label}${selected.length ? `: выбрано ${selected.length}` : ""}`}>
          <Icon aria-hidden="true" />
          <span className="filter-trigger-label">{label}</span>
          {selected.length > 0 && <span className="filter-count">{selected.length}</span>}
          <ChevronDown className="filter-chevron" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="filter-popover">
        <div className="filter-popover-header">
          <strong>{label}</strong>
          <button type="button" className="filter-clear" disabled={selected.length === 0} onClick={() => onChange({ ...value, [key]: [] })}>Очистить</button>
        </div>
        <OptionList label={label} options={options[key]} selected={selected} searchable={key === "owner"} onToggle={item => onChange(toggleValue(value, key, item))} />
      </PopoverContent>
    </Popover>
  )
}

export function LeadFilterBar({ options, value, onChange }: FilterProps) {
  const active = countActiveFilters(value)
  return (
    <div className="filter-bar">
      <div className="filter-groups">
        {filterDefinitions.map(definition => <FilterDropdown key={definition.key} definition={definition} options={options} value={value} onChange={onChange} />)}
        {active > 0 && (
          <button type="button" className="filter-reset" onClick={() => onChange(emptyLeadFilters)}>
            <RotateCcw aria-hidden="true" />
            Сбросить фильтры
          </button>
        )}
      </div>
      {active > 0 && (
        <ul className="filter-chips" aria-label="Выбранные фильтры">
          {filterDefinitions.flatMap(({ key, label }) => value[key].map(item => (
            <li key={`${key}:${item}`}>
              <button type="button" className="filter-chip" aria-label={`Убрать фильтр ${label}: ${item}`} onClick={() => onChange(toggleValue(value, key, item))}>
                <span className="filter-chip-kind">{label}</span>
                <span>{item}</span>
                <X aria-hidden="true" />
              </button>
            </li>
          )))}
        </ul>
      )}
    </div>
  )
}

export function LeadsEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className={cn("leads-empty")} role="status">
      <span className="leads-empty-icon" aria-hidden="true"><SearchX /></span>
      <div>
        <h2>Лиды не найдены</h2>
        <p>Измените поисковый запрос или условия фильтров.</p>
      </div>
      <button type="button" className="filter-reset" onClick={onReset}>
        <RotateCcw aria-hidden="true" />
        Сбросить фильтры
      </button>
    </div>
  )
}
