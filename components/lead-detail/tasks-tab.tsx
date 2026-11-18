"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Link2, Plus } from "lucide-react"
import { toast } from "sonner"
import { createLeadTask } from "@/app/actions/lead-records"
import type { LeadTaskRow } from "@/app/actions/lead-details"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Lead } from "@/components/lead-card"
import type { SaveLead } from "@/components/lead-detail/use-lead-save"
import { employees } from "@/lib/employees"
import { formatDateTime, taskStatuses, type Communication, type TaskStatus } from "@/lib/lead-details"
import { taskPriorities } from "@/lib/task-priorities"

const NO_COMMUNICATION = "none"

export function TaskDialog({
  lead,
  open,
  onOpenChange,
  initialCommunicationId,
  save,
  onCreated,
}: {
  lead: Lead
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCommunicationId?: string
  save: SaveLead
  onCreated: () => void
}) {
  const communications = lead.details?.communications ?? []
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", owner: lead.owner, priority: "Средний", communicationId: initialCommunicationId ?? NO_COMMUNICATION })
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return setError("Укажите название задачи")
    setError("")
    setPending(true)
    try {
      const { id } = await createLeadTask({ leadId: lead.id, title: form.title, description: form.description, dueDate: form.dueDate, owner: form.owner, priority: form.priority })
      const communicationId = form.communicationId === NO_COMMUNICATION ? "" : form.communicationId
      await save({
        notes: [`Создана задача: ${form.title.trim()}`],
        ...(communicationId
          ? { details: { communications: [{ id: communicationId, taskIds: [id] } as Communication], taskMeta: { ...(lead.details?.taskMeta ?? {}), [id]: { status: "Новая" as TaskStatus, communicationId } } } }
          : {}),
      })
      toast.success("Задача создана")
      onCreated()
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать задачу")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ld-dialog">
        <DialogHeader>
          <DialogTitle>Новая задача</DialogTitle>
          <DialogDescription>Задача будет привязана к лиду «{lead.company}».</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="ld-form">
          <FieldGroup>
            <Field><FieldLabel htmlFor="ld-task-title">Название задачи</FieldLabel><Input id="ld-task-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} autoFocus /></Field>
            <Field><FieldLabel htmlFor="ld-task-desc">Описание</FieldLabel><Textarea id="ld-task-desc" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={2000} /></Field>
            <div className="ld-form-grid">
              <Field><FieldLabel htmlFor="ld-task-due">Дата и время</FieldLabel><Input id="ld-task-due" type="datetime-local" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
              <Field>
                <FieldLabel htmlFor="ld-task-owner">Ответственный</FieldLabel>
                <Select value={form.owner} onValueChange={(owner) => setForm({ ...form, owner })}>
                  <SelectTrigger id="ld-task-owner"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{employees.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="ld-task-priority">Приоритет</FieldLabel>
                <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
                  <SelectTrigger id="ld-task-priority"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{taskPriorities.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="ld-task-comm">Основание: коммуникация</FieldLabel>
              <Select value={form.communicationId} onValueChange={(communicationId) => setForm({ ...form, communicationId })}>
                <SelectTrigger id="ld-task-comm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NO_COMMUNICATION}>Без связи с коммуникацией</SelectItem>
                    {communications.map((item) => <SelectItem key={item.id} value={item.id}>{item.type}: {item.subject}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {error && <p role="alert" className="ld-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button type="submit" disabled={pending}>{pending ? "Создание…" : "Создать задачу"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TasksTab({
  lead,
  tasks,
  loading,
  failed,
  save,
  focusId,
  onCreate,
  onOpenCommunication,
}: {
  lead: Lead
  tasks: LeadTaskRow[]
  loading: boolean
  failed: boolean
  save: SaveLead
  focusId?: number
  onCreate: () => void
  onOpenCommunication: (id: string) => void
}) {
  const taskMeta = lead.details?.taskMeta ?? {}
  const communications = lead.details?.communications ?? []
  const [updating, setUpdating] = useState<number | null>(null)

  useEffect(() => {
    if (focusId) document.getElementById(`ld-task-${focusId}`)?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [focusId, tasks.length])

  const changeStatus = async (id: number, status: string) => {
    setUpdating(id)
    await save({ details: { taskMeta: { ...taskMeta, [id]: { ...taskMeta[id], status: status as TaskStatus } } } })
    setUpdating(null)
  }

  return (
    <section className="ld-card ld-tab-card" aria-labelledby="ld-tasks-title">
      <header className="ld-card-head">
        <h3 id="ld-tasks-title">Задачи по лиду</h3>
        <Button type="button" size="sm" onClick={onCreate}><Plus data-icon="inline-start" />Новая задача</Button>
      </header>
      {loading ? (
        <p className="ld-empty-text">Загрузка задач…</p>
      ) : failed ? (
        <p role="alert" className="ld-error">Не удалось загрузить задачи</p>
      ) : tasks.length === 0 ? (
        <div className="ld-empty-block"><p>По этому лиду пока нет задач</p><Button type="button" size="sm" onClick={onCreate}><Plus data-icon="inline-start" />Создать задачу</Button></div>
      ) : (
        <div className="ld-table-scroll">
          <table className="ld-table">
            <thead><tr><th>Название задачи</th><th>Дата и время</th><th>Ответственный</th><th>Статус</th></tr></thead>
            <tbody>
              {tasks.map((task) => {
                const meta = taskMeta[task.id]
                const source = meta?.communicationId ? communications.find((item) => item.id === meta.communicationId) : undefined
                return (
                  <tr key={task.id} id={`ld-task-${task.id}`} data-focused={focusId === task.id || undefined}>
                    <td>
                      <strong>{task.title}</strong>
                      {task.description && <p className="ld-muted">{task.description}</p>}
                      <div className="ld-task-tags">
                        <Badge variant="secondary">{task.priority}</Badge>
                        {source && <button type="button" className="ld-link" onClick={() => onOpenCommunication(source.id)}><Link2 aria-hidden="true" />Коммуникация: {source.subject}</button>}
                      </div>
                    </td>
                    <td suppressHydrationWarning>{task.dueDate ? formatDateTime(task.dueDate) : "—"}</td>
                    <td>{task.owner || "—"}</td>
                    <td>
                      <Select value={meta?.status ?? "Новая"} onValueChange={(status) => changeStatus(task.id, status)} disabled={updating === task.id}>
                        <SelectTrigger size="sm" aria-label={`Статус задачи ${task.title}`} data-status={meta?.status ?? "Новая"}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectGroup>{taskStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectGroup></SelectContent>
                      </Select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
