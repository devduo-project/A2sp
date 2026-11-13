"use client"

import { Fragment, createElement, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Archive, ArrowLeft, Bell, CalendarDays, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, ClipboardList, Clock3, ChevronUp, FileText, FolderKanban, Mail,
  Menu, MessageSquare, Paperclip, Pencil, Phone, Plus, Search, Settings2, Table2,
  SlidersHorizontal, Sun, Target, Users, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { LeadCard, type Lead } from "@/components/lead-card"
import { LeadActionDialogs } from "@/components/lead-action-dialogs"
import { NewLeadDialog } from "@/components/new-lead-dialog"
import { LeadCardSettingsDialog } from "@/components/lead-card-settings-dialog"
import { defaultLeadCardConfig, type LeadCardConfig } from "@/lib/lead-card-config"
import { getLeadCardConfig } from "@/app/actions/leads"
import { copyLeadLink, type QuickActionType } from "@/components/lead-quick-actions"
import { duplicateLead } from "@/app/actions/leads"
import type { SavedContact } from "@/app/actions/lead-records"
import { FloatingNavbar, type FloatingNavbarItem } from "@/components/floating-navbar"
import { boblak, lapshinov, tokarev } from "@/lib/employees"
import { leadStages, leadStageColors, type LeadStage } from "@/lib/lead-stages"
import { moveLead } from "@/app/actions/leads"
import { LeadFilterBar, LeadsEmptyState, buildLeadFilterOptions, countActiveFilters, emptyLeadFilters, matchesLeadFilters, type LeadFilterState } from "@/components/lead-filters"
import { CompanyRegistry } from "@/components/company-registry"

const stages = leadStages
const rubleFormatter = new Intl.NumberFormat("ru-RU")
const dateFormatter = new Intl.DateTimeFormat("ru-RU")
function parseLeadAmount(value: string): number | null {
  const cleaned = value.trim().replace(/[^\d.,+-]/g, "")
  if (!cleaned) return null
  const comma = cleaned.lastIndexOf(",")
  const dot = cleaned.lastIndexOf(".")
  const decimalIndex = Math.max(comma, dot)
  const decimalDigits = decimalIndex >= 0 ? cleaned.length - decimalIndex - 1 : 0
  const hasDecimal = decimalIndex >= 0 && decimalDigits > 0 && decimalDigits <= 2
  const normalized = hasDecimal
    ? `${cleaned.slice(0, decimalIndex).replace(/[.,]/g, "")}.${cleaned.slice(decimalIndex + 1).replace(/[.,]/g, "")}`
    : cleaned.replace(/[.,]/g, "")
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}
function parseCreationDate(value: string | Date | undefined): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (!value?.trim()) return null
  const text = value.trim()
  if (/^\d{10}$/.test(text)) return Number(text) * 1000
  if (/^\d{13}$/.test(text)) return Number(text)
  const localized = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (localized) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = localized
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null
    return date.getTime()
  }
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? timestamp : null
}
function formatLeadAmount(value: string) {
  const amount = parseLeadAmount(value)
  return amount === null ? value : `${rubleFormatter.format(amount)} ₽`
}
function totalLeadValue(items: Lead[]) {
  return items.reduce((total, lead) => {
    const digits = typeof lead.value === "string" ? lead.value.replace(/[^\d]/g, "") : ""
    if (!digits) return total
    try {
      return total + BigInt(digits)
    } catch {
      return total
    }
  }, BigInt(0))
}
function collectSearchText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "object") return Object.values(value).map(collectSearchText).join(" ")
  return String(value)
}

function matchesSearch(record: unknown, terms: string[]) {
  if (terms.length === 0) return true
  const haystack = collectSearchText(record).toLowerCase()
  return terms.every(term => haystack.includes(term))
}

