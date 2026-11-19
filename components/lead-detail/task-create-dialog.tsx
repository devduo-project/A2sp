"use client"

import { useMemo, useRef, useState, type FormEvent } from "react"
import { useSWRConfig } from "swr"
import { CalendarDays, Check, ChevronDown, CircleAlert, Paperclip, Repeat2, Search, UserRound, X } from "lucide-react"
import { toast } from "sonner"
import { createLeadTask } from "@/app/actions/lead-records"
import { getLeadTasks, updateLeadDetails, type LeadTaskRow } from "@/app/actions/lead-details"
import type { Lead } from "@/components/lead-card"
import { AttachButton, FileList } from "@/components/lead-detail/file-list"
import { EmployeePicker, initials } from "@/components/lead-detail/employee-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, type Communication, type StoredFile, type TaskMeta, type TaskRecurrence, type TaskSource } from "@/lib/lead-details"
import { taskPriorities } from "@/lib/task-priorities"

const NO_SOURCE = "none"
const PROTOTYPE_CREATOR_ID = "crm-prototype-user"
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
type Frequency = TaskRecurrence["frequency"]

type TaskFormState = {
  title: string
  description: string
  dueDate: string
  priority: string
  executor: string
  coExecutors: string[]
  observers: string[]
  sourceType: "communication" | "task" | ""
  sourceId: string
}

const today = () => new Date().toISOString().slice(0, 10)
const newRecurrence = (): TaskRecurrence => ({ enabled: true, frequency: "weekly", interval: 1, weekdays: [1], startDate: today(), endDate: "" })

