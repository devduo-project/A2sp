"use client"

import { useState, type FormEvent } from "react"
import { Building2, CircleDollarSign, Package, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Lead } from "@/components/lead-card"
import { CardShell, InfoRow } from "@/components/lead-detail/card-shell"
import { AttachButton, FileList } from "@/components/lead-detail/file-list"
import type { SaveLead } from "@/components/lead-detail/use-lead-save"
import { leadServices } from "@/lib/lead-services"
import { OTHER_REQUEST, amountFromValue, formatAddress, formatMeasure, formatRubles, parsePositive, unitCost } from "@/lib/lead-details"

export function ServiceCard({ lead, save }: { lead: Lead; save: SaveLead }) {
  const known = (leadServices as readonly string[]).includes(lead.request)
  const [otherMode, setOtherMode] = useState(!known)
  const [custom, setCustom] = useState(known ? "" : lead.request)
  const [pending, setPending] = useState(false)

  const selectService = async (value: string) => {
    if (value === OTHER_REQUEST) {
      setOtherMode(true)
      return
    }
    setOtherMode(false)
    if (value !== lead.request) await save({ request: value }, "Услуга обновлена")
  }

  const saveCustom = async () => {
    setPending(true)
    await save({ request: custom }, "Запрос заказчика сохранён")
    setPending(false)
  }

  return (
    <CardShell title="Услуга / Запрос заказчика" icon={Package}>
      <Select value={otherMode ? OTHER_REQUEST : lead.request} onValueChange={selectService}>
        <SelectTrigger aria-label="Услуга или запрос заказчика"><SelectValue placeholder="Выберите услугу" /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {leadServices.map((service) => <SelectItem key={service} value={service}>{service}</SelectItem>)}
            <SelectItem value={OTHER_REQUEST}>{OTHER_REQUEST}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {otherMode && (
        <div className="ld-inline-form">
          <Textarea value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Опишите запрос заказчика" aria-label="Описание запроса заказчика" maxLength={200} />
          <Button type="button" size="sm" disabled={pending || !custom.trim() || custom.trim() === lead.request} onClick={saveCustom}>{pending ? "Сохранение…" : "Сохранить запрос"}</Button>
        </div>
      )}
    </CardShell>
  )
}

