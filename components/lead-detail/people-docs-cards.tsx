"use client"

import { FileText, Plus, UserRound, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Lead } from "@/components/lead-card"
import { CardShell } from "@/components/lead-detail/card-shell"
import { EmployeePicker, initials } from "@/components/lead-detail/employee-picker"
import { AttachButton, FileList } from "@/components/lead-detail/file-list"
import type { SaveLead } from "@/components/lead-detail/use-lead-save"

function PeopleGroup({ label, names, exclude, onAdd, onRemove }: { label: string; names: string[]; exclude: string[]; onAdd: (name: string) => Promise<boolean>; onRemove: (name: string) => void }) {
  return (
    <div className="ld-people-group">
      <h4>{label}</h4>
      <div className="ld-chips">
        {names.map((name) => (
          <span className="ld-chip" key={name}>
            <span className="ld-avatar">{initials(name)}</span>
            {name}
            <button type="button" aria-label={`Убрать: ${name}`} onClick={() => onRemove(name)}><X /></button>
          </span>
        ))}
        <EmployeePicker multiple exclude={exclude} onSelect={onAdd}>
          <Button type="button" variant="outline" size="sm"><Plus data-icon="inline-start" />Добавить</Button>
        </EmployeePicker>
      </div>
      {!names.length && <p className="ld-empty-text">Не назначены</p>}
    </div>
  )
}

export function ParticipantsCard({ lead, save }: { lead: Lead; save: SaveLead }) {
  const coExecutors = lead.details?.coExecutors ?? []
  const observers = lead.details?.observers ?? []
  const assigned = [lead.owner, ...coExecutors, ...observers]

  return (
    <CardShell title="Ответственный и участники" icon={Users}>
      <div className="ld-people">
        <div className="ld-people-group">
          <h4>Ответственный</h4>
          <div className="ld-owner">
            <span className="ld-avatar"><UserRound aria-hidden="true" /></span>
            <strong>{lead.owner}</strong>
            <EmployeePicker current={lead.owner} exclude={[...coExecutors, ...observers]} onSelect={(name) => save({ owner: name }, "Ответственный изменён")}>
              <Button type="button" variant="outline" size="sm">Изменить</Button>
            </EmployeePicker>
          </div>
        </div>
        <PeopleGroup
          label="Соисполнители"
          names={coExecutors}
          exclude={assigned}
          onAdd={(name) => save({ details: { coExecutors: [...coExecutors, name] } })}
          onRemove={(name) => save({ details: { coExecutors: coExecutors.filter((item) => item !== name) } })}
        />
        <PeopleGroup
          label="Наблюдатели"
          names={observers}
          exclude={assigned}
          onAdd={(name) => save({ details: { observers: [...observers, name] } })}
          onRemove={(name) => save({ details: { observers: observers.filter((item) => item !== name) } })}
        />
      </div>
    </CardShell>
  )
}

export function DocumentsCard({ lead, save }: { lead: Lead; save: SaveLead }) {
  const documents = lead.details?.documents ?? []
  return (
    <CardShell
      title="Документы заказчика"
      icon={FileText}
      actions={<AttachButton onFiles={(files) => save({ details: { documents: [...documents, ...files] } }, "Документы добавлены")}>Прикрепить документ</AttachButton>}
    >
      <FileList files={documents} empty="Документы заказчика не добавлены" onRemove={(file) => save({ details: { documents: documents.filter((item) => item.id !== file.id) } })} />
    </CardShell>
  )
}
