"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Building2, Copy, Mail, MapPin, MessageCircle, Phone, Plus, Send, Trash2, Users, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { tokarev } from "@/lib/employees"
import { LeadQuickActions, type QuickActionType } from "@/components/lead-quick-actions"
import { createLeadContact, updateLeadContact, type SavedContact } from "@/app/actions/lead-records"
import type { ContactMethod } from "@/lib/db/schema"
import { updateLeadFields } from "@/app/actions/leads"
import { defaultLeadCardConfig, getLeadCardTitleStyle, type LeadCardConfig, type LeadCardElementId, type LeadCardTitleStyle } from "@/lib/lead-card-config"

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
  stageEnteredAt?: string
  stage: string
  email?: string
  emails?: string[]
}

type ContactRecord = { id: number; name: string; role: string; phone: string; email: string; telegram?: string; contactMethods?: ContactMethod[]; primary?: boolean; manager?: string }
type LeadCardProps = {
  lead: Lead
  onClick: () => void
  onQuickAction?: (type: QuickActionType, lead: Lead) => void
  savedContacts?: SavedContact[]
  isDragging?: boolean
  dragProps?: Pick<React.HTMLAttributes<HTMLDivElement>, "draggable" | "onDragStart" | "onDragEnd">
  cardConfig?: LeadCardConfig
}

function copyValue(value: string, label: string) { navigator.clipboard?.writeText(value); toast.success(label) }

function normalizeContactValues(...values: unknown[]) {
  const collected = values.flatMap((value) => Array.isArray(value) ? value : [value])
  return [...new Set(collected.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))]
}

function ContactActionButton({ kind, values, active, setActive, onManage }: { kind: "phone" | "email"; values: string[]; active: boolean; setActive: (kind: "phone" | "email" | null) => void; onManage?: () => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinned = useRef(false)
  const [position, setPosition] = useState({ left: 0, top: 0, above: false })
  const label = kind === "phone" ? "Телефоны компании" : "Email компании"
  const Icon = kind === "phone" ? Phone : Mail
  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 292)), top: rect.bottom + 8, above: window.innerHeight - rect.bottom < 190 })
  }
  const show = () => {
    if (!values.length) return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    updatePosition()
    setActive(kind)
  }
  const scheduleClose = () => {
    if (pinned.current) return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setActive(null), 180)
  }
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { pinned.current = false; setActive(null) } }
    const reposition = () => updatePosition()
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => { document.removeEventListener("keydown", onKeyDown); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true) }
  }, [active])
  return <><Button ref={triggerRef} className={kind === "phone" ? "lead-card-contact-phone" : "lead-card-contact-email"} size="icon" variant="ghost" type="button" title={label} aria-label={`${label}${values.length ? `, ${values.length}` : ", нет данных"}`} aria-expanded={active} aria-haspopup="true" onMouseEnter={() => { closeTimer.current = setTimeout(show, 240) }} onMouseLeave={scheduleClose} onFocus={show} onBlur={scheduleClose} onClick={(event) => { event.stopPropagation(); pinned.current = false; setActive(null); onManage?.() }}>{<Icon />}</Button>{active && values.length > 0 && typeof document !== "undefined" && createPortal(<div className="lead-contact-tooltip" role="tooltip" style={{ left: position.left, top: position.top, transform: position.above ? "translateY(-100%)" : undefined }} onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current) }} onMouseLeave={scheduleClose}><strong>{kind === "phone" ? "Телефоны" : "Email"}</strong>{values.map((value) => <a key={value} href={kind === "phone" ? `tel:${value.replace(/[^+\d]/g, "")}` : `mailto:${value}`} onClick={(event) => event.stopPropagation()}>{kind === "phone" ? <Phone aria-hidden="true" /> : <Mail aria-hidden="true" />}<span>{value}</span></a>)}{kind === "phone" && onManage && <button type="button" className="lead-contact-tooltip-manage" onClick={(event) => { event.stopPropagation(); pinned.current = false; setActive(null); onManage() }}>Изменить телефоны</button>}</div>, document.body)}</>
}