const navItems: FloatingNavbarItem[] = [{ label: "Лиды", value: "leads" }, { label: "Сделки", value: "deals" }, { label: "Контакты", value: "contacts" }, { label: "Компании", value: "companies" }]
const deals = [{ id: "СД-24012", company: "ООО «БалтСтрой»", service: "Обследование здания", stage: "Полевые работы", value: "₽ 3 200 000", dates: "01.10 — 28.11.2024", owner: boblak }, { id: "СД-24008", company: "ГК «Речной порт»", service: "Расчёт конструкций", stage: "Согласование результата", value: "₽ 1 840 000", dates: "15.09 — 12.11.2024", owner: tokarev }, { id: "СД-23994", company: "«Каменный берег»", service: "Техническое обследование", stage: "Камеральные работы", value: "₽ 980 000", dates: "02.09 — 18.10.2024", owner: lapshinov }]
const production = ["Подготовка работ", "Полевые работы", "Камеральные работы", "Согласование результата", "Закрывающие документы", "Ожидание финальной оплаты", "Завершена"]

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) { return <Button aria-label={label} title={label} variant="ghost" size="icon" onClick={onClick}>{children}</Button> }
function SectionLabel({ children }: { children: React.ReactNode }) { return <p className="section-label">{children}</p> }
function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) { return <div className="field"><span>{label}</span>{children ?? <strong>{value}</strong>}</div> }


type DropTarget = { stage: string; beforeId: string | null }

