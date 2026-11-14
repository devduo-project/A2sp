"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createLead } from "@/app/actions/leads"
import type { SavedContact } from "@/app/actions/lead-records"
import type { Lead } from "@/components/lead-card"
import { Field, FormShell } from "@/components/lead-action-dialogs"
import { employees } from "@/lib/employees"

const directions = ["А2-СП", "ИП", "МГСУ"]
const quoteStatuses = ["КП озвучено", "КП отправлено"]
const serviceChoices = [
  { value: "Проектирование", label: "Проектирование" },
  { value: "Обследование зданий и сооружений", label: "Обследование зданий и сооружений" },
  { value: "Мониторинг", label: "Мониторинг" },
  { value: "Проектирование композитных конструкций", label: "Проектирование композитных конструкций" },
  { value: "Инженерные изыскания", label: "Инженерные изыскания" },
  { value: "Геофизические исследования", label: "Геофизические исследования" },
  { value: "Испытание анкеров", label: "Испытание анкеров" },
  { value: "Натурные испытания конструкций", label: "Натурные испытания конструкций" },
  { value: "Контроль качества бетона", label: "Контроль качества бетона" },
  { value: "Авторский надзор", label: "Авторский надзор" },
  { value: "Геодезические изыскания", label: "Геодезические изыскания" },
  { value: "Дефектоскопия конструкций", label: "Дефектоскопия конструкций" },
  { value: "Испытания материалов", label: "Испытания материалов" },
  { value: "Лазерное 3D сканирование", label: "Лазерное 3D сканирование" },
  { value: "Обследование инженерных систем и сетей здания", label: "Обследование инженерных систем и сетей здания" },
  { value: "Проекты усиления конструкций и грунтов", label: "Проекты усиления конструкций и грунтов" },
  { value: "Расчеты конструкций", label: "Расчеты конструкций" },
]

type NewLeadDialogProps = {
  open: boolean
  onClose: () => void
  onCreated: (lead: Lead, contact: SavedContact | null) => void
}

type Errors = { company?: string; objectName?: string; service?: string; owner?: string }

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : "Не удалось создать лид")

export function NewLeadDialog({ open, onClose, onCreated }: NewLeadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="glass-dialog glass-dialog-wide" aria-describedby="lead-action-description">
        {open && <NewLeadForm onClose={onClose} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  )
}

