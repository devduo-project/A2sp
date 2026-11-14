"use client"

import { useRef, useState, type CSSProperties } from "react"
import { ArrowLeft, Check, Clock, Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { updateLeadFields } from "@/app/actions/leads"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Lead } from "@/components/lead-card"
import { leadStageColors, isLeadStage } from "@/lib/lead-stages"
import { cn } from "@/lib/utils"

const DAY_MS = 24 * 60 * 60 * 1000

function pluralizeDays(count: number) {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return "дней"
  if (mod10 === 1) return "день"
  if (mod10 >= 2 && mod10 <= 4) return "дня"
  return "дней"
}

function daysInStage(lead: Lead) {
  const entered = lead.stageEnteredAt ? Date.parse(lead.stageEnteredAt) : NaN
  if (!Number.isNaN(entered)) return Math.max(0, Math.floor((Date.now() - entered) / DAY_MS))
  return Math.max(0, Math.floor(Number(lead.days) || 0))
}

type EditableNameProps = {
  value: string
  label: string
  variant: "primary" | "secondary"
  placeholder: string
  onSave: (next: string) => Promise<void>
}

function EditableName({ value, label, variant, placeholder, onSave }: EditableNameProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const savingRef = useRef(false)

  const start = () => {
    setDraft(value)
    setError("")
    setEditing(true)
  }
  const cancel = () => {
    if (savingRef.current) return
    setEditing(false)
    setError("")
  }
  const save = async () => {
    if (savingRef.current) return
    const next = draft.trim()
    if (!next) {
      setError("Поле не может быть пустым")
      return
    }
    if (next === value) {
      setEditing(false)
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      await onSave(next)
      setEditing(false)
      setError("")
    } catch (caught) {
      const message = caught instanceof Error && caught.message ? caught.message : "Не удалось сохранить"
      setError(message)
      toast.error("Не удалось сохранить", { description: message })
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const TitleTag = variant === "primary" ? "h1" : "p"

  if (editing) {
    return (
      <div className="lead-name-editor" data-variant={variant}>
        <div className="lead-name-editor-row">
          <Input
            autoFocus
            value={draft}
            maxLength={200}
            disabled={saving}
            aria-label={label}
            aria-invalid={Boolean(error)}
            placeholder={placeholder}
            onChange={(event) => { setDraft(event.target.value); if (error) setError("") }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) return
              if (event.key === "Enter") { event.preventDefault(); void save() }
              if (event.key === "Escape") { event.preventDefault(); cancel() }
            }}
          />
          <Button type="button" size="icon" variant="outline" aria-label="Сохранить" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Отменить" disabled={saving} onClick={cancel}>
            <X />
          </Button>
        </div>
        {error && <span role="alert" className="lead-name-error">{error}</span>}
      </div>
    )
  }

  return (
    <div className="lead-name" data-variant={variant}>
      <TitleTag title={value}>{value || "—"}</TitleTag>
      <button type="button" className="lead-name-edit" aria-label={`Изменить: ${label}`} onClick={start}>
        <Pencil aria-hidden="true" />
      </button>
    </div>
  )
}

type LeadDetailHeaderProps = {
  lead: Lead
  stages: readonly string[]
  onBack: () => void
  onStageChange: (stage: string) => Promise<void>
  onLeadUpdated: (lead: Lead) => void
}

export function LeadDetailHeader({ lead, stages, onBack, onStageChange, onLeadUpdated }: LeadDetailHeaderProps) {
  const [pendingStage, setPendingStage] = useState<string | null>(null)
  const pendingRef = useRef(false)

  const visibleStage = pendingStage ?? lead.stage
  const currentIndex = stages.indexOf(visibleStage)
  const days = daysInStage(lead)

  const changeStage = async (target: string) => {
    if (target === lead.stage || pendingRef.current) return
    pendingRef.current = true
    setPendingStage(target)
    try {
      await onStageChange(target)
      toast.success("Стадия изменена", { description: `${lead.company} → ${target}` })
    } catch (caught) {
      toast.error("Не удалось изменить стадию", { description: caught instanceof Error && caught.message ? caught.message : "Лид оставлен на прежней стадии" })
    } finally {
      pendingRef.current = false
      setPendingStage(null)
    }
  }

  const saveField = (field: "company" | "objectName") => async (next: string) => {
    const updated = await updateLeadFields(lead.id, { [field]: next })
    onLeadUpdated({ ...lead, ...updated, stage: lead.stage, stageEnteredAt: lead.stageEnteredAt, days: lead.days })
  }

  return (
    <header className="lead-header">
      <div className="lead-header-top">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="lead-back" aria-label="Вернуться к лидам" onClick={onBack}>
                <ArrowLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Вернуться к лидам</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="lead-identity">
          <EditableName value={lead.company} label="Название компании" variant="primary" placeholder="Компания или заказчик" onSave={saveField("company")} />
          <EditableName value={lead.objectName ?? ""} label="Название объекта" variant="secondary" placeholder="Название объекта" onSave={saveField("objectName")} />
          <span className="lead-stage-days" suppressHydrationWarning>
            <Clock aria-hidden="true" />
            На стадии: {days} {pluralizeDays(days)}
          </span>
        </div>
      </div>

      <nav className="lead-pipeline-wrap" aria-label="Стадии лида">
        <ol className="lead-pipeline" aria-busy={pendingStage !== null}>
          {stages.map((stage, index) => {
            const isCurrent = index === currentIndex
            const isDone = currentIndex >= 0 && index < currentIndex
            const isPending = pendingStage === stage
            const color = isLeadStage(stage) ? leadStageColors[stage] : "#7C8798"
            return (
              <li key={stage} className="lead-pipeline-item">
                <button
                  type="button"
                  className={cn("lead-pipeline-step", isCurrent && "is-current", isDone && "is-done", !isCurrent && !isDone && "is-future")}
                  style={{ "--stage-color": color } as CSSProperties}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-disabled={pendingStage !== null}
                  title={isCurrent ? "Текущая стадия" : "Дважды щёлкните, чтобы перевести лид на эту стадию"}
                  onDoubleClick={() => void changeStage(stage)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.repeat) { event.preventDefault(); void changeStage(stage) }
                  }}
                >
                  {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : isDone ? <Check aria-hidden="true" /> : null}
                  <span>{stage}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <p className="sr-only">Чтобы изменить стадию, дважды щёлкните по нужной стадии или нажмите Enter.</p>
    </header>
  )
}