export function CRMDashboard({ initialLeads, initialContacts = [], initialLeadId }: { initialLeads: Lead[]; initialContacts?: SavedContact[]; initialLeadId?: string }) {
  const [leads, setLeads] = useState(initialLeads)
  const [newLeadOpen, setNewLeadOpen] = useState(false); const [tooltipStage, setTooltipStage] = useState<LeadStage | null>(null); const [savedContacts, setSavedContacts] = useState(initialContacts); const [cardSettingsOpen, setCardSettingsOpen] = useState(false); const [cardConfig, setCardConfig] = useState<LeadCardConfig>(defaultLeadCardConfig)
  const [quickAction, setQuickAction] = useState<{ type: Exclude<QuickActionType, "link" | "duplicate">; leadId: string } | null>(null)
  const quickLead = quickAction ? leads.find((lead) => lead.id === quickAction.leadId) ?? null : null
  const handleQuickAction = async (type: QuickActionType, lead: Lead) => {
    if (type === "link") {
      if (await copyLeadLink(lead.id)) toast.success("Ссылка на лид скопирована")
      else toast.error("Не удалось скопировать ссылку")
      return
    }
    if (type === "duplicate") {
      try {
        const copy = await duplicateLead(lead.id)
        setLeads((current) => [...current, copy])
        toast.success(`Создан дубликат лида ${copy.id}`)
      } catch (error) {
        toast.error(error instanceof Error && error.message ? error.message : "Не удалось дублировать лид")
      }
      return
    }
    setQuickAction({ type, leadId: lead.id })
  }
  const replaceLead = (updated: Lead) => setLeads((current) => current.map((lead) => (lead.id === updated.id ? updated : lead)))
  const [filters, setFilters] = useState<LeadFilterState>(emptyLeadFilters)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [, startMove] = useTransition()
  useEffect(() => { getLeadCardConfig().then(setCardConfig).catch(() => undefined) }, []); const [collapsed, setCollapsed] = useState(false); const [otherOpen, setOtherOpen] = useState(false); const [section, setSection] = useState("leads"); const [viewMode, setViewMode] = useState<"grid" | "list">("grid"); const [tab, setTab] = useState<"leads" | "deals" | "contacts" | "companies">("leads"); const [selectedLead, setSelectedLead] = useState<Lead | null>(() => initialLeads.find((lead) => lead.id === initialLeadId) ?? null); const [selectedDeal, setSelectedDeal] = useState<typeof deals[number] | null>(null); const [leadTab, setLeadTab] = useState("Краткий обзор"); const [dealTab, setDealTab] = useState("Обзор"); const [search, setSearch] = useState(""); const [taskOpen, setTaskOpen] = useState(false); const [taskName, setTaskName] = useState(""); const [otherRequest, setOtherRequest] = useState(false); const [stage, setStage] = useState(() => initialLeads.find((lead) => lead.id === initialLeadId)?.stage ?? "Новый лид"); const [openStage, setOpenStage] = useState<number | null>(1)
  const workspaceRef = useRef<HTMLElement>(null)
  const searchTerms = useMemo(() => search.trim().toLowerCase().split(/\s+/).filter(Boolean), [search])
  const filterOptions = useMemo(() => buildLeadFilterOptions(leads, stages), [leads])
  const activeFilterCount = countActiveFilters(filters)
  const filtered = useMemo(() => leads.filter(l => matchesLeadFilters(l, filters) && matchesSearch({ ...l, direction: l.direction ?? "А2-СП" }, searchTerms)), [leads, filters, searchTerms])
  const resetLeadFilters = () => { setFilters(emptyLeadFilters); setSearch("") }
  const filteredDeals = useMemo(() => deals.filter(d => matchesSearch(d, searchTerms)), [searchTerms])
  const endDrag = () => { setDraggedId(null); setDropTarget(null) }
  const handleColumnDragOver = (event: React.DragEvent<HTMLElement>, stageName: string) => {
    if (!draggedId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    const cards = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-lead-id]")].filter(card => card.dataset.leadId !== draggedId)
    const before = cards.find(card => { const rect = card.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2 })
    const beforeId = before?.dataset.leadId ?? null
    if (dropTarget?.stage !== stageName || dropTarget.beforeId !== beforeId) setDropTarget({ stage: stageName, beforeId })
  }
  const handleColumnDragLeave = (event: React.DragEvent<HTMLElement>, stageName: string) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDropTarget(current => current?.stage === stageName ? null : current)
  }
  const handleColumnDrop = (event: React.DragEvent<HTMLElement>, stageName: string) => {
    event.preventDefault()
    const id = draggedId
    const target = dropTarget
    endDrag()
    const moved = leads.find(l => l.id === id)
    if (!id || !moved || target?.stage !== stageName) return
    const column = leads.filter(l => l.stage === stageName && l.id !== id)
    const beforeIndex = target.beforeId ? column.findIndex(l => l.id === target.beforeId) : -1
    const nextColumn = [...column]
    nextColumn.splice(beforeIndex < 0 ? column.length : beforeIndex, 0, { ...moved, stage: stageName })
    const nextIds = nextColumn.map(l => l.id)
    const currentIds = leads.filter(l => l.stage === stageName).map(l => l.id)
    if (moved.stage === stageName && nextIds.join() === currentIds.join()) return
    const previous = leads
    setLeads([...leads.filter(l => l.stage !== stageName && l.id !== id), ...nextColumn])
    startMove(async () => {
      try {
        await moveLead(id, stageName, nextIds)
        if (moved.stage !== stageName) toast.success("Лид перемещён", { description: `${moved.company} → ${stageName}` })
      } catch {
        setLeads(previous)
        toast.error("Не удалось сохранить перемещение", { description: "Лид возвращён на прежнее место" })
      }
    })
  }
  const createTask = () => { if (!taskName.trim()) return; setTaskOpen(false); setTaskName(""); toast.success("Задача создана", { description: "Задача добавлена в список текущего лида" }) }
  if (selectedLead) return <LeadDetail lead={{ ...selectedLead, stage }} tab={leadTab} setTab={setLeadTab} setStage={setStage} onBack={() => { setSelectedLead(null); window.history.replaceState(null, "", "/") }} taskOpen={taskOpen} setTaskOpen={setTaskOpen} taskName={taskName} setTaskName={setTaskName} createTask={createTask} otherRequest={otherRequest} setOtherRequest={setOtherRequest} />
  if (selectedDeal) return <DealDetail deal={selectedDeal} tab={dealTab} setTab={setDealTab} onBack={() => setSelectedDeal(null)} openStage={openStage} setOpenStage={setOpenStage} />
  return <div className={cn("crm-shell", viewMode === "list" && "list-view", (tab === "contacts" || tab === "companies") && "registry-shell")}><NewLeadDialog open={newLeadOpen} onClose={() => setNewLeadOpen(false)} onCreated={(lead, contact) => { setLeads((current) => [lead, ...current]); if (contact) setSavedContacts((current) => [...current, contact]); setFilters(emptyLeadFilters); setSearch("") }} /><LeadCardSettingsDialog open={cardSettingsOpen} initialConfig={cardConfig} onClose={() => setCardSettingsOpen(false)} onSaved={setCardConfig} /><LeadActionDialogs lead={quickLead} action={quickAction?.type ?? null} onClose={() => setQuickAction(null)} onLeadUpdated={replaceLead} onContactCreated={(contact) => setSavedContacts((current) => [...current, contact])} /><aside className={cn("sidebar", collapsed && "sidebar-collapsed")}><div className="brand"><IconButton label="С������рнуть меню" onClick={() => setCollapsed(!collapsed)}><Menu /></IconButton>{!collapsed && <div className="brand-logo"><strong>А2-СП</strong><span>CRM</span></div>}</div><nav className={cn("nav-list", !otherOpen && "other-closed")}><p className="nav-group-label">Работа</p>{[[Sun, "СЕГОДНЯ", "today"], [FolderKanban, "Ли��ы и сделки", "leads"], [ClipboardList, "Задачи", "tasks"], [CalendarDays, "Календарь", "calendar"], [Target, "Рассылки", "mailings"], [Users, "Департаменты и сотрудники", "people"]].map(([I, label, key]) => <Button key={key as string} variant="ghost" className={cn("nav-item", section === key && "active")} onClick={() => setSection(key as string)}>{createElement(I as React.ElementType)}{!collapsed && String(label)}</Button>)}{!collapsed && <button className="nav-group-toggle" type="button" onClick={() => setOtherOpen(!otherOpen)} aria-expanded={otherOpen}><span>Другие разделы</span><ChevronDown className={cn("nav-toggle-icon", otherOpen && "is-open")} /></button>}{[[FileText, "Договоры", "contracts"], [Users, "Субподрядчики", "subcontractors"], [CircleHelp, "Справочник", "reference"], [Archive, "Выполнение", "execution"], [Target, "Аналитика", "analytics"], [Bell, "Уведомления", "notifications"]].map(([I, label, key]) => <Button key={key as string} variant="ghost" className={cn("nav-item other-section-item", section === key && "active")} onClick={() => setSection(key as string)}>{createElement(I as React.ElementType)}{!collapsed && String(label)}</Button>)}</nav>{!collapsed && <div className="sidebar-bottom"><Button variant="ghost" className="sidebar-settings" onClick={() => setSection("settings")}><Settings2 /> Настройки</Button></div>}</aside><main className={cn("workspace", (tab === "contacts" || tab === "companies") && "registry-workspace")} ref={workspaceRef}>{section === "leads" && <div className="floating-navbar-slot"><FloatingNavbar items={navItems} value={tab} onValueChange={(v) => setTab(v as typeof tab)} containerRef={workspaceRef} /></div>}<header className="topbar"><div className="top-actions"><div className="view-toggle" role="group" aria-label="Вид списка"><button type="button" className={cn(viewMode === "grid" && "selected")} onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"}>Стадии</button><button type="button" className={cn(viewMode === "list" && "selected")} onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"}>Список</button></div><IconButton label="Настройки карточки" onClick={async () => { try { setCardConfig(await getLeadCardConfig()) } finally { setCardSettingsOpen(true) } }}><Settings2 /></IconButton></div></header>{section === "leads" ? <><div className="toolbar"><div className="toolbar-actions"><div className="search"><Search className="size-4" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по лидам и сделкам" aria-label="Поиск по лидам и сделкам" /></div><Button onClick={() => setNewLeadOpen(true)}><Plus data-icon="inline-start" /> Новый лид</Button></div>{(tab === "leads" || tab === "deals") && <LeadFilterBar options={filterOptions} value={filters} onChange={setFilters} />}</div>{tab === "leads" ? <>{filtered.length === 0 && (activeFilterCount > 0 || searchTerms.length > 0) && <LeadsEmptyState onReset={resetLeadFilters} />}{viewMode === "list" ? <UnifiedLeadTable leads={filtered} onSelect={(lead) => { setSelectedLead(lead); setStage(lead.stage) }} /> : <div className="pipeline">{stages.map(s => { const items = filtered.filter(l => l.stage === s); const isTarget = dropTarget?.stage === s; const indicator = <div className="drop-indicator" aria-hidden="true" />; return <section className={cn("pipeline-column", isTarget && "is-drop-target")} key={s} aria-label={s} style={{ "--stage-color": leadStageColors[s] } as React.CSSProperties} onDragOver={(e) => handleColumnDragOver(e, s)} onDragLeave={(e) => handleColumnDragLeave(e, s)} onDrop={(e) => handleColumnDrop(e, s)}><div className="column-heading"><Badge className="stage-count" variant="secondary">{items.length}</Badge><div><span className="column-stage-title" role="button" tabIndex={0} aria-expanded={tooltipStage === s} aria-describedby={`stage-total-${s}`} onMouseEnter={() => setTooltipStage(s)} onMouseLeave={() => setTooltipStage(null)} onFocus={() => setTooltipStage(s)} onBlur={() => setTooltipStage(null)} onClick={() => setTooltipStage((current) => current === s ? null : s)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setTooltipStage((current) => current === s ? null : s) } }}>{s}<span id={`stage-total-${s}`} className={cn("stage-total-tooltip", tooltipStage === s && "is-visible")} role="tooltip"><span>Общая сумма</span><strong>{rubleFormatter.format(totalLeadValue(items))} ₽</strong></span></span></div></div><div className="column-cards">{items.map(l => <Fragment key={l.id}>{isTarget && dropTarget.beforeId === l.id && indicator}<LeadCard cardConfig={cardConfig} lead={l} onQuickAction={handleQuickAction} savedContacts={savedContacts.filter((contact) => contact.leadId === l.id)} isDragging={draggedId === l.id} dragProps={{ draggable: true, onDragStart: (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); setDraggedId(l.id) }, onDragEnd: endDrag }} onClick={() => { setSelectedLead(l); setStage(l.stage) }} /></Fragment>)}{isTarget && dropTarget.beforeId === null && indicator}{items.length === 0 && !isTarget && <div className="empty-column">Нет лидов</div>}</div></section> })}</div>} </> : tab === "deals" ? <div className="deals-grid">{filteredDeals.map(d => <button className="deal-card" key={d.id} onClick={() => setSelectedDeal(d)}><div className="flex justify-between"><span className="eyebrow">{d.id}</span><ChevronRight className="size-4" /></div><h2>{d.company}</h2><p>{d.service}</p><div className="deal-stage"><span className="stage-dot" />{d.stage}</div><div className="deal-meta"><strong>{d.value}</strong><span>{d.dates}</span><span>{d.owner}</span></div></button>)}</div> : <CompanyRegistry view={tab === "contacts" ? "contacts" : "companies"} leads={leads} savedContacts={savedContacts} deals={deals} onLeadSelect={(leadId) => { const lead = leads.find((item) => item.id === leadId); if (!lead) return false; setSelectedLead(lead); setStage(lead.stage); return true }} onDealSelect={(dealId) => { const deal = deals.find((item) => item.id === dealId); if (!deal) return false; setSelectedDeal(deal); setDealTab("Обзор"); return true }} />}</> : <div className="placeholder"><Archive className="size-8" /><h2>Раздел в разработке</h2><p>Здесь появится рабочая область «{section}».</p></div>}</main></div>
}

