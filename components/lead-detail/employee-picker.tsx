"use client"

import { useRef, useState, type ReactNode } from "react"
import { Check, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { employees } from "@/lib/employees"

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
}

export function EmployeePicker({
  children,
  exclude = [],
  current,
  multiple = false,
  onSelect,
}: {
  children: ReactNode
  exclude?: string[]
  current?: string
  multiple?: boolean
  onSelect: (name: string) => Promise<boolean | void> | void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const busy = useRef(false)
  const needle = query.trim().toLowerCase()
  const matches = employees.filter((name) => !exclude.includes(name) && name.toLowerCase().includes(needle))

  const choose = async (name: string) => {
    if (busy.current) return
    busy.current = true
    try {
      await onSelect(name)
      if (!multiple) setOpen(false)
    } finally {
      busy.current = false
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery("") }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="ld-picker">
        <label className="ld-picker-search">
          <Search aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск сотрудника" aria-label="Поиск сотрудника" />
        </label>
        {matches.length ? (
          <ul className="ld-picker-list">
            {matches.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => choose(name)} aria-current={name === current}>
                  <span className="ld-avatar">{initials(name)}</span>
                  <span>{name}</span>
                  {name === current && <Check aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ld-picker-empty">Сотрудники не найдены</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