function formatRubles(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/\.(?=.*\.)/g, "")
  const amount = Number(normalized)
  return Number.isFinite(amount) && normalized ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(amount)}\u00a0₽` : value
}

function ContactForm({ contact, onSave, onCancel }: { contact?: ContactRecord; onSave: (contact: ContactRecord) => void; onCancel: () => void }) {
  const [form, setForm] = useState(contact ?? { id: Date.now(), name: "", role: "", phone: "", email: "", telegram: "", primary: false, manager: "" })
  const [methods, setMethods] = useState<ContactMethod[]>(contact?.contactMethods ?? [])
  const [addingType, setAddingType] = useState(false)
  const update = (key: keyof ContactRecord, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))
  const addMethod = (kind: ContactMethod["kind"]) => {
    setMethods((current) => [...current, { id: crypto.randomUUID(), kind, provider: kind === "messenger" ? "Telegram" : undefined, value: "" }])
    setAddingType(false)
  }
  const updateMethod = (id: string, patch: Partial<ContactMethod>) => setMethods((current) => current.map((method) => method.id === id ? { ...method, ...patch } : method))
  const save = () => {
    const telegram = form.telegram?.trim() ?? ""
    if (telegram && !(/^(?:@[A-Za-z0-9_]{5,32}|https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\/?$)/i.test(telegram))) {
      toast.error("Укажите Telegram как @username или https://t.me/username")
      return
    }
    const cleanMethods = methods.filter((method) => method.value.trim()).map((method) => ({ ...method, value: method.value.trim() }))
    onSave({ ...form, telegram, contactMethods: cleanMethods })
  }
  return <div className="contact-form">
    <label>ФИО сотрудника<Input value={form.name} onChange={(e) => update("name", e.target.value)} autoFocus /></label>
    <label>Должность<Input value={form.role} onChange={(e) => update("role", e.target.value)} /></label>
    <label>Телефон<Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></label>
    <label>Email<Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></label>
    <label>Telegram<Input value={form.telegram ?? ""} onChange={(e) => update("telegram", e.target.value)} placeholder="@username или https://t.me/username" /></label>
    <section className="lead-contact-methods" aria-label="Дополнительные способы связи">
      <div className="lead-contact-methods-heading"><strong>Дополнительные способы связи</strong><Button type="button" size="sm" variant="outline" aria-expanded={addingType} onClick={() => setAddingType((current) => !current)}><Plus data-icon="inline-start" /> Добавить способ связи</Button></div>
      {addingType && <div className="lead-contact-method-picker" role="group" aria-label="Выберите тип связи"><Button type="button" size="sm" variant="ghost" onClick={() => addMethod("messenger")}>Мессенджер</Button><Button type="button" size="sm" variant="ghost" onClick={() => addMethod("phone")}>Телефон</Button><Button type="button" size="sm" variant="ghost" onClick={() => addMethod("email")}>Email</Button></div>}
      {methods.map((method) => <div className="lead-contact-method-row" key={method.id}>
        <div className="lead-contact-method-fields">
          <label>Тип<select aria-label="Тип способа связи" value={method.kind} onChange={(event) => updateMethod(method.id, { kind: event.target.value as ContactMethod["kind"], provider: event.target.value === "messenger" ? "Telegram" : undefined })}><option value="messenger">Мессенджер</option><option value="phone">Телефон</option><option value="email">Email</option></select></label>
          {method.kind === "messenger" && <label>Платформа<select aria-label="Платформа мессенджера" value={method.provider ?? "Telegram"} onChange={(event) => updateMethod(method.id, { provider: event.target.value })}><option>Telegram</option><option>WhatsApp</option><option>MAX</option><option>Viber</option><option>Skype</option><option>Другое</option></select></label>}
          <label>{method.kind === "messenger" ? "Username, номер или ссылка" : method.kind === "phone" ? "Номер телефона" : "Email"}<Input aria-label={method.kind === "messenger" ? "Username, номер или ссылка" : method.kind === "phone" ? "Номер дополнительного телефона" : "Дополнительный email"} type={method.kind === "phone" ? "tel" : method.kind === "email" ? "email" : "text"} value={method.value} onChange={(event) => updateMethod(method.id, { value: event.target.value })} placeholder={method.kind === "phone" ? "+7 ..." : method.kind === "email" ? "name@example.com" : "@username или ссылка"} /></label>
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label="Удалить способ связи" onClick={() => setMethods((current) => current.filter((item) => item.id !== method.id))}><Trash2 /></Button>
      </div>)}
    </section>
    <label className="contact-checkbox"><input type="checkbox" checked={Boolean(form.primary)} onChange={(e) => update("primary", e.target.checked)} /> Основной контакт</label>
    <div className="modal-actions"><Button type="button" variant="outline" onClick={onCancel}>Отмена</Button><Button type="button" disabled={!form.name.trim()} onClick={save}>Сохранить</Button></div>
  </div>
}

type ContactChannel = { kind: ContactMethod["kind"]; value: string; provider?: string }

function ContactChannelAction({ channel }: { channel: ContactChannel }) {
  const [open, setOpen] = useState(false)
  const value = channel.value.trim()
  const provider = channel.provider?.toLowerCase() ?? ""
  const isSupportedMessenger = channel.kind === "messenger" && (["telegram", "whatsapp", "viber", "skype"].includes(provider)) && (provider === "telegram" ? /^(?:@?[A-Za-z0-9_]{5,32}|https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\/?|\+?[\d\s().-]{7,})$/i.test(value) : provider === "whatsapp" || provider === "viber" ? value.replace(/\D/g, "").length >= 7 : Boolean(value.trim()))
  const icon = channel.kind === "phone" ? <Phone aria-hidden="true" /> : channel.kind === "email" ? <Mail aria-hidden="true" /> : provider === "telegram" ? <Send aria-hidden="true" /> : <MessageCircle aria-hidden="true" />
  const composeEmail = (service: "mail" | "gmail" | "yandex") => {
    const url = service === "gmail" ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(value)}` : service === "yandex" ? `https://mail.yandex.ru/compose?to=${encodeURIComponent(value)}` : `mailto:${value}`
    if (service === "mail") window.location.href = url
    else window.open(url, "_blank", "noopener,noreferrer")
    setOpen(false)
  }
  const openMessenger = () => {
    let url = ""
    if (provider === "telegram") url = value.startsWith("https://") ? value : `https://t.me/${value.replace(/^@/, "")}`
    if (provider === "whatsapp") url = `https://wa.me/${value.replace(/\D/g, "")}`
    if (provider === "viber") url = `viber://chat?number=${encodeURIComponent(value.replace(/\D/g, ""))}`
    if (provider === "skype") url = `skype:${encodeURIComponent(value)}?chat`
    if (url) window.open(url, "_blank", "noopener,noreferrer")
    setOpen(false)
  }
  if (!value) return null
  return <div className="contact-channel-row"><span className="contact-channel-icon-wrap"><button type="button" className="contact-channel-icon" aria-label={channel.kind === "messenger" ? `Действия: ${channel.provider ?? "мессенджер"}` : `Действия: ${value}`} aria-expanded={open} disabled={channel.kind === "messenger" && !isSupportedMessenger} title={channel.kind === "messenger" && !isSupportedMessenger ? "Действие недоступно" : undefined} onClick={() => setOpen((current) => !current)}>{icon}</button>{open && <div className="contact-channel-menu" role="group" aria-label="Действия со способом связи">{channel.kind === "phone" ? <><a href={`tel:${value.replace(/[^+\d]/g, "")}`} onClick={() => setOpen(false)}>Позвонить</a><button type="button" onClick={() => { copyValue(value, "Номер скопирован"); setOpen(false) }}>Скопировать номер</button></> : channel.kind === "email" ? <><button type="button" onClick={() => composeEmail("mail")}>Написать · Mail</button><button type="button" onClick={() => composeEmail("gmail")}>Написать · Gmail</button><button type="button" onClick={() => composeEmail("yandex")}>Написать · Яндекс Почта</button><button type="button" onClick={() => { copyValue(value, "Email скопирован"); setOpen(false) }}>Скопировать адрес</button></> : isSupportedMessenger ? <button type="button" onClick={openMessenger}>Открыть чат</button> : <span>Действие недоступно</span>}</div>}</span><span className="contact-channel-value" title={value}>{value}</span></div>
}

