"use client"

import { useRef, type ReactNode } from "react"
import { FileText, Paperclip, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ACTOR, fileExtension, formatDate, formatFileSize, type StoredFile } from "@/lib/lead-details"

// No file storage is connected to this project, so only the file record is
// persisted. The blob URLs below keep the file openable until the page reloads.
const sessionUrls = new Map<string, string>()

export function createStoredFiles(files: FileList | File[]): StoredFile[] {
  return Array.from(files).map((file) => {
    const id = crypto.randomUUID()
    sessionUrls.set(id, URL.createObjectURL(file))
    return { id, name: file.name, size: file.size, addedAt: new Date().toISOString(), addedBy: ACTOR }
  })
}

export function openStoredFile(file: StoredFile) {
  const url = sessionUrls.get(file.id)
  if (!url) {
    toast.info("Содержимое файла недоступно: файловое хранилище не подключено, сохранена только запись о файле.")
    return
  }
  window.open(url, "_blank", "noopener,noreferrer")
}

export function AttachButton({ children, onFiles, multiple = true, accept }: { children: ReactNode; onFiles: (files: StoredFile[]) => void; multiple?: boolean; accept?: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(createStoredFiles(event.target.files))
          event.target.value = ""
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
        <Paperclip data-icon="inline-start" />
        {children}
      </Button>
    </>
  )
}

export function FileList({ files, empty, onRemove }: { files: StoredFile[]; empty: string; onRemove?: (file: StoredFile) => void }) {
  if (!files.length) return <p className="ld-empty-text">{empty}</p>
  return (
    <ul className="ld-files">
      {files.map((file) => (
        <li key={file.id}>
          <FileText aria-hidden="true" />
          <button type="button" className="ld-file-name" onClick={() => openStoredFile(file)}>{file.name}</button>
          <Badge variant="secondary">{fileExtension(file.name)}</Badge>
          <span className="ld-file-meta">{formatFileSize(file.size)}</span>
          <span className="ld-file-meta" suppressHydrationWarning>{formatDate(file.addedAt)}</span>
          {onRemove && (
            <Button type="button" variant="ghost" size="icon" aria-label={`Удалить файл ${file.name}`} onClick={() => onRemove(file)}>
              <Trash2 />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
