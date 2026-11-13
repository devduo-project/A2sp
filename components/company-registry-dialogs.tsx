"use client"

import { useState, type FormEvent } from "react"
import { Building2, Mail, Phone, Plus, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { CompanyViewModel, RegistryContact, RegistryRecord } from "@/lib/company-registry-data"

function ContactEditor({
  contact,
  onCancel,
  onSave,
}: {
  contact?: RegistryContact
  onCancel: () => void
  onSave: (contact: RegistryContact) => void
}) {
  const [name, setName] = useState(contact?.name ?? "")
  const [role, setRole] = useState(contact?.role ?? "")
  const [phones, setPhones] = useState(contact?.phones.join("\n") ?? "")
  const [emails, setEmails] = useState(contact?.emails.join("\n") ?? "")
  const [comment, setComment] = useState(contact?.comment ?? "")
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false)
  const [errors, setErrors] = useState<string[]>([])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanPhones = phones.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
    const cleanEmails = emails.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
    const validation: string[] = []
    if (!name.trim()) validation.push("Укажите ФИО контакта")
    if (!cleanPhones.length && !cleanEmails.length) validation.push("Добавьте телефон или email")
    if (cleanEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) validation.push("Проверьте формат email")
    setErrors(validation)
    if (validation.length) return

    onSave({
      id: contact?.id ?? `local-contact-${crypto.randomUUID()}`,
      name: name.trim(),
      role: role.trim(),
      phones: cleanPhones,
      emails: cleanEmails,
      comment: comment.trim() || undefined,
      isPrimary,
      createdAt: contact?.createdAt,
      createdBy: contact?.createdBy,
    })
  }

  return (
    <form className="registry-contact-form" onSubmit={submit} noValidate>
      <FieldGroup className="registry-form-grid">
        <Field>
          <FieldLabel htmlFor="registry-contact-name">ФИО</FieldLabel>
          <Input id="registry-contact-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus aria-invalid={errors.includes("Укажите ФИО контакта")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="registry-contact-role">Должность</FieldLabel>
          <Input id="registry-contact-role" value={role} onChange={(event) => setRole(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="registry-contact-phones">Телефоны</FieldLabel>
          <Textarea id="registry-contact-phones" value={phones} onChange={(event) => setPhones(event.target.value)} placeholder="По одному номеру на строку" rows={2} />
        </Field>
        <Field>
          <FieldLabel htmlFor="registry-contact-emails">Email</FieldLabel>
          <Textarea id="registry-contact-emails" value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="По одному адресу на строку" rows={2} />
        </Field>
        <Field className="registry-form-wide">
          <FieldLabel htmlFor="registry-contact-comment">Комментарий</FieldLabel>
          <Textarea id="registry-contact-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
        </Field>
        <Field orientation="horizontal" className="registry-form-wide registry-primary-field">
          <input id="registry-contact-primary" type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
          <FieldLabel htmlFor="registry-contact-primary">Основной контакт</FieldLabel>
        </Field>
      </FieldGroup>
      {errors.length > 0 && <p className="registry-form-error" role="alert">{errors[0]}</p>}
      <DialogFooter className="registry-dialog-footer">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit">{contact ? "Сохранить" : "Добавить контакт"}</Button>
      </DialogFooter>
      <p className="registry-demo-note">Изменения действуют только в текущем интерфейсе и исчезнут после перезагрузки.</p>
    </form>
  )
}

export function CompanyContactsDialog({
  company,
  open,
  onOpenChange,
  onContactsChange,
}: {
  company: CompanyViewModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactsChange: (contacts: RegistryContact[]) => void
}) {
  const [editing, setEditing] = useState<RegistryContact | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  if (!company) return null

  const saveContact = (contact: RegistryContact) => {
    const next = company.contacts
      .filter((item) => item.id !== contact.id)
      .map((item) => contact.isPrimary ? { ...item, isPrimary: false } : item)
    const updated = [...next, contact]
    onContactsChange(updated)
    setEditorOpen(false)
    setEditing(null)
    toast.success("Контакт обновлён в интерфейсе", { description: "Изменения не сохранены в базе данных." })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setEditorOpen(false); setEditing(null) } }}>
      <DialogContent className="registry-dialog">
        <DialogHeader>
          <p className="section-label">{company.legalName}</p>
          <DialogTitle>Контакты компании</DialogTitle>
          <DialogDescription>Контактные данные и основные лица компании.</DialogDescription>
        </DialogHeader>
        {editorOpen ? (
          <ContactEditor key={editing?.id ?? "new"} contact={editing ?? undefined} onCancel={() => { setEditorOpen(false); setEditing(null) }} onSave={saveContact} />
        ) : (
          <>
            <div className="registry-dialog-toolbar">
              <span>{company.contacts.length ? `Контакты · ${company.contacts.length}` : "Контакты не добавлены"}</span>
              <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true) }}><Plus data-icon="inline-start" /> Добавить контакт</Button>
            </div>
            <div className="registry-contact-list">
              {company.contacts.length ? company.contacts.map((contact) => (
                <article key={contact.id} className="registry-contact-card">
                  <div className="registry-contact-avatar"><UserRound /></div>
                  <div className="registry-contact-copy">
                    <div className="registry-contact-name">{contact.name}{contact.isPrimary && <Badge variant="secondary">Основной</Badge>}</div>
                    <p>{contact.role || "Должность не указана"}</p>
                    <div className="registry-contact-methods">
                      {contact.phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Phone />{phone}</a>)}
                      {contact.emails.map((email) => <a key={email} href={`mailto:${email}`}><Mail />{email}</a>)}
                    </div>
                    {contact.comment && <p className="registry-contact-comment">{contact.comment}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(contact); setEditorOpen(true) }}>Изменить</Button>
                </article>
              )) : <div className="registry-empty">Пока нет контактов. Добавьте первый контакт компании.</div>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RecordList({
  records,
  type,
  onSelect,
}: {
  records: RegistryRecord[]
  type: "Лид" | "Сделка"
  onSelect: (record: RegistryRecord) => void
}) {
  if (!records.length) return <div className="registry-empty">Связанных записей нет.</div>
  return <div className="registry-record-list">{records.map((record) => (
    <button type="button" key={record.id} className="registry-record-card" onClick={() => onSelect(record)}>
      <span className="registry-record-type">{type}</span>
      <span className="registry-record-title">{record.name}</span>
      <Badge variant="secondary">{record.stage}</Badge>
      <span className="registry-record-date">{record.createdAt ? new Date(record.createdAt).toLocaleDateString("ru-RU") : "Дата не указана"}</span>
      <strong>{record.amount !== undefined ? `${new Intl.NumberFormat("ru-RU").format(record.amount)} ₽` : "—"}</strong>
    </button>
  ))}</div>
}

