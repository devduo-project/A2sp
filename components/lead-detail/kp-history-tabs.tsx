"use client"

import { ArrowRight, ExternalLink, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AttachButton, openStoredFile } from "@/components/lead-detail/file-list"
import type { SaveLead } from "@/components/lead-detail/use-lead-save"
import { fileExtension, formatDateTime, formatFileSize, type HistoryEntry, type StoredFile } from "@/lib/lead-details"

export function KpVersionsTab({ versions, save }: { versions: StoredFile[]; save: SaveLead }) {
  const numbered = versions.map((file, index) => ({ file, number: index + 1 })).reverse()
  return (
    <section className="ld-card ld-tab-card" aria-labelledby="ld-kp-title">
      <header className="ld-card-head">
        <h3 id="ld-kp-title">Версии коммерческого предложения</h3>
        <AttachButton multiple={false} onFiles={(files) => save({ details: { kpVersions: [...versions, ...files] } }, "Новая версия КП добавлена")}>Загрузить версию КП</AttachButton>
      </header>
      {numbered.length === 0 ? (
        <div className="ld-empty-block"><Upload aria-hidden="true" /><p>Версии КП ещё не загружены. Каждая загрузка создаёт отдельную версию.</p></div>
      ) : (
        <div className="ld-table-scroll">
          <table className="ld-table">
            <thead><tr><th>Версия</th><th>Файл</th><th>Формат</th><th>Размер</th><th>Добавлена</th><th><span className="sr-only">Действия</span></th></tr></thead>
            <tbody>
              {numbered.map(({ file, number }, index) => (
                <tr key={file.id}>
                  <td>v{number}{index === 0 && <Badge className="ld-latest">Актуальная</Badge>}</td>
                  <td>{file.name}</td>
                  <td>{fileExtension(file.name)}</td>
                  <td>{formatFileSize(file.size)}</td>
                  <td suppressHydrationWarning>{formatDateTime(file.addedAt)}</td>
                  <td><Button type="button" variant="ghost" size="sm" onClick={() => openStoredFile(file)}><ExternalLink data-icon="inline-start" />Открыть</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function HistoryTab({ history }: { history: HistoryEntry[] }) {
  return (
    <section className="ld-card ld-tab-card" aria-labelledby="ld-history-title">
      <header className="ld-card-head"><h3 id="ld-history-title">История действий</h3></header>
      {history.length === 0 ? (
        <div className="ld-empty-block"><p>Изменений по этому лиду ещё не зафиксировано</p></div>
      ) : (
        <ol className="ld-history">
          {[...history].reverse().map((entry) => (
            <li key={entry.id}>
              <div className="ld-history-main">
                <strong>{entry.text}</strong>
                {entry.from !== undefined && entry.to !== undefined && (
                  <span className="ld-history-change"><s>{entry.from}</s><ArrowRight aria-hidden="true" /><b>{entry.to}</b></span>
                )}
              </div>
              <span className="ld-muted" suppressHydrationWarning>{entry.actor} · {formatDateTime(entry.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