function getContactChannels(contact: ContactRecord): ContactChannel[] {
  const candidates: ContactChannel[] = [
    ...(contact.phone ? [{ kind: "phone" as const, value: contact.phone }] : []),
    ...(contact.email ? [{ kind: "email" as const, value: contact.email }] : []),
    ...(contact.telegram ? [{ kind: "messenger" as const, provider: "Telegram", value: contact.telegram }] : []),
    ...(contact.contactMethods ?? []).map(({ kind, provider, value }) => ({ kind, provider, value })),
  ]
  const seen = new Set<string>()
  return candidates.filter(({ kind, provider, value }) => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    const key = `${kind}:${kind === "messenger" ? provider?.toLowerCase() : ""}:${normalized}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ContactsModal({ contacts, companyName, onClose, onSave }: { contacts: ContactRecord[]; companyName: string; onClose: () => void; onSave: (contact: ContactRecord) => Promise<void> }) {
  const [editing, setEditing] = useState<ContactRecord | undefined>()
  const [adding, setAdding] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", onKey); dialogRef.current?.focus(); const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow } }, [onClose])
  const save = async (contact: ContactRecord) => { try { await onSave(contact); setAdding(false); setEditing(undefined); toast.success("Контакт сохранён") } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось сохранить контакт") } }
  return typeof document === "undefined" ? null : createPortal(<div className="contacts-overlay" role="presentation" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="contacts-modal" onClick={(event) => event.stopPropagation()} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="contacts-title" onMouseDown={(event) => event.stopPropagation()}><header className="contacts-modal-header"><div><h2 id="contacts-title">Контакты компании</h2><p className="contacts-company-name">{companyName}</p></div><button className="modal-close" aria-label="Закрыть контакты" title="Закрыть" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClose() }}><X /></button></header>{adding || editing ? <><ContactForm contact={editing} onSave={save} onCancel={() => { setAdding(false); setEditing(undefined) }} /></> : <><div className="contacts-modal-toolbar"><span>{contacts.length ? `Контакты · ${contacts.length}` : "Контакты не добавлены"}</span><Button size="sm" onClick={() => setAdding(true)}><Plus data-icon="inline-start" /> Добавить контакт</Button></div><div className="contact-list">{contacts.length ? contacts.map((contact) => <article className="contact-list-item" key={contact.id}><div className="contact-list-main"><div className="contact-avatar">{contact.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><h3>{contact.name} {contact.primary && <Badge variant="secondary">Основной контакт</Badge>}</h3><p>{contact.role}{contact.manager ? ` · Ответственный: ${contact.manager}` : ""}</p><div className="contact-detail-row">{getContactChannels(contact).map((channel, index) => <ContactChannelAction key={`${channel.kind}-${channel.provider ?? ""}-${channel.value}-${index}`} channel={channel} />)}</div></div></div><div className="contact-item-actions"><Button size="sm" variant="outline" onClick={() => setEditing(contact)}>Изменить</Button></div></article>) : <div className="contacts-empty"><Users /><p>Конта��ты не добавлены</p><Button onClick={() => setAdding(true)}><Plus data-icon="inline-start" /> Добавить контакт</Button></div>}</div></>}</section></div>, document.body)
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

function CompanyDataModal({ kind, values, companyName, onClose, onSave }: { kind: "phone" | "email"; values: string[]; companyName: string; onClose: () => void; onSave: (values: string[]) => Promise<void> }) {
  const [draft, setDraft] = useState(values)
  const [editing, setEditing] = useState<number | null>(null)
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)
  const [adding, setAdding] = useState(false)
  const isPhone = kind === "phone"
  const title = isPhone ? "Телефон" : "Почта"
  const valid = (candidate: string) => isPhone ? candidate.trim().length > 0 : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.trim())
  useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === "Escape" && editing === null && onClose(); document.addEventListener("keydown", onKey); const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous } }, [onClose, editing])
  const finishEdit = () => { const cleaned = value.trim(); if (!valid(cleaned)) { toast.error(isPhone ? "Укажите телефон" : "Укажите корректный email"); return } setDraft((current) => editing === null ? [...current, cleaned] : current.map((entry, index) => index === editing ? cleaned : entry)); setEditing(null); setAdding(false); setValue("") }
  const save = async () => { setPending(true); try { await onSave(draft); onClose() } catch { /* Keep the dialog open so the user can retry. */ } finally { setPending(false) } }
  const compose = (address: string, provider: "gmail" | "yandex" | "mailto") => {
    const urls = { gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(address)}`, yandex: `https://mail.yandex.ru/compose?to=${encodeURIComponent(address)}`, mailto: `mailto:${address}` }
    window.open(urls[provider], provider === "mailto" ? "_self" : "_blank", provider === "mailto" ? undefined : "noopener,noreferrer")
  }
  return typeof document === "undefined" ? null : createPortal(<div className="contacts-overlay" role="presentation" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.target === event.currentTarget && editing === null && onClose()}><section className="contacts-modal company-values-modal" role="dialog" aria-modal="true" aria-labelledby="company-values-title" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}><header className="contacts-modal-header"><div><h2 id="company-values-title">{title}</h2><p className="contacts-company-name">{companyName}</p></div><button className="modal-close" aria-label={`Закрыть: ${title}`} onClick={onClose}><X /></button></header><div className="contacts-modal-toolbar"><span>{draft.length ? `${isPhone ? "Телефоны" : "Адреса почты"} · ${draft.length}` : `${isPhone ? "Телефоны" : "Адреса почты"} не добавлены`}</span><Button size="sm" onClick={() => { setEditing(null); setAdding(true); setValue("") }}><Plus data-icon="inline-start" /> {isPhone ? "Добавить телефон" : "Добавить почту"}</Button></div><div className="company-values-list">{draft.map((entry, index) => <article className="company-value-row" key={`${entry}-${index}`}>{editing === index ? <div className="company-value-edit"><Input autoFocus type={isPhone ? "tel" : "email"} aria-label={title} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) finishEdit() }} /><Button size="sm" onClick={finishEdit}>Сохранить</Button><Button size="sm" variant="ghost" onClick={() => { setEditing(null); setValue("") }}>Отмена</Button></div> : <><div className="company-value-label">{isPhone ? <Phone aria-hidden="true" /> : <Mail aria-hidden="true" />}<span>{entry}</span></div><div className="company-value-actions">{isPhone ? <Button size="icon" variant="ghost" title="Позвонить" aria-label={`Позвонить ${entry}`} asChild><a href={`tel:${entry.replace(/[^+\d]/g, "")}`}><Phone /></a></Button> : <details className="company-compose-menu"><summary aria-label={`Написать на ${entry}`}><Mail /></summary><div><button type="button" onClick={() => compose(entry, "gmail")}>Gmail</button><button type="button" onClick={() => compose(entry, "yandex")}>Яндекс Почта</button><button type="button" onClick={() => compose(entry, "mailto")}>Открыть почтовую программу</button></div></details>}<Button size="icon" variant="ghost" title="Скопировать" aria-label={`Скопировать ${entry}`} onClick={() => copyValue(entry, isPhone ? "Телефон скопирован" : "Email скопирован")}><Copy /></Button><Button size="sm" variant="outline" onClick={() => { setAdding(false); setEditing(index); setValue(entry) }}>Изменить</Button></div></>}</article>)}{adding && <div className="company-value-edit"><Input autoFocus type={isPhone ? "tel" : "email"} aria-label={title} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) finishEdit() }} /><Button size="sm" onClick={finishEdit}>Добавить</Button><Button size="sm" variant="ghost" onClick={() => setValue("")}>Отмена</Button></div>}{!draft.length && !adding && <div className="contacts-empty"><p>{isPhone ? "Телефоны компании не указаны" : "Общие адреса почты не указаны"}</p><Button variant="outline" onClick={() => { setEditing(null); setAdding(true); setValue("") }}><Plus data-icon="inline-start" /> {isPhone ? "Добавить телефон" : "Добавить почту"}</Button></div>}</div><div className="modal-actions"><Button variant="outline" onClick={onClose}>Отмена</Button><Button type="button" disabled={pending} onClick={save}>{pending ? "Сохраняем…" : "Сохранить"}</Button></div></section></div>, document.body)
}

