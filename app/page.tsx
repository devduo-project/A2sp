import { connection } from "next/server"
import { getSavedContacts } from "@/app/actions/lead-records"
import { getCompanies } from "@/app/actions/companies"
import { getLeads } from "@/app/actions/leads"
import { CRMDashboard } from "@/components/crm-dashboard"

export default async function Home({ searchParams }: { searchParams: Promise<{ lead?: string | string[] }> }) {
  await connection()
  const { lead } = await searchParams
  const [leads, contacts, companies] = await Promise.all([getLeads(), getSavedContacts(), getCompanies()])
  return <CRMDashboard initialLeads={leads} initialContacts={contacts} initialCompanies={companies} initialLeadId={Array.isArray(lead) ? lead[0] : lead} />
}
