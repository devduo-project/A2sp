import { connection } from "next/server"
import { getLeads } from "@/app/actions/leads"
import { CRMDashboard } from "@/components/crm-dashboard"

export default async function Home() {
  await connection()
  const leads = await getLeads()
  return <CRMDashboard initialLeads={leads} />
}