function NewLeadForm({ onClose, onCreated }: Omit<NewLeadDialogProps, "open">) {
  const [form, setForm] = useState({
    direction: "А2-СП",
    owner: "",
    company: "",
    objectName: "",
    city: "",
    street: "",
    building: "",
    additional: "",
    service: "",
    otherService: "",
    value: "",
    quoteStatus: quoteStatuses[0],
    phone: "",
    contactName: "",
    contactRole: "",
    contactPhone: "",
    contactEmail: "",
  })
  const [includeOtherRequest, setIncludeOtherRequest] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors({})
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Errors = {}
    if (!form.company.trim()) next.company = "Укажите заказчика"
    if (!form.objectName.trim()) next.objectName = "Укажите наименование объекта"
    if (!form.service && !includeOtherRequest) next.service = "Выберите услугу или отметьте другой запрос"
    if (!form.owner) next.owner = "Выберите ответственного"
    if (Object.keys(next).length > 0) return setErrors(next)

    const customRequest = includeOtherRequest ? form.otherService.trim() || "Другой запрос" : ""
    const request = [form.service, customRequest].filter(Boolean).join("; ")
    setPending(true)
    try {
      const { lead, contact } = await createLead({
        direction: form.direction,
        company: form.company,
        objectName: form.objectName,
        request,
        address: { city: form.city, street: form.street, building: form.building, additional: form.additional },
        value: form.value,
        quoteStatus: form.quoteStatus,
        owner: form.owner,
        phone: form.phone,
        contactName: form.contactName,
        contactRole: form.contactRole,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
      })
      onCreated(lead, contact)
      toast.success(`Лид ${lead.id} создан`)
      onClose()
    } catch (reason) {
      toast.error(messageOf(reason))
      setPending(false)
    }
  }

  return (
    <FormShell title="Новый лид" description="Заполните данные, которые отображаются на карточке лида." onSubmit={submit} pending={pending} submitLabel="Создать лид" onClose={onClose}>
      <div className="glass-row">
        <Field label="Направление" required>
          <Select value={form.direction} onValueChange={(value) => update("direction", value)}>
            <SelectTrigger className="w-full" aria-label="Направление">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {directions.map((direction) => (
                <SelectItem key={direction} value={direction}>
                  {direction}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ответственный" error={errors.owner} required>
          <Select value={form.owner} onValueChange={(value) => update("owner", value)}>
            <SelectTrigger className="w-full" aria-label="Ответственный" aria-invalid={Boolean(errors.owner)}>
              <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee} value={employee}>
                  {employee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Заказчик" error={errors.company} required>
        <Input autoFocus value={form.company} maxLength={200} placeholder="ООО «Название»" aria-invalid={Boolean(errors.company)} onChange={(event) => update("company", event.target.value)} />
      </Field>

      <Field label="Телефон компании">
        <Input type="tel" value={form.phone} maxLength={40} placeholder="+7" onChange={(event) => update("phone", event.target.value)} />
      </Field>

      <div className="glass-row">
        <Field label="Контактное лицо">
          <Input value={form.contactName} maxLength={240} placeholder="Имя Фамилия" onChange={(event) => update("contactName", event.target.value)} />
        </Field>
        <Field label="Должность">
          <Input value={form.contactRole} maxLength={160} onChange={(event) => update("contactRole", event.target.value)} />
        </Field>
      </div>

      <div className="glass-row">
        <Field label="Телефон контактного лица">
          <Input type="tel" value={form.contactPhone} maxLength={40} placeholder="+7" onChange={(event) => update("contactPhone", event.target.value)} />
        </Field>
        <Field label="Электронная почта">
          <Input type="email" value={form.contactEmail} maxLength={200} placeholder="name@example.com" onChange={(event) => update("contactEmail", event.target.value)} />
        </Field>
      </div>

      <Field label="Услуга" error={errors.service} required={!includeOtherRequest}>
        <Select value={form.service} onValueChange={(value) => update("service", value)}>
          <SelectTrigger className="w-full" aria-label="Услуга" aria-invalid={Boolean(errors.service)}>
            <SelectValue placeholder="Выберите услугу" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {serviceChoices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <label className="glass-check">
          <Checkbox checked={includeOtherRequest} onCheckedChange={(checked) => { setIncludeOtherRequest(checked === true); setErrors({}) }} />
          Другой запрос
        </label>
        {includeOtherRequest && (
          <Input autoFocus value={form.otherService} maxLength={200} placeholder="Название услуги или запроса" aria-label="Название другого запроса" onChange={(event) => update("otherService", event.target.value)} />
        )}
      </Field>

      <div className="glass-row">
        <Field label="Сумма">
          <div className="glass-amount">
            <Input inputMode="numeric" value={form.value} maxLength={20} placeholder="0" onChange={(event) => update("value", event.target.value.replace(/[^\d\s]/g, ""))} />
          </div>
        </Field>
        <Field label="Статус КП">
          <Select value={form.quoteStatus} onValueChange={(value) => update("quoteStatus", value)}>
            <SelectTrigger className="w-full" aria-label="Статус КП">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quoteStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Наименование объекта" error={errors.objectName} required>
        <Input value={form.objectName} maxLength={200} placeholder="ЖК «Название»" aria-invalid={Boolean(errors.objectName)} onChange={(event) => update("objectName", event.target.value)} />
      </Field>

      <div className="glass-row">
        <Field label="Город">
          <Input value={form.city} maxLength={120} onChange={(event) => update("city", event.target.value)} />
        </Field>
        <Field label="Улица">
          <Input value={form.street} maxLength={200} onChange={(event) => update("street", event.target.value)} />
        </Field>
      </div>
      <div className="glass-row">
        <Field label="Дом, корпус">
          <Input value={form.building} maxLength={80} onChange={(event) => update("building", event.target.value)} />
        </Field>
        <Field label="Дополнительно">
          <Input value={form.additional} maxLength={200} onChange={(event) => update("additional", event.target.value)} />
        </Field>
      </div>

    </FormShell>
  )
}
