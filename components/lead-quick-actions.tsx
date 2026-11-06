"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Building2, ClipboardPlus, Copy, Link, MapPin, Pencil, Plus, UserPlus, Wallet, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

export type QuickActionType = "task" | "link" | "contact" | "duplicate" | "name" | "amount" | "customer" | "address"

type QuickAction = { type: QuickActionType; label: string; icon: LucideIcon }

const actionSections: QuickAction[][] = [
  [
    { type: "task", label: "Создать задачу", icon: ClipboardPlus },
    { type: "link", label: "Скопировать ссылку на лид", icon: Link },
    { type: "contact", label: "Добавить контакт", icon: UserPlus },
    { type: "duplicate", label: "Дублировать лид", icon: Copy },
  ],
  [
    { type: "name", label: "Изменить наименование объекта", icon: Pencil },
    { type: "amount", label: "Изменить сумму", icon: Wallet },
    { type: "customer", label: "Изменить заказчика", icon: Building2 },
    { type: "address", label: "Изменить адрес", icon: MapPin },
  ],
]

type LeadQuickActionsProps = {
  leadId: string
  onAction: (type: QuickActionType) => void
}

export function LeadQuickActions({ leadId, onAction }: LeadQuickActionsProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  const run = (type: QuickActionType) => {
    setOpen(false)
    window.setTimeout(() => onAction(type), isMobile ? 220 : 0)
  }

  const trigger = (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Быстрые действия"
      aria-haspopup="menu"
      aria-expanded={open}
      title="Быстрые действия"
      data-quick-actions-trigger={leadId}
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <Plus />
    </Button>
  )

  return (
    <div
      className="quick-actions"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onDragStart={(event) => event.stopPropagation()}
    >
      {isMobile ? (
        <>
          {trigger}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="bottom" className="quick-sheet" aria-describedby="quick-sheet-description">
              <SheetTitle className="sr-only">Быстрые действия</SheetTitle>
              <SheetDescription id="quick-sheet-description" className="sr-only">
                Выберите действие для выбранного лида
              </SheetDescription>
              <div className="quick-sheet-handle" aria-hidden />
              <div className="quick-sheet-list" role="menu">
                {actionSections.map((section, index) => (
                  <div className="quick-sheet-section" key={index}>
                    {section.map(({ type, label, icon: Icon }) => (
                      <button type="button" role="menuitem" className="quick-sheet-item" key={type} onClick={() => run(type)}>
                        <Icon aria-hidden />
                        {label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={8} collisionPadding={12} className="quick-menu">
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              {actionSections.map((section, index) => (
                <div key={index}>
                  {index > 0 && <DropdownMenuSeparator className="quick-menu-separator" />}
                  {section.map(({ type, label, icon: Icon }) => (
                    <DropdownMenuItem className="quick-menu-item" key={type} onSelect={() => run(type)}>
                      <Icon aria-hidden />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export async function copyLeadLink(leadId: string) {
  const url = `${window.location.origin}/?lead=${encodeURIComponent(leadId)}`
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    const field = document.createElement("textarea")
    field.value = url
    field.setAttribute("readonly", "")
    field.style.position = "fixed"
    field.style.opacity = "0"
    document.body.appendChild(field)
    field.select()
    const copied = document.execCommand("copy")
    field.remove()
    return copied
  }
}
