"use client"

import { useMemo, useState, type ComponentProps } from "react"
import useSWR from "swr"
import { getLeadTasks } from "@/app/actions/lead-details"
import { saveCompanyContactMethods, type SavedCompany } from "@/app/actions/companies"
import type { SavedContact } from "@/app/actions/lead-records"
import type { Lead } from "@/components/lead-card"
import { LeadDetailHeader } from "@/components/lead-detail-header"
import { CompanyContactsDialog, CompanyDetailsDialog } from "@/components/company-registry-dialogs"
import { CommunicationsTab } from "@/components/lead-detail/communications-tab"
import { ContactsCard, CustomerCard } from "@/components/lead-detail/customer-cards"
import { HistoryTab, KpVersionsTab } from "@/components/lead-detail/kp-history-tabs"
import { AmountCard, ObjectCard, ServiceCard } from "@/components/lead-detail/object-cards"
import { DocumentsCard, ParticipantsCard } from "@/components/lead-detail/people-docs-cards"
import { TasksTab } from "@/components/lead-detail/tasks-tab"
import { TaskCreateDialog } from "@/components/lead-detail/task-create-dialog"
import { useLeadSave, type SaveLead } from "@/components/lead-detail/use-lead-save"
import { buildCompanyViewModels, type CompanyViewModel, type RegistryContact } from "@/lib/company-registry-data"
import type { CompanyContactMethod } from "@/lib/db/schema"
import { cn } from "@/lib/utils"
import "@/components/lead-detail/lead-detail.css"

const tabs = [
  ["info", "Основная информация"],
  ["tasks", "Задачи"],
  ["communications", "Коммуникации"],
  ["kp", "Версии КП"],
  ["history", "История действий"],
] as const
type TabId = (typeof tabs)[number][0]

type ContactsMode = "add" | "edit" | null

