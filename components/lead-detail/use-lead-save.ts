"use client"

import { toast } from "sonner"
import { updateLeadDetails, type LeadDetailsPatch } from "@/app/actions/lead-details"
import type { Lead } from "@/components/lead-card"

export type SaveLead = (patch: LeadDetailsPatch, successMessage?: string) => Promise<boolean>

export function useLeadSave(lead: Lead, onLeadUpdated: (lead: Lead) => void): SaveLead {
  return async (patch, successMessage) => {
    try {
      const updated = await updateLeadDetails(lead.id, patch)
      onLeadUpdated({ ...lead, ...updated, days: lead.days })
      if (successMessage) toast.success(successMessage)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить изменения")
      return false
    }
  }
}
