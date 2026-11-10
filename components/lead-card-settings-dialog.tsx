"use client"

import { useEffect, useState, type DragEvent } from "react"
import { Check, GripVertical, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { defaultLeadCardConfig, leadCardElements, type LeadCardConfig, type LeadCardElementId } from "@/lib/lead-card-config"
import { saveLeadCardConfig } from "@/app/actions/leads"
import { LeadCard, type Lead } from "@/components/lead-card"

const previewLead: Lead = { id: "preview", company: "ООО «Северный квартал»", contact: "", role: "", phone: "+7 921 555-19-40", city: "Санкт-Петербург", objectName: "ЖК «Северный квартал»", direction: "А2-СП", address: { city: "Санкт-Петербург", street: "ул. Лесная", building: "14" }, request: "Обследование", source: "", owner: "Муслим Саидгариев", value: "₽ 6 830 000", quoteStatus: "КП озвучено", next: "", days: 8, stage: "Новый лид" }

type Props = { open: boolean; initialConfig: LeadCardConfig; onClose: () => void; onSaved: (config: LeadCardConfig) => void }

export function LeadCardSettingsDialog({ open, initialConfig, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<LeadCardConfig>(initialConfig)
  const [dragged, setDragged] = useState<LeadCardElementId | null>(null)
  const [pending, setPending] = useState(false)
  useEffect(() => { if (open) setDraft({ order: [...initialConfig.order], hidden: [...initialConfig.hidden] }) }, [open, initialConfig])
  const toggle = (id: LeadCardElementId, checked: boolean) => setDraft((current) => ({ ...current, hidden: checked ? current.hidden.filter((item) => item !== id) : [...current.hidden, id] }))
  const move = (from: LeadCardElementId, to: LeadCardElementId) => setDraft((current) => { const order = [...current.order]; const source = order.indexOf(from); const target = order.indexOf(to); if (source < 0 || target < 0 || source === target) return current; order.splice(source, 1); order.splice(target, 0, from); return { ...current, order } })
  const drop = (event: DragEvent<HTMLDivElement>, target: LeadCardElementId) => { event.preventDefault(); if (dragged) move(dragged, target); setDragged(null) }
  const save = async () => { setPending(true); try { const saved = await saveLeadCardConfig(draft); onSaved(saved); toast.success("Настройки карточки сохранены"); onClose() } catch { toast.error("Не удалось сохранить настройки") } finally { setPending(false) } }
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="glass-dialog glass-dialog-wide lead-card-settings-dialog" aria-describedby="lead-card-settings-description"><header className="lead-card-settings-header"><div><h2>Настройка карточки лида</h2><p id="lead-card-settings-description">Выберите, какую информацию отображать на закрытых карточках лидов, и настройте её порядок.</p></div><button type="button" className="modal-close" aria-label="Закрыть" onClick={onClose}><X /></button></header><div className="lead-card-settings-grid"><section className="lead-card-settings-editor" aria-labelledby="lead-card-elements-title"><div className="lead-card-settings-section-title"><div><p className="section-label">Содержимое</p><h3 id="lead-card-elements-title">Элементы карточки</h3></div><span>{draft.order.filter((id) => !draft.hidden.includes(id)).length} включено</span></div><div className="lead-card-elements-list">{draft.order.map((id) => { const item = leadCardElements.find((element) => element.id === id)!; const checked = !draft.hidden.includes(id); return <div key={id} draggable onDragStart={() => setDragged(id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, id)} className={cn("lead-card-element-row", dragged === id && "is-dragging")}><GripVertical className="lead-card-drag-handle" aria-hidden="true" /><span className="lead-card-element-name">{item.label}</span><Switch checked={checked} onCheckedChange={(value) => toggle(id, value)} aria-label={`${checked ? "Скрыть" : "Показать"} ${item.label}`} /></div>})}</div><p className="lead-card-settings-hint">Перетащите строку, чтобы изменить порядок. Иконки телефона и контактов всегда остаются на своих местах.</p></section><section className="lead-card-settings-preview" aria-labelledby="lead-card-preview-title"><div className="lead-card-settings-section-title"><div><p className="section-label">В реальном интерфейсе</p><h3 id="lead-card-preview-title">Предпросмотр карточки</h3></div></div><div className="lead-card-preview-surface"><LeadCard lead={previewLead} cardConfig={draft} onClick={() => undefined} onQuickAction={() => undefined} /></div></section></div><footer className="lead-card-settings-footer"><Button type="button" variant="ghost" onClick={() => setDraft({ order: [...defaultLeadCardConfig.order], hidden: [] })}><RotateCcw data-icon="inline-start" /> Сбросить</Button><div><Button type="button" variant="outline" onClick={onClose}>Отмена</Button><Button type="button" disabled={pending} onClick={save}>{pending ? "Сохраняем…" : <><Check data-icon="inline-start" /> Сохранить</>}</Button></div></footer></DialogContent></Dialog>
}