export function TaskCreateDialog({
  lead,
  open,
  onOpenChange,
  initialCommunicationId,
  onCreated,
  onLeadUpdated,
}: {
  lead: Lead
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCommunicationId?: string
  onCreated: () => void
  onLeadUpdated?: (lead: Lead) => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [form, setForm] = useState<TaskFormState>(() => ({
    title: "",
    description: "",
    dueDate: "",
    priority: "Средний",
    executor: lead.owner || "",
    coExecutors: [],
    observers: [],
    sourceType: initialCommunicationId ? "communication" : "",
    sourceId: initialCommunicationId ?? NO_SOURCE,
  }))
  const [files, setFiles] = useState<StoredFile[]>([])
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [sourceQuery, setSourceQuery] = useState("")
  const [recurrenceOpen, setRecurrenceOpen] = useState(false)
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false)
  const [recurrence, setRecurrence] = useState<TaskRecurrence | null>(null)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<Frequency>("weekly")
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([1])
  const [recurrenceStart, setRecurrenceStart] = useState(today())
  const [recurrenceEnd, setRecurrenceEnd] = useState("")
  const [tasks, setTasks] = useState<LeadTaskRow[]>([])

  const { mutate: mutateCache } = useSWRConfig()
  const taskMeta = lead.details?.taskMeta ?? {}
  const communications = lead.details?.communications ?? []
  const unavailable = useMemo(() => new Set([form.executor, ...form.coExecutors, ...form.observers].filter(Boolean)), [form.executor, form.coExecutors, form.observers])
  const sourceItems = form.sourceType === "communication"
    ? communications.map((item) => ({ id: item.id, title: item.subject, subtitle: `${item.type} · ${formatDateTime(item.at)}` }))
    : tasks.map((item) => ({ id: String(item.id), title: item.title, subtitle: `${item.dueDate ? formatDateTime(item.dueDate) : "Без срока"} · ${taskMeta[String(item.id)]?.status ?? "Новая"}` }))
    .filter((item) => item.title.toLocaleLowerCase("ru-RU").includes(sourceQuery.trim().toLocaleLowerCase("ru-RU")))

  const loadTasks = async () => {
    try {
      setTasks(await getLeadTasks(lead.id))
    } catch {
      setTasks([])
    }
  }

  const updateForm = (patch: Partial<TaskFormState>) => setForm((current) => ({ ...current, ...patch }))

  const selectSourceType = (sourceType: TaskFormState["sourceType"]) => {
    setForm((current) => ({ ...current, sourceType, sourceId: sourceType === "communication" && initialCommunicationId ? initialCommunicationId : NO_SOURCE }))
    setSourceQuery("")
    if (sourceType === "task" && tasks.length === 0) void loadTasks()
  }

  const toggleEmployee = (role: "coExecutors" | "observers", name: string) => {
    setForm((current) => ({ ...current, [role]: current[role].includes(name) ? current[role].filter((item) => item !== name) : [...current[role], name] }))
  }

  const openRecurrence = (current = recurrence ?? newRecurrence()) => {
    setRecurrenceFrequency(current.frequency)
    setRecurrenceInterval(current.interval)
    setRecurrenceWeekdays(current.weekdays)
    setRecurrenceStart(current.startDate)
    setRecurrenceEnd(current.endDate)
    setRecurrenceOpen(true)
  }

  const saveRecurrence = () => {
    if (recurrenceFrequency === "weekly" && recurrenceWeekdays.length === 0) {
      setError("Выберите хотя бы один день недели")
      return
    }
    if (recurrenceEnd && recurrenceEnd < recurrenceStart) {
      setError("Дата окончания не может быть раньше даты начала")
      return
    }
    setRecurrence({ enabled: true, frequency: recurrenceFrequency, interval: recurrenceInterval, weekdays: recurrenceFrequency === "weekly" ? recurrenceWeekdays : [], startDate: recurrenceStart, endDate: recurrenceEnd })
    setRecurrenceEnabled(true)
    setRecurrenceOpen(false)
    setError("")
  }

  const cancelRecurrence = () => {
    setRecurrenceOpen(false)
    if (!recurrence) setRecurrenceEnabled(false)
    setError("")
  }

  const toggleRecurrence = () => {
    if (recurrenceEnabled) {
      setRecurrence(null)
      setRecurrenceEnabled(false)
      setRecurrenceOpen(false)
      return
    }
    setRecurrenceEnabled(true)
    openRecurrence(newRecurrence())
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (recurrenceOpen) return setError("Сохраните или отмените настройки повторения")
    if (!form.title.trim()) return setError("Укажите название задачи")
    if (!form.executor) return setError("Выберите исполнителя")
    setError("")
    setPending(true)
    try {
      const { id } = await createLeadTask({ leadId: lead.id, title: form.title, description: form.description, dueDate: form.dueDate, owner: form.executor, priority: form.priority })
      const source: TaskSource | undefined = form.sourceType && form.sourceId !== NO_SOURCE
        ? { type: form.sourceType, id: form.sourceId }
        : undefined
      const nextMeta: TaskMeta = {
        status: "Новая",
        creatorId: PROTOTYPE_CREATOR_ID,
        executorId: form.executor,
        coExecutors: form.coExecutors,
        observers: form.observers,
        attachments: files,
        ...(source?.type === "communication" ? { communicationId: source.id } : {}),
        ...(source ? { source } : {}),
        ...(recurrence ? { recurrence } : {}),
      }
      const nextCommunications = source?.type === "communication"
        ? [{ id: source.id, taskIds: [id] } as Communication]
        : undefined
      const updated = await updateLeadDetails(lead.id, {
        notes: [`Создана задача: ${form.title.trim()}`],
        details: {
          taskMeta: { ...taskMeta, [id]: nextMeta },
          ...(nextCommunications ? { communications: nextCommunications } : {}),
        },
      })
      onLeadUpdated?.(updated)
      await mutateCache(["lead-tasks", lead.id])
      toast.success("Задача создана")
      onCreated()
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать задачу")
    } finally {
      setPending(false)
    }
  }

  const selectedSource = sourceItems.find((item) => item.id === form.sourceId)
  const selectionButton = (label: string, values: string[], role: "coExecutors" | "observers") => (
    <div className="task-create-select-field">
      <span className="task-create-label">{label}</span>
      <div className="task-create-select-box">
        <UserRound aria-hidden="true" />
        <div className="task-create-chips">
          {values.map((name) => (
            <Badge key={name} variant="secondary" className="task-create-person-chip">
              {name}
              <button type="button" aria-label={`Убрать ${name} из поля «${label}»`} onClick={() => toggleEmployee(role, name)}><X /></button>
            </Badge>
          ))}
          <EmployeePicker multiple exclude={[...unavailable].filter((item) => !values.includes(item))} onSelect={(name) => toggleEmployee(role, name)}>
            <button type="button" className="task-create-picker-trigger" aria-label={`Выбрать: ${label}`}>
              {values.length ? <span>Добавить</span> : <span>Выберите сотрудника</span>}
              <ChevronDown />
            </button>
          </EmployeePicker>
        </div>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="task-create-dialog" aria-describedby="task-create-description" showCloseButton={false} onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus() }}>
        <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute top-4 right-4" aria-label="Закрыть"><X aria-hidden="true" /></Button></DialogClose>
        <DialogHeader className="task-create-header">
          <DialogTitle ref={titleRef} tabIndex={-1}>Создать задачу</DialogTitle>
          <DialogDescription id="task-create-description">Задача будет привязана к лиду «{lead.company}».</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="task-create-form">
          <div className="task-create-grid task-create-three-col">
            <label className="task-create-field">
              <span className="task-create-label">Крайний срок</span>
              <span className="task-create-input-icon"><CalendarDays aria-hidden="true" /><Input type="datetime-local" value={form.dueDate} onChange={(event) => updateForm({ dueDate: event.target.value })} aria-label="Крайний срок" /></span>
            </label>
            <label className="task-create-field">
              <span className="task-create-label">Приоритет <CircleAlert className="task-create-priority-icon" aria-hidden="true" /></span>
              <Select value={form.priority} onValueChange={(priority) => updateForm({ priority })}>
                <SelectTrigger aria-label="Приоритет"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{taskPriorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </label>
            <label className="task-create-field">
              <span className="task-create-label">Постановщик</span>
              <span className="task-create-input-icon task-create-readonly"><UserRound aria-hidden="true" /><Input value="Вы" readOnly aria-label="Постановщик" /></span>
            </label>
          </div>

          <div className="task-create-grid task-create-three-col">
            <label className="task-create-field">
              <span className="task-create-label">Исполнитель <span aria-hidden="true">*</span></span>
              <EmployeePicker exclude={[...unavailable].filter((name) => name !== form.executor)} current={form.executor} onSelect={(executor) => updateForm({ executor })}>
                <button type="button" className="task-create-employee-trigger" aria-label="Выбрать исполнителя" aria-invalid={error === "Выберите исполнителя"}>
                  <UserRound aria-hidden="true" />
                  {form.executor ? <span className="task-create-person-pill"><span className="task-create-avatar">{initials(form.executor)}</span>{form.executor}<span className="task-create-remove-hint">×</span></span> : <span>Выберите сотрудника</span>}
                  <ChevronDown aria-hidden="true" />
                </button>
              </EmployeePicker>
            </label>
            {selectionButton("Соисполнитель", form.coExecutors, "coExecutors")}
            {selectionButton("Наблюдатели", form.observers, "observers")}
          </div>

          <label className="task-create-field">
            <span className="task-create-label">Название задачи <span aria-hidden="true">*</span></span>
            <Input value={form.title} maxLength={200} onChange={(event) => updateForm({ title: event.target.value })} aria-invalid={Boolean(error && !form.title.trim())} />
          </label>
          <label className="task-create-field">
            <span className="task-create-label">Описание задачи</span>
            <Textarea rows={3} value={form.description} maxLength={2000} onChange={(event) => updateForm({ description: event.target.value })} />
          </label>

          <section className="task-create-attachments" aria-label="Вложения">
            <div className="task-create-attachment-heading"><Paperclip aria-hidden="true" /><AttachButton onFiles={(selected) => setFiles((current) => [...current, ...selected])}>Прикрепить файлы</AttachButton></div>
            {files.length > 0 && <FileList files={files} empty="" onRemove={(file) => setFiles((current) => current.filter((item) => item.id !== file.id))} />}
          </section>

          <section className="task-create-recurrence" aria-label="Повторение задачи">
            <div className="task-create-recurrence-heading">
              <button type="button" className="task-create-recurrence-toggle" aria-expanded={recurrenceOpen} onClick={() => recurrenceOpen ? cancelRecurrence() : openRecurrence()}><Repeat2 aria-hidden="true" />Повторять</button>
              <button type="button" role="switch" aria-checked={recurrenceEnabled} aria-label="Повторять задачу" className={`task-create-switch${recurrenceEnabled ? " is-on" : ""}`} onClick={toggleRecurrence}><span /></button>
            </div>
            {recurrenceOpen && (
              <div className="task-create-recurrence-panel">
                <label className="task-create-field task-create-frequency"><span className="task-create-label">Повторять</span>
                  <Select value={recurrenceFrequency} onValueChange={(value) => setRecurrenceFrequency(value as Frequency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      <SelectItem value="daily">Каждый день</SelectItem><SelectItem value="weekly">Каждую неделю</SelectItem><SelectItem value="monthly">Каждый месяц</SelectItem><SelectItem value="yearly">Каждый год</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </label>
                <label className="task-create-field task-create-interval"><span className="task-create-label">Интервал</span><span className="task-create-interval-control"><Input type="number" min={1} max={99} value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(Math.max(1, Number(event.target.value) || 1))} /><span>{recurrenceFrequency === "daily" ? "дн." : recurrenceFrequency === "weekly" ? "нед." : recurrenceFrequency === "monthly" ? "мес." : "лет"}</span></span></label>
                {recurrenceFrequency === "weekly" && <fieldset className="task-create-weekdays"><legend className="task-create-label">Дни недели</legend><div>{weekdays.map((day, index) => <button key={day} type="button" aria-pressed={recurrenceWeekdays.includes(index)} onClick={() => setRecurrenceWeekdays((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort())}>{day}</button>)}</div></fieldset>}
                <label className="task-create-field"><span className="task-create-label">Дата начала</span><span className="task-create-input-icon"><CalendarDays aria-hidden="true" /><Input type="date" value={recurrenceStart} onChange={(event) => setRecurrenceStart(event.target.value)} /></span></label>
                <label className="task-create-field"><span className="task-create-label">Дата окончания</span><span className="task-create-input-icon"><CalendarDays aria-hidden="true" /><Input type="date" value={recurrenceEnd} onChange={(event) => setRecurrenceEnd(event.target.value)} /></span><span className="task-create-never"><input type="checkbox" checked={!recurrenceEnd} onChange={(event) => setRecurrenceEnd(event.target.checked ? "" : recurrenceStart)} />Никогда</span></label>
                <div className="task-create-recurrence-actions"><Button type="button" variant="outline" size="sm" onClick={cancelRecurrence}>Отмена</Button><Button type="button" size="sm" onClick={saveRecurrence}>Сохранить</Button></div>
              </div>
            )}
            {recurrence && !recurrenceOpen && <p className="task-create-recurrence-summary">{recurrence.frequency === "daily" ? "Каждый день" : recurrence.frequency === "weekly" ? "Каждую неделю" : recurrence.frequency === "monthly" ? "Каждый месяц" : "Каждый год"} · с {recurrence.startDate} · {recurrence.endDate || "Никогда"}</p>}
          </section>

          <section className="task-create-source" aria-labelledby="task-create-source-heading">
            <h3 id="task-create-source-heading">Основание</h3>
            <fieldset className="task-create-source-types">
              <legend className="sr-only">Тип основания</legend>
              <label><input type="radio" name="task-source-type" checked={form.sourceType === "communication"} onChange={() => selectSourceType("communication")} />Коммуникация</label>
              <label><input type="radio" name="task-source-type" checked={form.sourceType === "task"} onChange={() => selectSourceType("task")} />Другая задача</label>
            </fieldset>
            {form.sourceType && (
              <div className="task-create-source-picker">
                <label className="task-create-source-search"><Search aria-hidden="true" /><Input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Поиск по названию..." aria-label="Поиск по названию" /><ChevronDown aria-hidden="true" /></label>
                {selectedSource ? (
                  <div className="task-create-source-selected"><span><strong>{selectedSource.title}</strong><small>{selectedSource.subtitle}</small></span><button type="button" aria-label="Убрать основание" onClick={() => updateForm({ sourceId: NO_SOURCE })}><X /></button></div>
                ) : sourceItems.length ? (
                  <ul className="task-create-source-results">{sourceItems.map((item) => <li key={item.id}><button type="button" onClick={() => updateForm({ sourceId: item.id })}><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><Check aria-hidden="true" /></button></li>)}</ul>
                ) : <p className="task-create-source-empty">{sourceQuery ? "Ничего не найдено" : "Нет доступных записей"}</p>}
              </div>
            )}
          </section>

          {error && <p role="alert" className="task-create-error">{error}</p>}
          <DialogFooter className="task-create-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button type="submit" disabled={pending}>{pending ? "Создание…" : "Создать задачу"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