function UnifiedLeadTable({ leads, onSelect }: { leads: Lead[]; onSelect: (lead: Lead) => void }) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "createdAt", direction: "desc" })
  const directionOrder: Record<string, number> = { "А2-СП": 0, "ИП": 1, "МГСУ": 2 }
  const stageOrder = new Map<string, number>(stages.map((stage, index) => [stage, index]))
  const dateLabel = (lead: Lead) => {
    const timestamp = parseCreationDate(lead.createdAt)
    return timestamp === null ? "—" : dateFormatter.format(timestamp)
  }
  const sorted = useMemo(() => [...leads].sort((a, b) => {
    if (sort.key === "createdAt") {
      const aDate = parseCreationDate(a.createdAt)
      const bDate = parseCreationDate(b.createdAt)
      if (aDate === null || bDate === null) return aDate === bDate ? 0 : aDate === null ? 1 : -1
      return sort.direction === "asc" ? aDate - bDate : bDate - aDate
    }
    let result = 0
    if (sort.key === "company") result = a.company.localeCompare(b.company, "ru")
    if (sort.key === "object") result = (a.objectName ?? "").localeCompare(b.objectName ?? "", "ru")
    if (sort.key === "request") result = a.request.localeCompare(b.request, "ru")
    if (sort.key === "value") result = (parseLeadAmount(a.value) ?? 0) - (parseLeadAmount(b.value) ?? 0)
    if (sort.key === "directionStage") result = (directionOrder[a.direction ?? "А2-СП"] - directionOrder[b.direction ?? "А2-СП"]) || ((stageOrder.get(a.stage) ?? 999) - (stageOrder.get(b.stage) ?? 999))
    if (sort.key === "owner") result = a.owner.localeCompare(b.owner, "ru")
    return sort.direction === "asc" ? result : -result
  }), [leads, sort])
  const [dateSortClicked, setDateSortClicked] = useState(false)
  const toggleSort = (key: string) => {
    if (key === "createdAt") {
      setSort((current) => current.key !== key || !dateSortClicked ? { key, direction: "desc" } : { key, direction: current.direction === "desc" ? "asc" : "desc" })
      setDateSortClicked(true)
      return
    }
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }))
  }
  const columns = [["company", "Заказчик"], ["object", "Объект"], ["request", "Услуга"], ["createdAt", "Дата создания"], ["value", "Сумма"], ["directionStage", "Направление / Стадия"], ["owner", "Ответственный"]] as const
  const Arrow = ({ column }: { column: string }) => sort.key === column ? (sort.direction === "asc" ? <ChevronUp aria-label="По возрастанию" /> : <ChevronDown aria-label="По убыванию" />) : <ChevronDown className="table-sort-muted" aria-hidden="true" />
  return <div className="leads-table-shell"><div className="leads-table-scroll"><table className="leads-table"><caption className="sr-only">Единый список лидов</caption><thead><tr>{columns.map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={cn(sort.key === key && "is-sorted")} onClick={() => toggleSort(key)}>{label}<Arrow column={key} /></button></th>)}</tr></thead><tbody>{sorted.map((lead) => <tr key={lead.id} onClick={() => onSelect(lead)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(lead) } }}><td className="table-primary" title={lead.company}>{lead.company || "—"}</td><td title={lead.objectName || undefined}>{lead.objectName || "—"}</td><td>{lead.request || "—"}</td><td>{dateLabel(lead)}</td><td className="table-amount">{lead.value ? formatLeadAmount(lead.value) : "—"}</td><td><div className="table-direction-stage"><Badge className={cn("direction-chip", lead.direction === "ИП" ? "table-direction-ip" : lead.direction === "МГСУ" ? "table-direction-mgsu" : "table-direction-a2sp")}>{lead.direction ?? "А2-СП"}</Badge><span className={cn("table-stage", `stage-${lead.stage}`)}>{lead.stage || "—"}</span></div></td><td><div className="table-owner"><span className="table-avatar">{lead.owner.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span>{lead.owner || "—"}</span></div></td></tr>)}</tbody></table>{sorted.length === 0 && <div className="leads-table-empty">Нет лидов, соответствующих текущим фильтрам.</div>}</div></div>
}

