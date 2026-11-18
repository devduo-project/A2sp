"use client"

import { Building2, Mail, MoreVertical, Phone, Plus, UserRound, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Lead } from "@/components/lead-card"
import type { CompanyViewModel } from "@/lib/company-registry-data"
import { CardShell } from "@/components/lead-detail/card-shell"

function ValueWithMore({ values }: { values: string[] }) {
  if (!values.length) return <span className="ld-muted">Не указано</span>
  return (
    <>
      <span>{values[0]}</span>
      {values.length > 1 && <Badge variant="secondary" title={values.slice(1).join(", ")}>+{values.length - 1}</Badge>}
    </>
  )
}

export function CustomerCard({ lead, company, onRequisites, onOrganizationContacts }: { lead: Lead; company: CompanyViewModel; onRequisites: () => void; onOrganizationContacts: () => void }) {
  const methodPhones = company.contactMethods.filter((method) => method.kind === "phone").map((method) => method.value)
  const methodEmails = company.contactMethods.filter((method) => method.kind === "email").map((method) => method.value)
  const phones = methodPhones.length ? methodPhones : [lead.companyPhones?.[0] ?? lead.phone].filter(Boolean)
  const emails = methodEmails.length ? methodEmails : (lead.emails?.length ? lead.emails : [lead.email].filter((email): email is string => Boolean(email)))

  return (
    <CardShell title="Заказчик" icon={Building2} actions={<Button type="button" variant="outline" size="sm" onClick={onRequisites}>Реквизиты компании</Button>}>
      <h2 className="ld-customer-name">{lead.company}</h2>
      <dl className="ld-customer-meta">
        <div><dt>Телефон</dt><dd><ValueWithMore values={phones} /></dd></div>
        <div><dt>Email</dt><dd><ValueWithMore values={emails} /></dd></div>
      </dl>
      <Button type="button" variant="ghost" className="ld-link-button" onClick={onOrganizationContacts}>
        <Plus data-icon="inline-start" />
        Добавить / изменить контакты организации
      </Button>
    </CardShell>
  )
}

export function ContactsCard({ company, onAdd, onEdit }: { company: CompanyViewModel; onAdd: () => void; onEdit: () => void }) {
  return (
    <CardShell
      title="Контакты"
      icon={Users}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Действия с контактами"><MoreVertical /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onAdd}>Добавить контакт</DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>Изменить контакты</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <p className="ld-subtle">Контактные лица заказчика</p>
      {company.contacts.length ? (
        <ul className="ld-contact-list">
          {company.contacts.map((contact) => (
            <li key={contact.id}>
              <UserRound aria-hidden="true" />
              <div>
                <div className="ld-contact-name">
                  <strong>{contact.name}</strong>
                  {contact.isPrimary && <Badge variant="secondary">Основной контакт</Badge>}
                </div>
                {contact.role && <span className="ld-muted">{contact.role}</span>}
                <div className="ld-contact-channels">
                  {contact.emails.map((email) => <a key={email} href={`mailto:${email}`}><Mail aria-hidden="true" />{email}</a>)}
                  {contact.phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Phone aria-hidden="true" />{phone}</a>)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ld-empty-block">
          <p>Контакты пока не добавлены</p>
          <Button type="button" size="sm" onClick={onAdd}><Plus data-icon="inline-start" />Добавить контакт</Button>
        </div>
      )}
    </CardShell>
  )
}
