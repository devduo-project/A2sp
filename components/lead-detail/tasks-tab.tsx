"use client"

import { useEffect, useState } from "react"
import { Link2, Plus } from "lucide-react"
import type { LeadTaskRow } from "@/app/actions/lead-details"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Lead } from "@/components/lead-card"
import type { SaveLead } from "@/components/lead-detail/use-lead-save"
import { formatDateTime, taskStatuses, type TaskStatus } from "@/lib/lead-details"

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
      <header className="ld-card-head ld-tasks-head">
        <h3 id="ld-tasks-title">Задачи по лиду</h3>
        <Button type="button" size="sm" onClick={onCreate}><Plus data-icon="inline-start" />Новая задача</Button>
      </header>
      {loading ? (
        <p className="ld-empty-text">Загрузка задач…</p>
      ) : failed ? (
        <p role="alert" className="ld-error">Не удалось загрузить задачи</p>
      ) : tasks.length === 0 ? (
        <div className="ld-empty-block"><p>По этому лиду пока нет задач</p></div>
      ) : (
        <div className="ld-table-scroll">
          <table className="ld-table">
            <thead><tr><th>Название задачи</th><th>Дата и время</th><th>Ответственный</th><th>Статус</th></tr></thead>
            <tbody>
              {tasks.map((task) => {
                const meta = taskMeta[task.id]
                const source = meta?.communicationId ? communications.find((item) => item.id === meta.communicationId) : undefined
                const sourceTask = meta?.source?.type === "task" ? tasks.find((item) => String(item.id) === meta.source?.id) : undefined
                return (
                  <tr key={task.id} id={`ld-task-${task.id}`} data-focused={focusId === task.id || undefined}>
                    <td>
                      <strong>{task.title}</strong>
                      {task.description && <p className="ld-muted">{task.description}</p>}
                      <div className="ld-task-tags">
                        <Badge variant="secondary">{task.priority}</Badge>
                        {source && <button type="button" className="ld-link" onClick={() => onOpenCommunication(source.id)}><Link2 aria-hidden="true" />Коммуникация: {source.subject}</button>}
                        {sourceTask && <span className="ld-task-meta-label"><Link2 aria-hidden="true" />Основание: {sourceTask.title}</span>}
                        {meta?.creatorId === "crm-prototype-user" && <Badge variant="outline">Постановщик: Вы</Badge>}
                        {meta?.coExecutors?.map((name) => <Badge key={`co-${name}`} variant="outline">Соисполнитель: {name}</Badge>)}
                        {meta?.observers?.map((name) => <Badge key={`observer-${name}`} variant="outline">Наблюдатель: {name}</Badge>)}
                        {meta?.recurrence?.enabled && <Badge variant="outline"><span className="ld-recurrence-badge">Повтор · {meta.recurrence.frequency === "daily" ? "день" : meta.recurrence.frequency === "weekly" ? "неделя" : meta.recurrence.frequency === "monthly" ? "месяц" : "год"}</span></Badge>}
                        {meta?.attachments?.map((file) => <Badge key={file.id} variant="outline">{file.name}</Badge>)}
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
