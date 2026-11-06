import { connection } from "next/server"
import { getSavedContacts } from "@/app/actions/lead-records"
import { getLeads } from "@/app/actions/leads"
import { CRMDashboard } from "@/components/crm-dashboard"

export default async function Home({ searchParams }: { searchParams: Promise<{ lead?: string | string[] }> }) {
  await connection()
  const { lead } = await searchParams
  const [leads, contacts] = await Promise.all([getLeads(), getSavedContacts()])
  return <CRMDashboard initialLeads={leads} initialContacts={contacts} initialLeadId={Array.isArray(lead) ? lead[0] : lead} />
}