export function CompanyRecordsDialog({
  company,
  open,
  onOpenChange,
  onRecordSelect,
}: {
  company: CompanyViewModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecordSelect: (type: "Лид" | "Сделка", record: RegistryRecord) => boolean
}) {
  const [selectedRecord, setSelectedRecord] = useState<{ type: string; record: RegistryRecord } | null>(null)
  if (!company) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="registry-dialog">
          <DialogHeader>
            <p className="section-label">{company.legalName}</p>
            <DialogTitle>Лиды и сделки компании</DialogTitle>
            <DialogDescription>Все связанные записи и их актуальные стадии.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="leads">
            <TabsList>
              <TabsTrigger value="leads">Лиды ({company.leads.length})</TabsTrigger>
              <TabsTrigger value="deals">Сделки ({company.deals.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="leads"><RecordList records={company.leads} type="Лид" onSelect={(record) => { if (onRecordSelect("Лид", record)) onOpenChange(false); else setSelectedRecord({ type: "Лид", record }) }} /></TabsContent>
            <TabsContent value="deals"><RecordList records={company.deals} type="Сделка" onSelect={(record) => { if (onRecordSelect("Сделка", record)) onOpenChange(false); else setSelectedRecord({ type: "Сделка", record }) }} /></TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedRecord)} onOpenChange={(next) => { if (!next) setSelectedRecord(null) }}>
        <DialogContent className="registry-detail-dialog">
          <DialogHeader>
            <p className="section-label">{selectedRecord?.type}</p>
            <DialogTitle>{selectedRecord?.record.name || "Карточка записи"}</DialogTitle>
            <DialogDescription>Демонстрационная карточка открыта внутри текущего интерфейса.</DialogDescription>
          </DialogHeader>
          {selectedRecord && <div className="registry-detail-fields"><div><span>Стадия</span><Badge variant="secondary">{selectedRecord.record.stage}</Badge></div><div><span>Дата создания</span><strong>{selectedRecord.record.createdAt ? new Date(selectedRecord.record.createdAt).toLocaleDateString("ru-RU") : "—"}</strong></div><div><span>Стоимость</span><strong>{selectedRecord.record.amount !== undefined ? `${new Intl.NumberFormat("ru-RU").format(selectedRecord.record.amount)} ₽` : "—"}</strong></div></div>}
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CompanyDetailsDialog({
  company,
  open,
  onOpenChange,
}: {
  company: CompanyViewModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!company) return null
  const primary = company.contacts.find((contact) => contact.isPrimary)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="registry-detail-dialog">
        <DialogHeader>
          <p className="section-label">Карточка компании</p>
          <DialogTitle className="registry-company-detail-title"><Building2 />{company.legalName}</DialogTitle>
          <DialogDescription>{company.isDemo ? "Демонстрационная запись. Связи существуют только на фронтенде." : "Карточка из доступных данных CRM."}</DialogDescription>
        </DialogHeader>
        <div className="registry-detail-fields">
          <div><span>Основной контакт</span><strong>{primary?.name || "Основной контакт не указан"}</strong></div>
          <div><span>Лиды</span><strong>{company.leads.length}</strong></div>
          <div><span>Сделки</span><strong>{company.deals.length}</strong></div>
          <div><span>Создана</span><strong>{company.createdAt ? new Date(company.createdAt).toLocaleDateString("ru-RU") : "—"}</strong></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ContactDetailsDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: (RegistryContact & { companyName: string }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!contact) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="registry-detail-dialog">
        <DialogHeader>
          <p className="section-label">Контакт</p>
          <DialogTitle>{contact.name}</DialogTitle>
          <DialogDescription>{contact.companyName}</DialogDescription>
        </DialogHeader>
        <div className="registry-detail-fields">
          <div><span>Должность</span><strong>{contact.role || "—"}</strong></div>
          <div><span>Телефон</span><strong>{contact.phones.join(", ") || "—"}</strong></div>
          <div><span>Email</span><strong>{contact.emails.join(", ") || "—"}</strong></div>
          <div><span>Комментарий</span><strong>{contact.comment || "—"}</strong></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
