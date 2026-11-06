"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createLeadContact, createLeadTask, type SavedContact } from "@/app/actions/lead-records"
import { taskPriorities } from "@/lib/task-priorities"
import { updateLeadFields, type LeadFieldsPatch } from "@/app/actions/leads"
import type { Lead } from "@/components/lead-card"
import type { QuickActionType } from "@/components/lead-quick-actions"
import { employees } from "@/lib/employees"

type EditableAction = Exclude<QuickActionType, "link" | "duplicate">

type LeadActionDialogsProps = {
  lead: Lead | null
  action: EditableAction | null
  onClose: () => void
  onLeadUpdated: (lead: Lead) => void
  onContactCreated: (contact: SavedContact) => void
}

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : "Не удалось сохранить изменения")

export function LeadActionDialogs({ lead, action, onClose, onLeadUpdated, onContactCreated }: LeadActionDialogsProps) {
  const open = Boolean(lead && action)
  const wide = action === "task" || action === "contact"

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={wide ? "glass-dialog glass-dialog-wide" : "glass-dialog"} aria-describedby="lead-action-description">
        {lead && action && (
          <ActionForm key={`${lead.id}-${action}`} lead={lead} action={action} onClose={onClose} onLeadUpdated={onLeadUpdated} onContactCreated={onContactCreated} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ActionForm({ lead, action, onClose, onLeadUpdated, onContactCreated }: Omit<LeadActionDialogsProps, "lead" | "action"> & { lead: Lead; action: EditableAction }) {
  switch (action) {
    case "task":
      return <TaskForm lead={lead} onClose={onClose} />
    case "contact":
      return <ContactForm lead={lead} onClose={onClose} onCreated={onContactCreated} />
    case "name":
      return (
        <SimpleFieldForm
          lead={lead}
          title="Изменить наименование объекта"
          description={`Лид ${lead.id}. Название отображается на карточке лида.`}
          label="Наименование объекта"
          initial={lead.objectName ?? ""}
          requiredMessage="Укажите наименование объекта"
          toPatch={(value) => ({ objectName: value })}
          successMessage="Наименование объекта обновлено"
          onClose={onClose}
          onLeadUpdated={onLeadUpdated}
        />
      )
    case "customer":
      return (
        <SimpleFieldForm
          lead={lead}
          title="Изменить заказчика"
          description={`Лид ${lead.id}. Название компании-заказчика.`}
          label="Заказчик"
          initial={lead.company}
          requiredMessage="Укажите заказчика"
          toPatch={(value) => ({ company: value })}
          successMessage="Заказчик обновлён"
          onClose={onClose}
          onLeadUpdated={onLeadUpdated}
        />
      )
    case "amount":
      return <AmountForm lead={lead} onClose={onClose} onLeadUpdated={onLeadUpdated} />
    case "address":
      return <AddressForm lead={lead} onClose={onClose} onLeadUpdated={onLeadUpdated} />
  }
}

function FormShell({ title, description, onSubmit, pending, submitLabel = "Сохранить", onClose, children }: { title: string; description: string; onSubmit: (event: FormEvent) => void; pending: boolean; submitLabel?: string; onClose: () => void; children: ReactNode }) {
  return (
    <form onSubmit={onSubmit} noValidate className="glass-form">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription id="lead-action-description">{description}</DialogDescription>
      </DialogHeader>
      <div className="glass-fields">{children}</div>
      <DialogFooter className="glass-footer">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="glass-field">
      <span>
        {label}
        {required && <b aria-hidden> *</b>}
      </span>
      {children}
      {error && (
        <em role="alert" className="glass-error">
          {error}
        </em>
      )}
    </label>
  )
}

function SimpleFieldForm({ lead, title, description, label, initial, requiredMessage, toPatch, successMessage, onClose, onLeadUpdated }: { lead: Lead; title: string; description: string; label: string; initial: string; requiredMessage: string; toPatch: (value: string) => LeadFieldsPatch; successMessage: string; onClose: () => void; onLeadUpdated: (lead: Lead) => void }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return setError(requiredMessage)
    setPending(true)
    try {
      const updated = await updateLeadFields(lead.id, toPatch(value))
      onLeadUpdated(updated)
      toast.success(successMessage)
      onClose()
    } catch (reason) {
      toast.error(messageOf(reason))
      setPending(false)
    }
  }

  return (
    <FormShell title={title} description={description} onSubmit={submit} pending={pending} onClose={onClose}>
      <Field label={label} error={error} required>
        <Input autoFocus value={value} maxLength={200} aria-invalid={Boolean(error)} onChange={(event) => { setValue(event.target.value); setError("") }} />
      </Field>
    </FormShell>
  )
}

const ruNumber = new Intl.NumberFormat("ru-RU")

function AmountForm({ lead, onClose, onLeadUpdated }: { lead: Lead; onClose: () => void; onLeadUpdated: (lead: Lead) => void }) {
  const [digits, setDigits] = useState(lead.value.replace(/\D/g, ""))
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const display = digits ? ruNumber.format(Number(digits)) : ""

  const change = (raw: string) => {
    if (raw.includes("-")) return setError("Сумма не может быть отрицательной")
    if (/[^\d\s\u00a0\u202f]/.test(raw.replace(/[₽]/g, ""))) return setError("Введите сумму цифрами")
    setError("")
    setDigits(raw.replace(/\D/g, "").slice(0, 12))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!digits) return setError("Укажите сумму")
    setPending(true)
    try {
      const updated = await updateLeadFields(lead.id, { value: digits })
      onLeadUpdated(updated)
      toast.success("Сумма обновлена")
      onClose()
    } catch (reason) {
      toast.error(messageOf(reason))
      setPending(false)
    }
  }

  return (
    <FormShell title="Изменить сумму" description={`Лид ${lead.id}. Сумма сделки в рублях.`} onSubmit={submit} pending={pending} onClose={onClose}>
      <Field label="Сумма" error={error} required>
        <div className="glass-amount">
          <Input autoFocus inputMode="numeric" autoComplete="off" value={display} placeholder="0" aria-invalid={Boolean(error)} onChange={(event) => change(event.target.value)} />
          <span aria-hidden>₽</span>
        </div>
      </Field>
    </FormShell>
  )
}

function AddressForm({ lead, onClose, onLeadUpdated }: { lead: Lead; onClose: () => void; onLeadUpdated: (lead: Lead) => void }) {
  const [form, setForm] = useState({ city: lead.address?.city ?? "", street: lead.address?.street ?? "", building: lead.address?.building ?? "", additional: lead.address?.additional ?? "" })
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const update = (key: keyof typeof form, value: string) => { setForm((current) => ({ ...current, [key]: value })); setError("") }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!Object.values(form).some((part) => part.trim())) return setError("Укажите адрес объекта")
    setPending(true)
    try {
      const updated = await updateLeadFields(lead.id, { address: form })
      onLeadUpdated(updated)
      toast.success("Адрес обновлён")
      onClose()
    } catch (reason) {
      toast.error(messageOf(reason))
      setPending(false)
    }
  }

  return (
    <FormShell title="Изменить адрес" description={`Лид ${lead.id}. Адрес объекта.`} onSubmit={submit} pending={pending} onClose={onClose}>
      <Field label="Город" error={error}>
        <Input autoFocus value={form.city} maxLength={120} onChange={(event) => update("city", event.target.value)} />
      </Field>
      <Field label="Улица">
        <Input value={form.street} maxLength={200} onChange={(event) => update("street", event.target.value)} />
      </Field>
      <Field label="Дом / корпус">
        <Input value={form.building} maxLength={80} onChange={(event) => update("building", event.target.value)} />
      </Field>
      <Field label="Дополнительно">
        <Input value={form.additional} maxLength={200} onChange={(event) => update("additional", event.target.value)} />
      </Field>
    </FormShell>
  )
}

