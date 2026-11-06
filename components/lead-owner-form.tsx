"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { updateLeadFields } from "@/app/actions/leads"
import { employees } from "@/lib/employees"
import type { Lead } from "@/components/lead-card"
import { Field, FormShell } from "@/components/lead-action-dialogs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function OwnerForm({ lead, onClose, onLeadUpdated }: { lead: Lead; onClose: () => void; onLeadUpdated: (lead: Lead) => void }) {
  const [owner, setOwner] = useState(lead.owner || "")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!owner) return setError("Выберите ответственного")
    setPending(true)
    try {
      const updated = await updateLeadFields(lead.id, { owner })
      onLeadUpdated(updated)
      toast.success("Ответственный обновлён")
      onClose()
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Не удалось обновить ответственного")
      setPending(false)
    }
  }

  return (
    <FormShell title="Изменить ответственного" description={`Лид ${lead.id}. Выберите сотрудника, который отвечает за лид.`} onSubmit={submit} pending={pending} onClose={onClose}>
      <Field label="Ответственный" error={error} required>
        <Select value={owner} onValueChange={(value) => { setOwner(value); setError("") }}>
          <SelectTrigger autoFocus className="w-full" aria-label="Ответственный" aria-invalid={Boolean(error)}>
            <SelectValue placeholder="Выберите сотрудника" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((employee) => (
              <SelectItem key={employee} value={employee}>{employee}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormShell>
  )
}
