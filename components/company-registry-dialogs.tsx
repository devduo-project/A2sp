"use client"

import { useState, type FormEvent } from "react"
import { Building2, Mail, Phone, Plus, Trash2, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { CompanyViewModel, RegistryContact, RegistryRecord } from "@/lib/company-registry-data"
import { createLeadContact, updateLeadContact, type SavedContact } from "@/app/actions/lead-records"
import type { ContactMethod } from "@/lib/db/schema"

function ContactEditor({
  contact,
  onCancel,
  onSave,
}: {
  contact?: RegistryContact
  onCancel: () => void
  onSave: (contact: RegistryContact) => Promise<void>
}) {
  const [name, setName] = useState(contact?.name ?? "")
  const [role, setRole] = useState(contact?.role ?? "")
  const [phone, setPhone] = useState(contact?.phones[0] ?? "")
  const [email, setEmail] = useState(contact?.emails[0] ?? "")
  const [telegram, setTelegram] = useState(contact?.telegram ?? "")
  const [methods, setMethods] = useState<ContactMethod[]>(() => [
    ...(contact?.contactMethods ?? []),
    ...(contact?.phones.slice(1) ?? []).map((value) => ({ id: crypto.randomUUID(), kind: "phone" as const, value })),
    ...(contact?.emails.slice(1) ?? []).map((value) => ({ id: crypto.randomUUID(), kind: "email" as const, value })),
  ])
  const [comment, setComment] = useState(contact?.comment ?? "")
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false)
  const [errors, setErrors] = useState<string[]>([])
  const [addingType, setAddingType] = useState(false)
  const [pending, setPending] = useState(false)

  const addMethod = (kind: ContactMethod["kind"]) => {
    setMethods((current) => [...current, { id: crypto.randomUUID(), kind, provider: kind === "messenger" ? "Telegram" : undefined, value: "" }])
    setAddingType(false)
  }
  const updateMethod = (id: string, patch: Partial<ContactMethod>) => setMethods((current) => current.map((method) => method.id === id ? { ...method, ...patch } : method))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanMethods = methods.filter((method) => method.value.trim())
    const cleanEmails = [email, ...cleanMethods.filter((method) => method.kind === "email").map((method) => method.value)].map((value) => value.trim()).filter(Boolean)
    const validation: string[] = []
    if (!name.trim()) validation.push("Укажите ФИО контакта")
    if (cleanEmails.some((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) validation.push("Проверьте формат email")
    setErrors(validation)
    if (validation.length) return

    setPending(true)
    try {
      await onSave({
        ...contact,
        id: contact?.id ?? `local-contact-${crypto.randomUUID()}`,
        name: name.trim(),
        role: role.trim(),
        phones: [phone.trim(), ...cleanMethods.filter((method) => method.kind === "phone").map((method) => method.value.trim())].filter(Boolean),
        emails: [email.trim(), ...cleanMethods.filter((method) => method.kind === "email").map((method) => method.value.trim())].filter(Boolean),
        telegram: telegram.trim(),
        contactMethods: cleanMethods,
        comment: comment.trim() || undefined,
        isPrimary,
      })
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Не удалось сохранить контакт"])
    } finally {
      setPending(false)
    }
  }

  const methodTitle = (method: ContactMethod) => method.kind === "messenger" ? `Мессенджер · ${method.provider || "Мессенджер"}` : method.kind === "phone" ? "Дополнительный телефон" : "Дополнительный email"

  return (
    <form className="registry-contact-form" onSubmit={submit} noValidate>
      <FieldGroup className="registry-form-grid">
        <Field><FieldLabel htmlFor="registry-contact-name">ФИО</FieldLabel><Input id="registry-contact-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus aria-invalid={errors.includes("Укажите ФИО контакта")} /></Field>
        <Field><FieldLabel htmlFor="registry-contact-role">Должность</FieldLabel><Input id="registry-contact-role" value={role} onChange={(event) => setRole(event.target.value)} /></Field>
        <Field><FieldLabel htmlFor="registry-contact-phone">Телефон</FieldLabel><Input id="registry-contact-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Field><FieldLabel htmlFor="registry-contact-email">Email</FieldLabel><Input id="registry-contact-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field className="registry-form-wide"><FieldLabel htmlFor="registry-contact-telegram">Telegram</FieldLabel><Input id="registry-contact-telegram" value={telegram} onChange={(event) => setTelegram(event.target.value)} placeholder="@username или https://t.me/username" /></Field>
        <Field className="registry-form-wide"><div className="registry-contact-methods-heading"><FieldLabel>Дополнительные способы связи</FieldLabel><div className="contact-method-add-wrap"><Button type="button" size="icon" variant="outline" aria-label="Добавить способ связи" aria-expanded={addingType} onClick={() => setAddingType((current) => !current)}><Plus /></Button>{addingType && <div className="contact-method-menu" role="group" aria-label="Тип дополнительного контакта"><button type="button" onClick={() => addMethod("messenger")}>Мессенджер</button><button type="button" onClick={() => addMethod("phone")}>Телефон</button><button type="button" onClick={() => addMethod("email")}>Email</button></div>}</div></div>
          {methods.map((method) => <div className="registry-extra-contact" key={method.id}><div className="registry-extra-contact-fields"><span>{methodTitle(method)}</span>{method.kind === "messenger" && <label>Мессенджер<Input value={method.provider ?? ""} onChange={(event) => updateMethod(method.id, { provider: event.target.value })} placeholder="Telegram, WhatsApp, MAX" /></label>}<Input aria-label={methodTitle(method)} type={method.kind === "email" ? "email" : method.kind === "phone" ? "tel" : "text"} value={method.value} onChange={(event) => updateMethod(method.id, { value: event.target.value })} placeholder={method.kind === "phone" ? "+7 ..." : method.kind === "email" ? "name@example.com" : "@username или ссылка"} /></div><Button type="button" size="icon" variant="ghost" aria-label={`Удалить ${methodTitle(method)}`} onClick={() => setMethods((current) => current.filter((item) => item.id !== method.id))}><Trash2 /></Button></div>)}
        </Field>
        <Field className="registry-form-wide"><FieldLabel htmlFor="registry-contact-comment">Комментарий</FieldLabel><Textarea id="registry-contact-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} /></Field>
        <Field orientation="horizontal" className="registry-form-wide registry-primary-field"><input id="registry-contact-primary" type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} /><FieldLabel htmlFor="registry-contact-primary">Основной контакт</FieldLabel></Field>
      </FieldGroup>
      {errors.length > 0 && <p className="registry-form-error" role="alert">{errors[0]}</p>}
      <DialogFooter className="registry-dialog-footer"><Button type="button" variant="outline" onClick={onCancel}>Отмена</Button><Button type="submit" disabled={pending}>{pending ? "Сохранение…" : contact ? "Сохранить" : "Добавить контакт"}</Button></DialogFooter>
    </form>
  )
}

