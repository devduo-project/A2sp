import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function CardShell({ title, icon: Icon, actions, className, children }: { title: string; icon: LucideIcon; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("ld-card", className)}>
      <header className="ld-card-head">
        <h3><Icon aria-hidden="true" />{title}</h3>
        {actions && <div className="ld-card-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ld-info-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
