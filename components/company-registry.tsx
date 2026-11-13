"use client"

import { useMemo, useState } from "react"
import type { Lead } from "@/components/lead-card"
import type { SavedContact } from "@/app/actions/lead-records"
import { CompaniesTable } from "@/components/companies-table"
import { ContactsTable } from "@/components/contacts-table"
import { CompanyDetailsDialog, ContactDetailsDialog } from "@/components/company-registry-dialogs"
import { buildCompanyViewModels, flattenCompanyContacts, type ExistingDeal } from "@/lib/company-registry-data"
import { demoCompanies } from "@/lib/company-registry-demo"

type RegistryView = "companies" | "contacts"

export function CompanyRegistry({
  view,
  leads,
  savedContacts,
  deals,
  onLeadSelect,
  onDealSelect,
}: {
  view: RegistryView
  leads: Lead[]
  savedContacts: SavedContact[]
  deals: ExistingDeal[]
  onLeadSelect: (leadId: string) => boolean
  onDealSelect: (dealId: string) => boolean
}) {
  const [companies, setCompanies] = useState(() => buildCompanyViewModels(leads, savedContacts, deals, demoCompanies))
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null
  const contacts = useMemo(() => flattenCompanyContacts(companies), [companies])
  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) ?? null

  const updateCompanyContacts = (companyId: string, nextContacts: typeof companies[number]["contacts"]) => {
    setCompanies((current) => current.map((company) => company.id === companyId ? { ...company, contacts: nextContacts } : company))
  }

  return (
    <>
      {view === "companies" ? (
        <CompaniesTable
          companies={companies}
          onCompanySelect={(company) => setSelectedCompanyId(company.id)}
          onContactsChange={updateCompanyContacts}
          onRecordSelect={(type, record) => {
            if (type === "Лид" && record.originalLeadId) return onLeadSelect(record.originalLeadId)
            if (type === "Сделка") return onDealSelect(record.id)
            return false
          }}
        />
      ) : (
        <ContactsTable
          contacts={contacts}
          onContactSelect={(contact) => setSelectedContactId(contact.id)}
          onCompanySelect={(companyId) => setSelectedCompanyId(companyId)}
        />
      )}
      <CompanyDetailsDialog company={selectedCompany} open={Boolean(selectedCompany)} onOpenChange={(open) => { if (!open) setSelectedCompanyId(null) }} />
      <ContactDetailsDialog contact={selectedContact} open={Boolean(selectedContact)} onOpenChange={(open) => { if (!open) setSelectedContactId(null) }} />
    </>
  )
}