function TaskForm({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", owner: lead.owner, priority: "Средний" })
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const owners = [...new Set([lead.owner, ...employees].filter(Boolean))]

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return setError("Укажите название задачи")
    setPending(true)
    try {
      await createLeadTask({ leadId: lead.id, ...form })
      toast.success("Задача создана")
      onClose()
    } catch (reason) {
      toast.error(messageOf(reason))
      setPending(false)
    }
  }

  return (
    <FormShell title="Создать задачу" description={`Задача будет привязана к лиду ${lead.id}, ${lead.company}.`} onSubmit={submit} pending={pending} submitLabel="Создать задачу" onClose={onClose}>
      <Field label="Название задачи" error={error} required>
        <Input autoFocus value={form.title} maxLength={200} aria-invalid={Boolean(error)} onChange={(event) => { setForm({ ...form, title: event.target.value }); setError("") }} />
      </Field>
      <Field label="Описание">
        <Textarea rows={3} value={form.description} maxLength={2000} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </Field>
      <div className="glass-row">
        <Field label="Дата выполнения">
          <Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
        </Field>
        <Field label="Приоритет">
          <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {taskPriorities.map((priority) => (
                <SelectItem key={priority} value={priority}>{priority}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Ответственный">
        <Select value={form.owner} onValueChange={(owner) => setForm({ ...form, owner })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {owners.map((owner) => (
              <SelectItem key={owner} value={owner}>{owner}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormShell>
  )
}

function ContactForm({ lead, onClose, onCreated }: { lead: Lead; onClose: () => void; onCreated: (contact: SavedContact) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", role: "", phone: "", email: "", comment: "" })
  const [errors, setErrors] = useState<{ firstName?: string; email?: string }>({})
  const [pending, setPending] = useState(false)
  const update = (key: keyof typeof form, value: string) => { setForm((current) => ({ ...current, [key]: value })); setErrors({}) }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!form.firstName.trim()) next.firstName = "Укажите имя контакта"
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Введите корректный email"
    if (next.firstName || next.email) return setErrors(next)
    setPending(true)
    try {
      const contact = await createLeadContact({ leadId: lead.id, ...form })
      onCreated(contact)
      toast.success("Контакт добавлен")
      onClose()
    } catch (reason) {
      toast.error(messageOf(reason))
      setPending(false)
    }
  }

  return (
    <FormShell title="Добавить контакт" description={`Контакт будет привязан к лиду ${lead.id}, ${lead.company}.`} onSubmit={submit} pending={pending} onClose={onClose}>
      <div className="glass-row">
        <Field label="Имя контакта" error={errors.firstName} required>
          <Input autoFocus value={form.firstName} maxLength={120} aria-invalid={Boolean(errors.firstName)} onChange={(event) => update("firstName", event.target.value)} />
        </Field>
        <Field label="Фамилия">
          <Input value={form.lastName} maxLength={120} onChange={(event) => update("lastName", event.target.value)} />
        </Field>
      </div>
      <Field label="Должность">
        <Input value={form.role} maxLength={160} onChange={(event) => update("role", event.target.value)} />
      </Field>
      <div className="glass-row">
        <Field label="Телефон">
          <Input type="tel" value={form.phone} maxLength={40} onChange={(event) => update("phone", event.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} maxLength={200} aria-invalid={Boolean(errors.email)} onChange={(event) => update("email", event.target.value)} />
        </Field>
      </div>
      <Field label="Комментарий">
        <Textarea rows={3} value={form.comment} maxLength={2000} onChange={(event) => update("comment", event.target.value)} />
      </Field>
    </FormShell>
  )
}
