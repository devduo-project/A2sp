"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Building2, Copy, Mail, MapPin, Phone, Plus, Users, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { tokarev } from "@/lib/employees"
import { LeadQuickActions, type QuickActionType } from "@/components/lead-quick-actions"
import type { SavedContact } from "@/app/actions/lead-records"
import { updateLeadFields } from "@/app/actions/leads"
import { defaultLeadCardConfig, type LeadCardConfig, type LeadCardElementId } from "@/lib/lead-card-config"

const SAVED_CONTACT_ID_OFFSET = 1_000_000_000

export type LeadDirection = "А2-СП" | "ИП" | "МГСУ"

const directionTone: Record<LeadDirection, string> = { "А2-СП": "a2sp", "ИП": "ip", "МГСУ": "mgsu" }

export type Lead = {
  id: string
  company: string
  contact: string
  role: string
  phone: string
  companyPhones?: string[]
  createdAt?: string | Date
  city: string
  objectName?: string
  direction?: LeadDirection
  address?: { city?: string; street?: string; building?: string; additional?: string }
  request: string
  source: string
  owner: string
  value: string
  quoteStatus?: string
  next: string
  days: number
  stage: string
}

type ContactRecord = { id: number; name: string; role: string; phone: string; email: string; primary?: boolean; manager?: string }
type LeadCardProps = {
  lead: Lead
  onClick: () => void
  onQuickAction?: (type: QuickActionType, lead: Lead) => void
  savedContacts?: SavedContact[]
  isDragging?: boolean
  dragProps?: Pick<React.HTMLAttributes<HTMLDivElement>, "draggable" | "onDragStart" | "onDragEnd">
  cardConfig?: LeadCardConfig
}

const initialContacts: ContactRecord[] = [
  { id: 1, name: "Анна Мельникова", role: "Директор по развитию", phone: "+7 921 555-19-40", email: "anna@severny-kvartal.ru", primary: true, manager: tokarev },
  { id: 2, name: "Павел Соколов", role: "Главный инженер", phone: "+7 921 555-20-11", email: "pavel@severny-kvartal.ru", manager: tokarev },
]

function copyValue(value: string, label: string) { navigator.clipboard?.writeText(value); toast.success(label) }

function formatRubles(value: string) {
  const amount = value.replace("₽", "").trim()
  return amount ? `${amount}\u00a0₽` : value
}