export function LeadCard({ lead, onClick, onQuickAction, savedContacts = [], isDragging, dragProps, cardConfig }: LeadCardProps) {
  const [companyModal, setCompanyModal] = useState<"phone" | "email" | null>(null)
  const [activeContactTooltip, setActiveContactTooltip] = useState<"phone" | "email" | null>(null)
  const [companyPhones, setCompanyPhones] = useState<string[]>(() => normalizeContactValues(lead.companyPhones))
  const [companyEmails, setCompanyEmails] = useState<string[]>(() => normalizeContactValues(lead.emails))
  const [addressOpen, setAddressOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [localContacts, setContacts] = useState<ContactRecord[]>(() => lead.contact ? [{ id: 0, name: lead.contact, role: lead.role, phone: lead.phone, email: lead.email ?? "", primary: true, manager: lead.owner }] : [])
  const localIds = new Set(localContacts.map((contact) => contact.id))
  const storedContacts: ContactRecord[] = savedContacts
    .filter((contact) => contact.leadId === lead.id)
    .map((contact) => ({ id: SAVED_CONTACT_ID_OFFSET + contact.id, name: contact.name, role: contact.role, phone: contact.phone, email: contact.email, telegram: contact.telegram, contactMethods: contact.contactMethods }))
    .filter((contact) => !localIds.has(contact.id) && !localContacts.some((item) => item.name === contact.name && item.phone === contact.phone))
  const contacts = [...localContacts, ...storedContacts]
  const phoneValues = normalizeContactValues(companyPhones, lead.companyPhones)
  const emailValues = normalizeContactValues(companyEmails, lead.emails)
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
  const saveCompanyEmails = async (emails: string[]) => {
    try {
      const updated = await updateLeadFields(lead.id, { emails })
      setCompanyEmails(updated.emails?.length ? updated.emails : emails)
      toast.success("Почта компании сохранена")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить адреса почты")
      throw error
    }
  }
  const saveContact = async (contact: ContactRecord) => {
    const [firstName, ...lastNameParts] = contact.name.trim().split(/\s+/)
    const input = { leadId: lead.id, firstName, lastName: lastNameParts.join(" "), role: contact.role, phone: contact.phone, email: contact.email, telegram: contact.telegram ?? "", contactMethods: contact.contactMethods ?? [], comment: "" }
    const saved = contact.id >= SAVED_CONTACT_ID_OFFSET
      ? await updateLeadContact(contact.id - SAVED_CONTACT_ID_OFFSET, input)
      : await createLeadContact(input)
    const persisted: ContactRecord = { ...contact, id: SAVED_CONTACT_ID_OFFSET + saved.id, name: saved.name, telegram: saved.telegram, contactMethods: saved.contactMethods }
    setContacts((current) => {
      const normalized = contact.primary ? current.map((item) => ({ ...item, primary: false })) : current
      return [...normalized.filter((item) => item.id !== contact.id && item.id !== persisted.id), persisted]
    })
  }
  const activeConfig = cardConfig ?? defaultLeadCardConfig
  const hidden = new Set(activeConfig.hidden)
  const content: Record<LeadCardElementId, React.ReactNode> = {
    direction: <div className="lead-card-direction"><span className="direction-chip" data-direction={directionTone[lead.direction ?? "А2-СП"]}>{lead.direction ?? "А2-СП"}</span></div>,
    company: <div className="lead-company-row"><h3>{lead.company}</h3></div>,
    duration: <span className={cn("lead-stage-duration", lead.days >= 14 && "is-long")}>{lead.days} дн в стад��и</span>,
    service: <p className="lead-service"><Building2 />{lead.request}</p>,
    object: <div className="lead-object-line"><button className="lead-address-icon" type="button" title="Показать адрес" aria-label={`Показать адрес: ${lead.address?.city || "Адрес не указан"}`} onClick={(event) => { event.stopPropagation(); setAddressOpen(true) }}><MapPin /></button><span className="lead-object-name">{lead.objectName || "Название объекта не указано"}</span></div>,
    financials: <div className="lead-financials" onClick={(event) => event.stopPropagation()}><strong>{formatRubles(lead.value)}</strong><Select value={quoteStatus} onValueChange={setQuoteStatus}><SelectTrigger aria-label="Статус КП"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="КП озвучено">КП озвучено</SelectItem><SelectItem value="КП отправлено">КП отправлено</SelectItem></SelectContent></Select></div>,
    owner: <div className="lead-owner"><span className="lead-owner-label">Ответственный</span><span className="lead-owner-name" title={lead.owner}>{lead.owner}</span></div>,
  }
  const visibleInfoOrder = activeConfig.order.filter((id) => !hidden.has(id))
  const visibleTitleOrder = visibleInfoOrder.filter((id) => id === "company" || id === "object")
  const titleStyles: Partial<Record<LeadCardElementId, LeadCardTitleStyle>> = {}
  visibleTitleOrder.forEach((id, index) => { titleStyles[id] = getLeadCardTitleStyle(index) })
  const headingId = visibleTitleOrder[0]
  const headingIndex = headingId ? visibleInfoOrder.indexOf(headingId) : -1
  const quickActionsInOwnerRow = visibleInfoOrder[visibleInfoOrder.length - 1] === "owner"
  const renderContent = (id: LeadCardElementId, index: number) => {
    const contentNode = content[id]
    if (id === "owner" && index === visibleInfoOrder.length - 1) {
      return <div key={id} className="lead-owner-row">{contentNode}<LeadQuickActions leadId={lead.id} onAction={(type) => onQuickAction?.(type, lead)} /></div>
    }
    if (id === "owner") return <div key={id} className="lead-card-info-item lead-card-owner-item">{contentNode}</div>
    const titleStyle = titleStyles[id]
    return <div key={id} className={cn("lead-card-info-item", titleStyle && "lead-card-title-item", titleStyle && `is-${titleStyle}`)}>{contentNode}</div>
  }
  const renderItems = (ids: LeadCardElementId[]) => ids.map((id) => renderContent(id, visibleInfoOrder.indexOf(id)))
  const contactActions = <div className="lead-card-header-actions" onClick={(event) => event.stopPropagation()}><ContactActionButton kind="phone" values={phoneValues} active={activeContactTooltip === "phone"} setActive={setActiveContactTooltip} onManage={() => setCompanyModal("phone")} /><ContactActionButton kind="email" values={emailValues} active={activeContactTooltip === "email"} setActive={setActiveContactTooltip} onManage={() => setCompanyModal("email")} /><Button className="lead-card-contact-contacts" size="icon" variant="ghost" title={`Контакты · ${contacts.length}`} aria-label={`Открыть контакты, ${contacts.length}`} onClick={() => { setCompanyModal(null); setContactsOpen(true) }}><Users /></Button></div>
  return (
    <div className={cn("lead-card", isDragging && "is-dragging")} data-lead-id={lead.id} {...dragProps} ref={cardRef} role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick() } }}>
      <div className="lead-card-info">
        {!headingId ? <>
          <div className="lead-card-heading-row is-actions-only">{contactActions}</div>
          {renderItems(visibleInfoOrder)}
        </> : <>
          {renderItems(visibleInfoOrder.slice(0, headingIndex))}
          <div className="lead-card-heading-row">
            <div className="lead-card-heading-text">{renderContent(headingId, headingIndex)}</div>
            {contactActions}
          </div>
          {renderItems(visibleInfoOrder.slice(headingIndex + 1))}
        </>}
        {!quickActionsInOwnerRow && <div className="lead-card-actions-footer"><LeadQuickActions leadId={lead.id} onAction={(type) => onQuickAction?.(type, lead)} /></div>}
      </div>
      {companyModal && <CompanyDataModal kind={companyModal} values={companyModal === "phone" ? phoneValues : emailValues} companyName={lead.company} onClose={() => setCompanyModal(null)} onSave={companyModal === "phone" ? saveCompanyPhones : saveCompanyEmails} />}
      {addressOpen && <AddressModal address={lead.address} onClose={() => setAddressOpen(false)} />}
      {contactsOpen && <ContactsModal contacts={contacts} companyName={lead.company} onClose={() => setContactsOpen(false)} onSave={saveContact} />}
    </div>
  )
}