function Overview({
  lead,
  leads,
  savedContacts,
  savedCompanies,
  save,
  onSavedContact,
}: {
  lead: Lead
  leads: Lead[]
  savedContacts: SavedContact[]
  savedCompanies: SavedCompany[]
  save: SaveLead
  onSavedContact?: (contact: SavedContact) => void
}) {
  const initialCompany = useMemo<CompanyViewModel>(() => {
    const name = lead.company.trim()
    const found = buildCompanyViewModels(leads, savedContacts, [], [], savedCompanies).find((company) => company.legalName === name)
    return found ?? { id: `source-company-${encodeURIComponent(name)}`, legalName: name, contactMethods: [], contacts: [], leads: [], deals: [], isDemo: false }
    // The company is rebuilt only when the lead's company changes; later edits live in local state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.company])
  const [company, setCompany] = useState(initialCompany)
  const [requisitesOpen, setRequisitesOpen] = useState(false)
  const [contactsMode, setContactsMode] = useState<ContactsMode>(null)

  const updateMethods = async (methods: CompanyContactMethod[]) => {
    const saved = await saveCompanyContactMethods(company.legalName, methods)
    setCompany((current) => ({ ...current, databaseId: saved.id, contactMethods: saved.contactMethods }))
    await save({ notes: ["Изменены контакты организации"] })
  }

  const updateContacts = (contacts: RegistryContact[]) => {
    setCompany((current) => ({ ...current, contacts }))
    void save({ notes: ["Изменены контакты заказчика"] })
  }

  return (
    <div className="ld-overview">
      <div className="ld-row ld-row-2">
        <CustomerCard lead={lead} company={company} onRequisites={() => setRequisitesOpen(true)} onOrganizationContacts={() => setContactsMode("edit")} />
        <ContactsCard company={company} onAdd={() => setContactsMode("add")} onEdit={() => setContactsMode("edit")} />
      </div>
      <div className="ld-row ld-row-3">
        <ServiceCard lead={lead} save={save} />
        <ObjectCard lead={lead} save={save} />
        <AmountCard lead={lead} save={save} />
      </div>
      <ParticipantsCard lead={lead} save={save} />
      <DocumentsCard lead={lead} save={save} />
      <CompanyDetailsDialog company={company} open={requisitesOpen} onOpenChange={setRequisitesOpen} />
      <CompanyContactsDialog
        key={contactsMode ?? "closed"}
        company={company}
        open={contactsMode !== null}
        startWithNewContact={contactsMode === "add"}
        onOpenChange={(open) => { if (!open) setContactsMode(null) }}
        onContactsChange={updateContacts}
        onCompanyMethodsChange={updateMethods}
        onSavedContact={onSavedContact}
      />
    </div>
  )
}

export function LeadDetailPage({
  lead,
  leads,
  stages,
  savedContacts,
  savedCompanies,
  onStageChange,
  onLeadUpdated,
  onBack,
  onSavedContact,
}: {
  lead: Lead
  leads: Lead[]
  stages: ComponentProps<typeof LeadDetailHeader>["stages"]
  savedContacts: SavedContact[]
  savedCompanies: SavedCompany[]
  onStageChange: ComponentProps<typeof LeadDetailHeader>["onStageChange"]
  onLeadUpdated: (lead: Lead) => void
  onBack: () => void
  onSavedContact?: (contact: SavedContact) => void
}) {
  const [tab, setTab] = useState<TabId>("info")
  const [taskDialog, setTaskDialog] = useState<{ communicationId?: string } | null>(null)
  const [focusTask, setFocusTask] = useState<number>()
  const [focusCommunication, setFocusCommunication] = useState<string>()
  const save = useLeadSave(lead, onLeadUpdated)
  const { data: tasks, error, isLoading, mutate } = useSWR(["lead-tasks", lead.id], ([, id]) => getLeadTasks(id as string))
  const details = lead.details ?? {}
  const taskList = tasks ?? []
  const contactNames = useMemo(() => {
    const company = buildCompanyViewModels(leads, savedContacts, [], [], savedCompanies).find((item) => item.legalName === lead.company.trim())
    return [...new Set([lead.contact, ...(company?.contacts.map((contact) => contact.name) ?? [])].filter(Boolean))]
  }, [lead.company, lead.contact, leads, savedCompanies, savedContacts])

  const openCommunication = (id: string) => { setFocusCommunication(id); setTab("communications") }
  const openTask = (id: number) => { setFocusTask(id); setTab("tasks") }

  return (
    <div className="detail-shell ld-shell">
      <LeadDetailHeader lead={lead} stages={stages} onBack={onBack} onStageChange={onStageChange} onLeadUpdated={onLeadUpdated} />
      <nav className="ld-tabs" aria-label="Разделы лида">
        <div role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`ld-tab-${id}`} aria-selected={tab === id} aria-controls="ld-panel" className={cn(tab === id && "is-active")} onClick={() => setTab(id)}>
              {label}
              {id === "tasks" && taskList.length > 0 && <span className="ld-count">{taskList.length}</span>}
            </button>
          ))}
        </div>
      </nav>
      <div id="ld-panel" role="tabpanel" aria-labelledby={`ld-tab-${tab}`} className="ld-panel">
        {tab === "info" && <Overview key={lead.company} lead={lead} leads={leads} savedContacts={savedContacts} savedCompanies={savedCompanies} save={save} onSavedContact={onSavedContact} />}
        {tab === "tasks" && <TasksTab lead={lead} tasks={taskList} loading={isLoading} failed={Boolean(error)} save={save} focusId={focusTask} onCreate={() => setTaskDialog({})} onOpenCommunication={openCommunication} />}
        {tab === "communications" && <CommunicationsTab communications={details.communications ?? []} tasks={taskList} contactNames={contactNames} save={save} focusId={focusCommunication} onCreateTask={(communicationId) => setTaskDialog({ communicationId })} onOpenTask={openTask} />}
        {tab === "kp" && <KpVersionsTab versions={details.kpVersions ?? []} save={save} />}
        {tab === "history" && <HistoryTab history={details.history ?? []} />}
      </div>
      {taskDialog && (
        <TaskCreateDialog
          key={`${lead.id}-${taskDialog.communicationId ?? "new"}`}
          lead={lead}
          open
          initialCommunicationId={taskDialog.communicationId}
          onOpenChange={(open) => { if (!open) setTaskDialog(null) }}
          onLeadUpdated={onLeadUpdated}
          onCreated={() => { void mutate() }}
        />
      )}
    </div>
  )
}