function ObjectEditDialog({ lead, open, onOpenChange, save }: { lead: Lead; open: boolean; onOpenChange: (open: boolean) => void; save: SaveLead }) {
  const details = lead.details ?? {}
  const [form, setForm] = useState({
    objectName: lead.objectName ?? "",
    address: formatAddress(lead.address),
    area: details.area ?? "",
    floors: details.floors ?? "",
    volume: details.volume ?? "",
    projectDocumentation: details.projectDocumentation ?? "",
    previousSurvey: details.previousSurvey ?? "",
    comment: details.comment ?? "",
  })
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.objectName.trim()) return setError("Укажите название объекта")
    if (!form.address.trim()) return setError("Укажите адрес объекта")
    setError("")
    setPending(true)
    const { objectName, address, ...rest } = form
    const saved = await save({ objectName, address, details: rest }, "Данные объекта сохранены")
    setPending(false)
    if (saved) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ld-dialog">
        <DialogHeader>
          <DialogTitle>Объект и характеристики</DialogTitle>
          <DialogDescription>Адрес вводится через запятую: город, улица, дом, дополнительно.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="ld-form">
          <FieldGroup>
            <Field><FieldLabel htmlFor="ld-object-name">Название объекта</FieldLabel><Input id="ld-object-name" value={form.objectName} onChange={set("objectName")} maxLength={200} /></Field>
            <Field><FieldLabel htmlFor="ld-object-address">Адрес</FieldLabel><Input id="ld-object-address" value={form.address} onChange={set("address")} maxLength={500} /></Field>
            <div className="ld-form-grid">
              <Field><FieldLabel htmlFor="ld-area">Площадь, м²</FieldLabel><Input id="ld-area" inputMode="decimal" value={form.area} onChange={set("area")} /></Field>
              <Field><FieldLabel htmlFor="ld-floors">Этажность</FieldLabel><Input id="ld-floors" inputMode="numeric" value={form.floors} onChange={set("floors")} /></Field>
              <Field><FieldLabel htmlFor="ld-volume">Строительный объём, м³</FieldLabel><Input id="ld-volume" inputMode="decimal" value={form.volume} onChange={set("volume")} /></Field>
            </div>
            <Field><FieldLabel htmlFor="ld-project-doc">Проектная документация</FieldLabel><Textarea id="ld-project-doc" value={form.projectDocumentation} onChange={set("projectDocumentation")} maxLength={2000} /></Field>
            <Field><FieldLabel htmlFor="ld-prev-survey">Данные предыдущего обследования</FieldLabel><Textarea id="ld-prev-survey" value={form.previousSurvey} onChange={set("previousSurvey")} maxLength={2000} /></Field>
            <Field><FieldLabel htmlFor="ld-comment">Комментарий</FieldLabel><Textarea id="ld-comment" value={form.comment} onChange={set("comment")} maxLength={2000} /></Field>
          </FieldGroup>
          {error && <p role="alert" className="ld-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ObjectCard({ lead, save }: { lead: Lead; save: SaveLead }) {
  const [editing, setEditing] = useState(false)
  const details = lead.details ?? {}
  const amount = amountFromValue(lead.value)
  const area = parsePositive(details.area)
  const volume = parsePositive(details.volume)
  const sourceFiles = details.sourceFiles ?? []
  const text = (value?: string) => value?.trim() || "—"

  return (
    <CardShell
      title="Объект и характеристики"
      icon={Building2}
      actions={<Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil data-icon="inline-start" />Изменить</Button>}
    >
      <dl className="ld-info-grid">
        <InfoRow label="Название объекта">{text(lead.objectName)}</InfoRow>
        <InfoRow label="Адрес">{formatAddress(lead.address) || "—"}</InfoRow>
        <InfoRow label="Площадь">{formatMeasure(details.area, "м²")}</InfoRow>
        <InfoRow label="Этажность">{text(details.floors)}</InfoRow>
        <InfoRow label="Строительный объём">{formatMeasure(details.volume, "м³")}</InfoRow>
        <InfoRow label="Стоимость за 1 м²">{formatRubles(unitCost(amount, area))}</InfoRow>
        <InfoRow label="Стоимость за 1 м³">{formatRubles(unitCost(amount, volume))}</InfoRow>
        <InfoRow label="Проектная документация">{text(details.projectDocumentation)}</InfoRow>
        <InfoRow label="Данные предыдущего обследования">{text(details.previousSurvey)}</InfoRow>
        <InfoRow label="Комментарий">{text(details.comment)}</InfoRow>
      </dl>
      <div className="ld-subsection">
        <div className="ld-subsection-head">
          <h4>Исходные материалы</h4>
          <AttachButton onFiles={(files) => save({ details: { sourceFiles: [...sourceFiles, ...files] } }, "Исходные материалы добавлены")}>Прикрепить</AttachButton>
        </div>
        <FileList files={sourceFiles} empty="Исходные материалы не прикреплены" onRemove={(file) => save({ details: { sourceFiles: sourceFiles.filter((item) => item.id !== file.id) } })} />
      </div>
      {editing && <ObjectEditDialog lead={lead} open onOpenChange={setEditing} save={save} />}
    </CardShell>
  )
}

export function AmountCard({ lead, save }: { lead: Lead; save: SaveLead }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const amount = amountFromValue(lead.value)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const digits = draft.replace(/[^\d]/g, "")
    if (!digits || Number(digits) <= 0) return setError("Введите сумму больше нуля")
    setError("")
    setPending(true)
    const saved = await save({ value: digits }, "Сумма расчёта обновлена")
    setPending(false)
    if (saved) setEditing(false)
  }

  return (
    <CardShell title="Сумма расчёта" icon={CircleDollarSign}>
      {editing ? (
        <form onSubmit={submit} className="ld-amount-form">
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} inputMode="numeric" aria-label="Сумма расчёта в рублях" aria-invalid={Boolean(error)} autoFocus />
          {error && <p role="alert" className="ld-error">{error}</p>}
          <div className="ld-button-row">
            <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(false); setError("") }}>Отмена</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</Button>
          </div>
        </form>
      ) : (
        <div className="ld-amount">
          <strong>{formatRubles(amount)}</strong>
          <Button type="button" variant="ghost" size="icon" aria-label="Изменить сумму расчёта" onClick={() => { setDraft(amount === null ? "" : String(amount)); setEditing(true) }}><Pencil /></Button>
        </div>
      )}
    </CardShell>
  )
}
