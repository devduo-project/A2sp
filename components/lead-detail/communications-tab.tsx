"use client"

import { useEffect, useState, type FormEvent } from "react"
import { ChevronDown, Link2, Mail, MessageSquare, MoreHorizontal, Phone, Plus } from "lucide-react"
import type { LeadTaskRow } from "@/app/actions/lead-details"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { SaveLead } from "@/components/lead-detail/use-lead-save"
import { cn } from "@/lib/utils"
import { communicationTypes, formatDateTime, type Communication, type CommunicationType } from "@/lib/lead-details"

const typeIcons = { "Звонок": Phone, "Электронное письмо": Mail, "Переписка": MessageSquare, "Другое": MoreHorizontal } as const

function localInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function CommunicationDialog({ open, onOpenChange, contactNames, save }: { open: boolean; onOpenChange: (open: boolean) => void; contactNames: string[]; save: SaveLead }) {
  const [form, setForm] = useState({ type: "Звонок" as CommunicationType, at: localInputValue(), participant: "", subject: "", notes: "" })
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.subject.trim()) return setError("Укажите тему или краткое описание")
    setError("")
    setPending(true)
    const entry: Communication = { id: crypto.randomUUID(), type: form.type, at: new Date(form.at).toISOString(), participant: form.participant, subject: form.subject, notes: form.notes, taskIds: [] }
    const saved = await save({ details: { communications: [entry] } }, "Коммуникация добавлена")
    setPending(false)
    if (saved) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ld-dialog">
        <DialogHeader>
          <DialogTitle>Новая коммуникация</DialogTitle>
          <DialogDescription>Зафиксируйте взаимодействие с заказчиком по этому лиду.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="ld-form">
          <FieldGroup>
            <div className="ld-form-grid">
              <Field>
                <FieldLabel htmlFor="ld-comm-type">Тип</FieldLabel>
                <Select value={form.type} onValueChange={(type) => setForm({ ...form, type: type as CommunicationType })}>
                  <SelectTrigger id="ld-comm-type"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{communicationTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field><FieldLabel htmlFor="ld-comm-at">Дата и время</FieldLabel><Input id="ld-comm-at" type="datetime-local" value={form.at} onChange={(event) => setForm({ ...form, at: event.target.value })} /></Field>
            </div>
            <Field>
              <FieldLabel htmlFor="ld-comm-participant">Контактное лицо / участник</FieldLabel>
              <Input id="ld-comm-participant" list="ld-comm-contacts" value={form.participant} onChange={(event) => setForm({ ...form, participant: event.target.value })} maxLength={200} />
              <datalist id="ld-comm-contacts">{contactNames.map((name) => <option key={name} value={name} />)}</datalist>
            </Field>
            <Field><FieldLabel htmlFor="ld-comm-subject">Тема / краткое описание</FieldLabel><Input id="ld-comm-subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} maxLength={200} /></Field>
            <Field><FieldLabel htmlFor="ld-comm-notes">Подробности</FieldLabel><Textarea id="ld-comm-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={2000} /></Field>
          </FieldGroup>
          {error && <p role="alert" className="ld-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button type="submit" disabled={pending}>{pending ? "Сохранение…" : "Добавить"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CommunicationsTab({
  communications,
  tasks,
  contactNames,
  save,
  focusId,
  onCreateTask,
  onOpenTask,
}: {
  communications: Communication[]
  tasks: LeadTaskRow[]
  contactNames: string[]
  save: SaveLead
  focusId?: string
  onCreateTask: (communicationId: string) => void
  onOpenTask: (taskId: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState<string[]>(focusId ? [focusId] : [])

  useEffect(() => {
    if (!focusId) return
    setExpanded((current) => (current.includes(focusId) ? current : [...current, focusId]))
    document.getElementById(`ld-comm-${focusId}`)?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [focusId])

  const toggle = (id: string) => setExpanded((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  return (
    <section className="ld-card ld-tab-card" aria-labelledby="ld-comm-title">
      <header className="ld-card-head">
        <h3 id="ld-comm-title">Коммуникации с заказчиком</h3>
        <Button type="button" size="sm" onClick={() => setAdding(true)}><Plus data-icon="inline-start" />Добавить коммуникацию</Button>
      </header>
      {communications.length === 0 ? (
        <div className="ld-empty-block"><p>Коммуникаций по этому лиду пока нет</p><Button type="button" size="sm" onClick={() => setAdding(true)}><Plus data-icon="inline-start" />Добавить коммуникацию</Button></div>
      ) : (
        <ol className="ld-timeline">
          {[...communications].reverse().map((item) => {
            const Icon = typeIcons[item.type] ?? MoreHorizontal
            const isOpen = expanded.includes(item.id)
            return (
              <li key={item.id} id={`ld-comm-${item.id}`} data-focused={focusId === item.id || undefined}>
                <span className="ld-timeline-icon"><Icon aria-hidden="true" /></span>
                <div className="ld-timeline-body">
                  <button type="button" className="ld-timeline-head" aria-expanded={isOpen} onClick={() => toggle(item.id)}>
                    <span className="ld-timeline-title"><Badge variant="secondary">{item.type}</Badge><strong>{item.subject}</strong></span>
                    <span className="ld-muted" suppressHydrationWarning>{formatDateTime(item.at)}{item.participant ? ` · ${item.participant}` : ""}</span>
                    <ChevronDown aria-hidden="true" className={cn(isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="ld-timeline-details">
                      <p>{item.notes || "Подробности не указаны"}</p>
                      <div className="ld-task-tags">
                        {item.taskIds.map((taskId) => {
                          const task = tasks.find((row) => row.id === taskId)
                          return <button key={taskId} type="button" className="ld-link" onClick={() => onOpenTask(taskId)}><Link2 aria-hidden="true" />Задача: {task?.title ?? `№${taskId}`}</button>
                        })}
                        <Button type="button" variant="outline" size="sm" onClick={() => onCreateTask(item.id)}><Plus data-icon="inline-start" />Создать задачу</Button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {adding && <CommunicationDialog open onOpenChange={setAdding} contactNames={contactNames} save={save} />}
    </section>
  )
}