function ContactForm({ contact, onSave, onCancel }: { contact?: ContactRecord; onSave: (contact: ContactRecord) => void; onCancel: () => void }) {
  const [form, setForm] = useState(contact ?? { id: Date.now(), name: "", role: "", phone: "", email: "", primary: false, manager: "" })
  const update = (key: keyof ContactRecord, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="contact-form"><label>ФИО сотрудника<Input value={form.name} onChange={(e) => update("name", e.target.value)} autoFocus /></label><label>Должность<Input value={form.role} onChange={(e) => update("role", e.target.value)} /></label><label>Телефон<Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></label><label>Email<Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></label><label className="contact-checkbox"><input type="checkbox" checked={Boolean(form.primary)} onChange={(e) => update("primary", e.target.checked)} /> Основной контакт</label><div className="modal-actions"><Button variant="outline" onClick={onCancel}>Отмена</Button><Button disabled={!form.name.trim()} onClick={() => onSave(form)}>Сохранить</Button></div></div>
}

function ContactsModal({ contacts, onClose, onSave }: { contacts: ContactRecord[]; onClose: () => void; onSave: (contact: ContactRecord) => void }) {
  const [editing, setEditing] = useState<ContactRecord | undefined>()
  const [adding, setAdding] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", onKey); dialogRef.current?.focus(); const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow } }, [onClose])
  const save = (contact: ContactRecord) => { onSave(contact); setAdding(false); setEditing(undefined); toast.success("Контакт сохранён") }
  return typeof document === "undefined" ? null : createPortal(<div className="contacts-overlay" role="presentation" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="contacts-modal" onClick={(event) => event.stopPropagation()} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="contacts-title" onMouseDown={(event) => event.stopPropagation()}><header className="contacts-modal-header"><div><p className="section-label">Компания</p><h2 id="contacts-title">Контакты компании</h2></div><button className="modal-close" aria-label="Закрыть контакты" title="Закрыть" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClose() }}><X /></button></header>{adding || editing ? <><ContactForm contact={editing} onSave={save} onCancel={() => { setAdding(false); setEditing(undefined) }} /></> : <><div className="contacts-modal-toolbar"><span>{contacts.length ? `Контакты · ${contacts.length}` : "Контакты не добавлены"}</span><Button size="sm" onClick={() => setAdding(true)}><Plus data-icon="inline-start" /> Добавить контакт</Button></div><div className="contact-list">{contacts.length ? contacts.map((contact) => <article className="contact-list-item" key={contact.id}><div className="contact-list-main"><div className="contact-avatar">{contact.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><h3>{contact.name} {contact.primary && <Badge variant="secondary">Основной контакт</Badge>}</h3><p>{contact.role}{contact.manager ? ` · Ответственный: ${contact.manager}` : ""}</p><div className="contact-detail-row">{contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`}><Phone />{contact.phone}</a>}{contact.email && <a href={`mailto:${contact.email}`}><Mail />{contact.email}</a>}</div></div></div><div className="contact-item-actions"><Button size="icon" variant="ghost" title="Позвонить" aria-label="Позвонить" disabled={!contact.phone} asChild><a href={`tel:${contact.phone.replace(/\s/g, "")}`}><Phone /></a></Button><Button size="icon" variant="ghost" title="Написать" aria-label="Написать" disabled={!contact.email} asChild><a href={`mailto:${contact.email}`}><Mail /></a></Button><Button size="icon" variant="ghost" title="Скопировать телефон" aria-label="Скопировать телефон" disabled={!contact.phone} onClick={() => copyValue(contact.phone, "Телефон скопирован")}><Copy /></Button><Button size="icon" variant="ghost" title="Скопировать Email" aria-label="Скопировать Email" disabled={!contact.email} onClick={() => copyValue(contact.email, "Email скопирован")}><Copy /></Button><Button size="sm" variant="outline" onClick={() => setEditing(contact)}>Изменить</Button></div></article>) : <div className="contacts-empty"><Users /><p>Конта��ты не добавлены</p><Button onClick={() => setAdding(true)}><Plus data-icon="inline-start" /> Добавить контакт</Button></div>}</div></>}</section></div>, document.body)
}

function AddressModal({ address, onClose }: { address?: Lead["address"]; onClose: () => void }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", onKey); const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow } }, [onClose])
  return typeof document === "undefined" ? null : createPortal(<div className="contacts-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="contacts-modal address-modal" role="dialog" aria-modal="true" aria-labelledby="address-title" onMouseDown={(event) => event.stopPropagation()}><header className="contacts-modal-header"><div><p className="section-label">Локация</p><h2 id="address-title">Адрес компании</h2></div><button className="modal-close" aria-label="Закрыть адрес" title="Закрыть" onClick={onClose}><X /></button></header><div className="address-modal-content">{address && Object.values(address).some(Boolean) ? <><MapPin /><dl className="address-details">{address.city && <div><dt>Город</dt><dd>{address.city}</dd></div>}{address.street && <div><dt>Улица</dt><dd>{address.street}</dd></div>}{address.building && <div><dt>Дом / корпус</dt><dd>{address.building}</dd></div>}{address.additional && <div><dt>Дополнительно</dt><dd>{address.additional}</dd></div>}</dl></> : <p>Адресные данные не указаны</p>}</div></section></div>, document.body)
}

function CompanyPhonesMenu({ phones, onClose, onSave }: { phones: string[]; onClose: () => void; onSave: (phones: string[]) => Promise<void> }) {
  const [draft, setDraft] = useState(phones)
  const [editing, setEditing] = useState<number | null>(null)
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)
  const startEdit = (index: number) => { setEditing(index); setValue(draft[index]) }
  const saveValue = () => { const phone = value.trim(); if (!phone) return; setDraft((current) => current.map((item, index) => index === editing ? phone : item)); setEditing(null); setValue("") }
  const addPhone = () => { const phone = value.trim(); if (!phone) return; setDraft((current) => [...current, phone]); setValue("") }
  const save = async () => { if (!draft.length) return; setPending(true); try { await onSave(draft); onClose() } catch { } finally { setPending(false) } }
  return typeof document === "undefined" ? null : createPortal(<div className="phone-overlay" role="presentation" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="phone-menu phone-menu-editor" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="phone-menu-title" onMouseDown={(event) => event.stopPropagation()}><div className="phone-menu-title"><h2 id="phone-menu-title">Телефоны компании</h2><button onClick={onClose} aria-label="Закрыть телефоны" title="Закрыть"><X /></button></div><div className="phone-list">{draft.map((phone, index) => <div className="phone-row" key={`${phone}-${index}`}>{editing === index ? <div className="phone-edit-row"><Input autoFocus type="tel" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveValue()} /><Button type="button" size="sm" onClick={saveValue}>Готово</Button></div> : <><a className="phone-number" href={`tel:${phone.replace(/\s/g, "")}`}><Phone />{phone}</a><div className="phone-row-actions"><Button type="button" size="sm" variant="ghost" onClick={() => startEdit(index)}>Изменить</Button><Button type="button" size="sm" variant="ghost" onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Удалить</Button></div></>}</div>)}</div><div className="phone-add-row"><Input type="tel" placeholder="Д��бавить телефон" value={editing === null ? value : ""} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addPhone()} /><Button type="button" variant="outline" onClick={addPhone}><Plus data-icon="inline-start" /> Добавить</Button></div><div className="modal-actions"><Button variant="outline" onClick={onClose}>Отмена</Button><Button type="button" disabled={pending || !draft.length} onClick={save}>{pending ? "Сохраняем…" : "Сохранить"}</Button></div></section></div>, document.body)
}

export function LeadCard({ lead, onClick, onQuickAction, savedContacts = [], isDragging, dragProps, cardConfig }: LeadCardProps) {
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [companyPhones, setCompanyPhones] = useState<string[]>(() => (lead.companyPhones?.length ? lead.companyPhones : lead.phone ? [lead.phone] : []))
  const [addressOpen, setAddressOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [localContacts, setContacts] = useState<ContactRecord[]>(initialContacts)
  const localIds = new Set(localContacts.map((contact) => contact.id))
  const storedContacts: ContactRecord[] = savedContacts
    .map((contact) => ({ id: SAVED_CONTACT_ID_OFFSET + contact.id, name: contact.name, role: contact.role, phone: contact.phone, email: contact.email }))
    .filter((contact) => !localIds.has(contact.id))
  const contacts = [...localContacts, ...storedContacts]
  const [quoteStatus, setQuoteStatus] = useState(lead.quoteStatus ?? "КП озвучено")
  const cardRef = useRef<HTMLDivElement>(null)
  const saveCompanyPhones = async (phones: string[]) => {
    try {
      const updated = await updateLeadFields(lead.id, { companyPhones: phones })
      setCompanyPhones(updated.companyPhones?.length ? updated.companyPhones : phones)
      toast.success("Телефоны компании сохранены")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить телефоны")
      throw error
    }
  }
  const saveContact = (contact: ContactRecord) => setContacts((current) => { const normalized = contact.primary ? current.map((item) => ({ ...item, primary: false })) : current; const exists = normalized.some((item) => item.id === contact.id); return exists ? normalized.map((item) => item.id === contact.id ? contact : item) : [...normalized, contact] })
  const activeConfig = cardConfig ?? defaultLeadCardConfig
  const hidden = new Set(activeConfig.hidden)
  const content: Record<LeadCardElementId, React.ReactNode> = {
    direction: <div className="lead-card-direction"><span className="direction-chip" data-direction={directionTone[lead.direction ?? "А2-СП"]}>{lead.direction ?? "А2-СП"}</span></div>,
    company: <h3>{lead.company}</h3>,
    duration: <span className={cn("lead-stage-duration", lead.days >= 14 && "is-long")}>{lead.days} дн в стадии</span>,
    service: <p className="lead-service"><Building2 />{lead.request}</p>,
    object: <div className="lead-object-line"><button className="lead-address-icon" type="button" title="Показать адрес" aria-label={`Показать адрес: ${lead.address?.city || "Адрес не указан"}`} onClick={(event) => { event.stopPropagation(); setAddressOpen(true) }}><MapPin /></button><span className="lead-object-name">{lead.objectName || "Название объекта не указано"}</span></div>,
    financials: <div className="lead-financials" onClick={(event) => event.stopPropagation()}><strong>{formatRubles(lead.value)}</strong><Select value={quoteStatus} onValueChange={setQuoteStatus}><SelectTrigger aria-label="Статус КП"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="КП озвучено">КП озвучено</SelectItem><SelectItem value="КП отправлено">КП отправлено</SelectItem></SelectContent></Select></div>,
    owner: <div className="lead-owner"><span className="lead-owner-label">Ответственный</span><span className="lead-owner-name" title={lead.owner}>{lead.owner}</span></div>,
  }
  const visibleOrder = activeConfig.order.filter((id) => !hidden.has(id))
  const primaryTextOrder = visibleOrder.filter((id) => id === "company" || id === "object")
  const renderContent = (id: LeadCardElementId) => {
    const contentNode = content[id]
    if (id === "company" || id === "object") {
      const textClass = primaryTextOrder[0] === id ? "is-primary" : "is-secondary"
      return <div key={id} className={cn("lead-card-text-item", textClass)}>{contentNode}</div>
    }
    return <div key={id} className="lead-card-info-item">{contentNode}</div>
  }
  return <div className={cn("lead-card", isDragging && "is-dragging")} data-lead-id={lead.id} {...dragProps} ref={cardRef} role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick() } }}><div className="lead-card-header"><div className="lead-card-title" /><div className="lead-card-header-actions" onClick={(event) => event.stopPropagation()}><Button size="icon" variant="ghost" title="Телефоны компании" aria-label="Телефоны компании" onClick={() => setPhoneOpen((open) => !open)}><Phone /></Button><Button size="icon" variant="ghost" title={`Контакты �� ${contacts.length}`} aria-label={`Открыть контакты, ${contacts.length}`} onClick={() => { setPhoneOpen(false); setContactsOpen(true) }}><Users /></Button></div></div><div className="lead-card-info">{visibleOrder.map(renderContent)}</div><div className="lead-owner-row"><div className="lead-owner-actions-spacer" /><LeadQuickActions leadId={lead.id} onAction={(type) => onQuickAction?.(type, lead)} /></div>{phoneOpen && <CompanyPhonesMenu phones={companyPhones} onClose={() => setPhoneOpen(false)} onSave={saveCompanyPhones} />}{addressOpen && <AddressModal address={lead.address} onClose={() => setAddressOpen(false)} />}{contactsOpen && <ContactsModal contacts={contacts} onClose={() => setContactsOpen(false)} onSave={saveContact} />}</div>
}