function LeadDetail({ lead, tab, setTab, setStage, onBack, taskOpen, setTaskOpen, taskName, setTaskName, createTask, otherRequest, setOtherRequest }: any) { const tabs = ["Краткий обзор", "Задачи", "Коммуникация", "История действий"]; return <div className="detail-shell"><header className="detail-header"><Button variant="ghost" onClick={onBack}><ArrowLeft data-icon="inline-start" /> К лидам</Button><div className="detail-title"><SectionLabel>{lead.id}</SectionLabel><h1>{lead.company}</h1><Badge variant="outline">{lead.days} дней на стадии</Badge></div><div className="detail-actions"><Select value={lead.stage} onValueChange={setStage}><SelectTrigger className="stage-select"><SelectValue /></SelectTrigger><SelectContent>{stages.map(s => <SelectItem value={s} key={s}>{s}</SelectItem>)}</SelectContent></Select><Button variant="outline"><Pencil data-icon="inline-start" /> Редакти��овать</Button></div></header><div className="detail-tabs">{tabs.map(t => <button className={cn(tab === t && "selected")} key={t} onClick={() => setTab(t)}>{t}</button>)}</div><div className="detail-content">{tab === "Краткий обзор" && <><div className="detail-grid"><Card className="detail-card"><SectionLabel>Заказчик</SectionLabel><h2>{lead.company}</h2><Field label="Контак��ное лицо" value={lead.contact} /><Field label="Должность" value={lead.role} /><Field label="Город" value={lead.city} /></Card><Card className="detail-card"><SectionLabel>Контакты</SectionLabel><Field label="Телефон" value={lead.phone} /><Field label="Email" value="office@a2sp.ru" /><Field label="Ответственный" value={lead.owner} /><Field label="Следующий контакт" value={lead.next} /></Card><Card className="detail-card wide"><div className="flex items-center justify-between"><SectionLabel>Услуга / запрос заказчик��</SectionLabel><Badge variant="secondary">Запрос</Badge></div><Select value={otherRequest ? "Другой запрос" : "Обследование"} onValueChange={v => setOtherRequest(v === "Другой зап��ос")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Об��ледова��ие">Обследование</SelectItem><SelectItem value="Др��гой запрос">Другой запрос</SelectItem></SelectContent></Select>{otherRequest && <Textarea className="mt-4" placeholder="Подробнее запрос заказчика" defaultValue={lead.request} />}</Card><Card className="detail-card wide"><div className="flex items-center justify-between"><SectionLabel>Объект</SectionLabel><Button variant="ghost" size="sm"><Pencil data-icon="inline-start" /> Изменить</Button></div><div className="object-fields"><Field label="Название объекта" value="Жилой комплекс «Северный»" /><Field label="Адрес" value="Санкт-Петербург, ул. Портовая, 12" /><Field label="Строительный объём" value="42 800 м³" /><Field label="Площадь" value="18 450 м²" /><Field label="Этажность" value="14 этажей" /><Field label="Проектная документация" value="Есть, комплект 2023 г." /><Field label="Предыдущее обслед��вание" value="Не проводилось" /></div><Button variant="outline" className="mt-5"><Paperclip data-icon="inline-start" /> Прикрепить исходные материалы</Button></Card></div><div className="section-heading"><div><SectionLabel>Контакты компании</SectionLabel><h2>Люди, участвующие в проекте</h2></div><Button variant="outline" onClick={() => toast.success("Форма контакта открыт��")}><Plus data-icon="inline-start" /> Добавить контакт</Button></div></>}{tab === "Коммуникация" && <div className="communication-list">{["Созвон с Анной Мельниковой", "Отправлено коммерческое предложение", "Входящий запрос с сайта"].map((x, i) => <Card className="communication-card" key={x}><div className="comm-icon"><MessageSquare /></div><div><div className="flex items-center gap-2"><SectionLabel>{i === 1 ? "Email" : "Звонок"}</SectionLabel><span className="text-xs text-muted-foreground">{12 - i} октября 2024, 14:{30 - i * 10}</span></div><h3>{x}</h3><p>{i === 0 ? "Обсудили состав работ и сроки подготовки отчёта. Клиент ожидает обновлённое КП." : "Коммуникация по текущему запросу заказчика."}</p><Button variant="link" className="px-0" onClick={() => setTaskOpen(true)}>+ Создать задачу</Button></div></Card>)}</div>}{tab === "Задачи" && <div className="placeholder"><ClipboardList className="size-8" /><h2>Задачи лида</h2><p>Запланируйте следующий контакт из ком��уникации.</p><Button onClick={() => setTaskOpen(true)}><Plus data-icon="inline-start" /> Создать задачу</Button></div>}{tab === "История действий" && <div className="timeline">{["Лид создан", "Назначен ответственный менеджер", "Изменён запрос ��аказчика"].map((x, i) => <div className="timeline-row" key={x}><span>{i + 1}</span><div><strong>{x}</strong><small>Алексей Крылов · {12 - i} октября 2024, 10:20</small></div></div>)}</div>}</div><Dialog open={taskOpen} onOpenChange={setTaskOpen}><DialogContent><DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader><div className="dialog-form"><Input placeholder="Название задачи" value={taskName} onChange={e => setTaskName(e.target.value)} /><Input type="date" /><Textarea placeholder="Описание задачи" /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTaskOpen(false)}>Отмена</Button><Button onClick={createTask}>Создать задачу</Button></div></div></DialogContent></Dialog></div> }

function DealDetail({ deal, tab, setTab, onBack, openStage, setOpenStage }: any) { const tabs = ["Обзор", "Производство", "Задачи", "Докуме��ты", "Коммуникация", "Контекст проекта", "Финансы", "История действий"]; return <div className="detail-shell"><header className="detail-header"><Button variant="ghost" onClick={onBack}><ArrowLeft data-icon="inline-start" /> К сделкам</Button><div className="detail-title"><SectionLabel>{deal.id}</SectionLabel><h1>{deal.company}</h1><Badge variant="outline">{deal.stage}</Badge></div><div className="detail-actions"><Button variant="outline"><Pencil data-icon="inline-start" /> Изменить</Button><Button><Plus data-icon="inline-start" /> Задача</Button></div></header><div className="detail-tabs">{tabs.map(t => <button className={cn(tab === t && "selected")} key={t} onClick={() => setTab(t)}>{t}</button>)}</div><div className="detail-content">{tab === "Обзор" && <div className="detail-grid"><Card className="detail-card"><SectionLabel>Заказчик</SectionLabel><h2>{deal.company}</h2><Field label="Контакт" value="Максим Орлов" /><Field label="Телефон" value="+7 916 320-44-81" /><Field label="Email" value="maxim@riverport.ru" /></Card><Card className="detail-card"><SectionLabel>Объект</SectionLabel><h2>Многофункциональный комплекс «Речной»</h2><Field label="Адрес" value="Москва, наб. Шлюзовая, 4" /><Field label="Площадь / этажность" value="24 800 м² · 18 этажей" /><Field label="Документация" value="В наличии" /></Card><Card className="detail-card wide"><SectionLabel>Сделка</SectionLabel><div className="object-fields"><Field label="Услуга" value={deal.service} /><Field label="Состав работ" value="Полевое и инструментальное обследование" /><Field label="Основание начала работ" value="Договор № А2-114 от 01.10.2024" /><Field label="Стоимость" value={deal.value} /><Field label="Плановые сроки" value={deal.dates} /></div></Card></div>}{tab === "Производство" && <div className="production">{production.map((p, i) => <Card className="production-stage" key={p}><button className="stage-row" onClick={() => setOpenStage(openStage === i ? null : i)}><div className="stage-number">{String(i + 1).padStart(2, "0")}</div><div className="stage-main"><div className="flex items-center gap-3"><h2>{p}</h2>{i < 2 && <Badge variant="secondary">В работе</Badge>}</div><div className="stage-progress"><Progress value={i < 2 ? (i === 0 ? 100 : 62) : 0} /><span>{i < 2 ? (i === 0 ? 100 : 62) : 0}%</span></div></div><ChevronDown className={cn("size-5 transition-transform", openStage === i && "rotate-180")} /></button>{openStage === i && <div className="stage-expanded"><Field label="Плановые даты" value="01.10 — 12.10.2024" /><Field label="Фактические даты" value={i === 0 ? "01.10 — 09.10.2024" : "В процессе"} /><Field label="Ответственный" value={deal.owner} /><Field label="Отклонение" value={i === 0 ? "−3 дня" : "+2 дня"} /><Field label="Связанные задачи" value="2 задачи" /></div>}</Card>)}</div>}{tab === "Финансы" && <div className="finance-grid">{[["Первоначальная стоимость", "₽ 3 200 000"], ["Текущая стоимость", "₽ 3 200 000"], ["Сумма аванса", "₽ 960 000"], ["Оплачено", "₽ 1 920 000"], ["Остаток", "₽ 1 280 000"], ["Статус оплаты", "Частично оплачено"]].map(([l, v]) => <Card className="finance-card" key={l}><SectionLabel>{l}</SectionLabel><strong>{v}</strong></Card>)}</div>}{!["Обзор", "Производство", "Финансы"].includes(tab) && <div className="placeholder"><Table2 className="size-8" /><h2>{tab}</h2><p>Структурированный список записей по сделке появится здесь.</p></div>}</div></div> }