export function CompanyContactsDialog({
  company,
  open,
  onOpenChange,
  onContactsChange,
  onSavedContact,
}: {
  company: CompanyViewModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactsChange: (contacts: RegistryContact[]) => void
  onSavedContact?: (contact: SavedContact) => void
}) {
  const [editing, setEditing] = useState<RegistryContact | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  if (!company) return null

  const saveContact = async (contact: RegistryContact) => {
    if (company.isDemo) {
      const next = company.contacts.filter((item) => item.id !== contact.id).map((item) => contact.isPrimary ? { ...item, isPrimary: false } : item)
      onContactsChange([...next, contact])
      setEditorOpen(false)
      setEditing(null)
      toast.success("Демо-контакт обновлён только в интерфейсе")
      return
    }
    const leadId = contact.leadId ?? company.leads.find((lead) => lead.originalLeadId)?.originalLeadId
    if (!leadId) throw new Error("Для сохранения контакта компании нужна связанная запись лида")
    const [firstName, ...lastNameParts] = contact.name.trim().split(/\s+/)
    const input = {
      leadId,
      firstName,
      lastName: lastNameParts.join(" "),
      role: contact.role,
      phone: contact.phones[0] ?? "",
      email: contact.emails[0] ?? "",
      telegram: contact.telegram ?? "",
      contactMethods: contact.contactMethods ?? [],
      comment: contact.comment ?? "",
    }
    const saved = contact.savedContactId
      ? await updateLeadContact(contact.savedContactId, input)
      : await createLeadContact(input)
    onSavedContact?.(saved)
    const persisted: RegistryContact = {
      ...contact,
      id: `saved-contact-${saved.id}`,
      leadId: saved.leadId,
      savedContactId: saved.id,
      name: saved.name,
      role: saved.role,
      phones: [saved.phone, ...saved.contactMethods.filter((method) => method.kind === "phone").map((method) => method.value)].filter(Boolean),
      emails: [saved.email, ...saved.contactMethods.filter((method) => method.kind === "email").map((method) => method.value)].filter(Boolean),
      telegram: saved.telegram,
      contactMethods: saved.contactMethods,
      comment: saved.comment || undefined,
    }
    const next = company.contacts.filter((item) => item.id !== contact.id).map((item) => contact.isPrimary ? { ...item, isPrimary: false } : item)
    onContactsChange([...next, persisted])
    setEditorOpen(false)
    setEditing(null)
    toast.success("Контакт сохранён")
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
                      {contact.telegram && <a href={contact.telegram.startsWith("http") ? contact.telegram : `https://t.me/${contact.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Telegram: {contact.telegram}</a>}
                      {(contact.contactMethods ?? []).filter((method) => method.id !== "__telegram__").map((method) => <span key={method.id}>{method.kind === "messenger" ? `${method.provider || "Мессенджер"}: ` : method.kind === "phone" ? "Телефон: " : "Email: "}{method.value}</span>)}
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
          <div><span>Telegram</span><strong>{contact.telegram || "—"}</strong></div>
          {(contact.contactMethods ?? []).filter((method) => method.id !== "__telegram__").map((method) => <div key={method.id}><span>{method.kind === "messenger" ? method.provider || "Мессенджер" : method.kind === "phone" ? "Дополнительный телефон" : "Дополнительный email"}</span><strong>{method.value}</strong></div>)}
          <div><span>Комментарий</span><strong>{contact.comment || "—"}</strong></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
