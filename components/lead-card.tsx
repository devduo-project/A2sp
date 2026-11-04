"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Copy, Mail, MapPin, Phone, Plus, Users, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type Lead = {
  id: string
  company: string
  contact: string
  role: string
  phone: string
  city: string
  objectName?: string
  address?: { city?: string; street?: string; building?: string; additional?: string }
  request: string
  source: string
  owner: string
  value: string
  next: string
  days: number
  stage: string
}

type ContactRecord = { id: number; name: string; role: string; phone: string; email: string; primary?: boolean; manager?: string }
type LeadCardProps = { lead: Lead; onClick: () => void }

const initialContacts: ContactRecord[] = [
  { id: 1, name: "Анна Мельникова", role: "Директор по развитию", phone: "+7 921 555-19-40", email: "anna@severny-kvartal.ru", primary: true, manager: "Алексей К." },
  { id: 2, name: "Павел Соколов", role: "Главный инженер", phone: "+7 921 555-20-11", email: "pavel@severny-kvartal.ru", manager: "Мария С." },
]

function copyValue(value: string, label: string) {
  navigator.clipboard?.writeText(value)
  toast.success(label)
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
  return typeof document === "undefined" ? null : createPortal(<div className="contacts-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="contacts-modal" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="contacts-title" onMouseDown={(event) => event.stopPropagation()}><header className="contacts-modal-header"><div><p className="section-label">Компания</p><h2 id="contacts-title">Контакты компании</h2></div><button className="modal-close" aria-label="Закрыть контакты" title="Закрыть" onClick={onClose}><X /></button></header>{adding || editing ? <><ContactForm contact={editing} onSave={save} onCancel={() => { setAdding(false); setEditing(undefined) }} /></> : <><div className="contacts-modal-toolbar"><span>{contacts.length ? `Контакты · ${contacts.length}` : "Контакты не добавлены"}</span><Button size="sm" onClick={() => setAdding(true)}><Plus data-icon="inline-start" /> Добавить контакт</Button></div><div className="contact-list">{contacts.length ? contacts.map((contact) => <article className="contact-list-item" key={contact.id}><div className="contact-list-main"><div className="contact-avatar">{contact.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><h3>{contact.name} {contact.primary && <Badge variant="secondary">Основной контакт</Badge>}</h3><p>{contact.role}{contact.manager ? ` · Ответственный: ${contact.manager}` : ""}</p><div className="contact-detail-row">{contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`}><Phone />{contact.phone}</a>}{contact.email && <a href={`mailto:${contact.email}`}><Mail />{contact.email}</a>}</div></div></div><div className="contact-item-actions"><Button size="icon" variant="ghost" title="Позвонить" aria-label="Позвонить" disabled={!contact.phone} asChild><a href={`tel:${contact.phone.replace(/\s/g, "")}`}><Phone /></a></Button><Button size="icon" variant="ghost" title="Написать" aria-label="Написать" disabled={!contact.email} asChild><a href={`mailto:${contact.email}`}><Mail /></a></Button><Button size="icon" variant="ghost" title="Скопировать телефон" aria-label="Скопировать телефон" disabled={!contact.phone} onClick={() => copyValue(contact.phone, "Телефон скопирован")}><Copy /></Button><Button size="icon" variant="ghost" title="Скопировать Email" aria-label="Скопировать Email" disabled={!contact.email} onClick={() => copyValue(contact.email, "Email скопирован")}><Copy /></Button><Button size="sm" variant="outline" onClick={() => setEditing(contact)}>Изменить</Button></div></article>) : <div className="contacts-empty"><Users /><p>Контакты не добавлены</p><Button onClick={() => setAdding(true)}><Plus data-icon="inline-start" /> Добавить контакт</Button></div>}</div></>}</section></div>, document.body)
}

function AddressModal({ address, onClose }: { address?: Lead["address"]; onClose: () => void }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", onKey); const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow } }, [onClose])
  return typeof document === "undefined" ? null : createPortal(<div className="contacts-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="contacts-modal address-modal" role="dialog" aria-modal="true" aria-labelledby="address-title" onMouseDown={(event) => event.stopPropagation()}><header className="contacts-modal-header"><div><p className="section-label">Локация</p><h2 id="address-title">Адрес компании</h2></div><button className="modal-close" aria-label="Закрыть адрес" title="Закрыть" onClick={onClose}><X /></button></header><div className="address-modal-content">{address && Object.values(address).some(Boolean) ? <><MapPin /><dl className="address-details">{address.city && <div><dt>Город</dt><dd>{address.city}</dd></div>}{address.street && <div><dt>Улица</dt><dd>{address.street}</dd></div>}{address.building && <div><dt>Дом / корпус</dt><dd>{address.building}</dd></div>}{address.additional && <div><dt>Дополнительно</dt><dd>{address.additional}</dd></div>}</dl></> : <p>Адресные данные не указаны</p>}</div></section></div>, document.body)
}

function PhoneMenu({ phones, onClose }: { phones: string[]; onClose: () => void }) {
  return <div className="phone-menu" role="dialog" aria-label="Телефоны компании" onClick={(event) => event.stopPropagation()}><div className="phone-menu-title">Телефоны компании <button onClick={onClose} aria-label="Закрыть телефоны"><X /></button></div>{phones.map((phone) => <div className="phone-row" key={phone}><a href={`tel:${phone.replace(/\s/g, "")}`}><Phone />{phone}</a><div><Button size="sm" variant="ghost" onClick={() => copyValue(phone, "Номер скопирован")}>Скопировать</Button><Button size="sm" variant="outline" asChild><a href={`tel:${phone.replace(/\s/g, "")}`}>Позвонить</a></Button></div></div>)}</div>
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [addressOpen, setAddressOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts)
  const [quoteStatus, setQuoteStatus] = useState("КП озвучено")
  const cardRef = useRef<HTMLDivElement>(null)
  const saveContact = (contact: ContactRecord) => setContacts((current) => { const normalized = contact.primary ? current.map((item) => ({ ...item, primary: false })) : current; const exists = normalized.some((item) => item.id === contact.id); return exists ? normalized.map((item) => item.id === contact.id ? contact : item) : [...normalized, contact] })
  return <div className="lead-card" ref={cardRef} role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick() } }}><div className="lead-card-direction"><Badge variant="secondary">А2СП</Badge></div><div className="lead-card-header"><div className="lead-card-title"><h3>{lead.company}</h3><span className={cn("lead-stage-duration", lead.days >= 14 && "is-long")}>{lead.days} дн в стадии</span></div><div className="lead-card-header-actions" onClick={(event) => event.stopPropagation()}><Button size="icon" variant="ghost" title="Телефоны компании" aria-label="Телефоны компании" onClick={() => setPhoneOpen((open) => !open)}><Phone /></Button><Button size="icon" variant="ghost" title={`Контакты · ${contacts.length}`} aria-label={`Открыть контакты, ${contacts.length}`} onClick={() => { setPhoneOpen(false); setContactsOpen(true) }}><Users /></Button></div></div><p className="lead-service">{lead.request}</p><div className="lead-object-line"><button className="lead-address-icon" type="button" title="Показать адрес" aria-label={`Показать адрес: ${lead.address?.city || "Адрес не указан"}`} onClick={(event) => { event.stopPropagation(); setAddressOpen(true) }}><MapPin /></button><span className="lead-object-name">{lead.objectName || "Название объекта не указано"}</span></div><div className="lead-financials" onClick={(event) => event.stopPropagation()}><strong>{lead.value}</strong><Select value={quoteStatus} onValueChange={setQuoteStatus}><SelectTrigger aria-label="Статус КП"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="КП озвучено">КП озвучено</SelectItem><SelectItem value="КП отправлено">КП отправлено</SelectItem></SelectContent></Select></div><div className="lead-owner-row"><span>{lead.owner}</span><Button size="icon" variant="ghost" aria-label="Добавить быстрое действие" title="Добавить быстрое действие"><Plus /></Button></div>{phoneOpen && <PhoneMenu phones={[lead.phone, "+7 812 555-00-12"]} onClose={() => setPhoneOpen(false)} />}{addressOpen && <AddressModal address={lead.address} onClose={() => setAddressOpen(false)} />}{contactsOpen && <ContactsModal contacts={contacts} onClose={() => setContactsOpen(false)} onSave={saveContact} />}</div>
}
