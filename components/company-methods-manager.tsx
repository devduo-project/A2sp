"use client"

import { useState } from "react"
import { Copy, Mail, Phone, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { CompanyContactMethod } from "@/lib/db/schema"

export function CompanyMethodsManager({
  methods,
  onSave,
  isDemo = false,
}: {
  methods: CompanyContactMethod[]
  onSave: (methods: CompanyContactMethod[]) => Promise<void>
  isDemo?: boolean
}) {
  const [editing, setEditing] = useState<CompanyContactMethod | null>(null)
  const [kind, setKind] = useState<CompanyContactMethod["kind"]>("phone")
  const [label, setLabel] = useState("")
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const startAdd = (nextKind: CompanyContactMethod["kind"]) => {
    setFormOpen(true)
    setEditing(null)
    setKind(nextKind)
    setLabel("")
    setValue("")
    setError("")
  }

  const startEdit = (method: CompanyContactMethod) => {
    setFormOpen(true)
    setEditing(method)
    setKind(method.kind)
    setLabel(method.label)
    setValue(method.value)
    setError("")
  }

  const cancelEdit = () => {
    setFormOpen(false)
    setEditing(null)
    setLabel("")
    setValue("")
    setError("")
  }

  const saveMethod = async () => {
    const nextValue = value.trim()
    if (!nextValue) {
      setError(kind === "phone" ? "Укажите телефон" : "Укажите email")
      return
    }
    if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextValue)) {
      setError("Проверьте формат email")
      return
    }
    setPending(true)
    setError("")
    const nextMethod: CompanyContactMethod = {
      id: editing?.id ?? crypto.randomUUID(),
      kind,
      label: label.trim(),
      value: nextValue,
    }
    const nextMethods = editing
      ? methods.map((method) => method.id === editing.id ? nextMethod : method)
      : [...methods, nextMethod]
    try {
      await onSave(nextMethods)
      cancelEdit()
      toast.success(isDemo ? "Демо-контакт обновлён только в интерфейсе" : editing ? "Общий контакт компании обновлён" : "Общий контакт компании добавлен")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить контакт")
    } finally {
      setPending(false)
    }
  }

  const copyMethod = async (method: CompanyContactMethod) => {
    try {
      await navigator.clipboard.writeText(method.value)
      toast.success("Контакт скопирован")
    } catch {
      setError("Не удалось скопировать контакт")
    }
  }

  const removeMethod = async (id: string) => {
    setPending(true)
    try {
      await onSave(methods.filter((method) => method.id !== id))
      if (editing?.id === id) cancelEdit()
      toast.success(isDemo ? "Демо-контакт удалён только в интерфейсе" : "Общий контакт компании удалён")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось удалить контакт")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="company-methods-manager" aria-labelledby="company-methods-title">
      <div className="company-methods-heading">
        <div><h3 id="company-methods-title">Общие реквизиты компании</h3><p>Телефоны и email организации — отдельно от контактов сотрудников.</p></div>
        <div className="company-method-add-actions">
          <Button type="button" size="sm" variant="outline" onClick={() => startAdd("phone")}><Plus data-icon="inline-start" /> Телефон</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => startAdd("email")}><Plus data-icon="inline-start" /> Email</Button>
        </div>
      </div>
      {methods.length ? <div className="company-method-list">{methods.map((method) => {
        const Icon = method.kind === "phone" ? Phone : Mail
        return <article className="company-method-item" key={method.id}>
          <Icon aria-hidden="true" />
          <div className="company-method-copy"><strong>{method.label || (method.kind === "phone" ? "Телефон" : "Email")}</strong><span>{method.value}</span></div>
          <Button type="button" size="icon" variant="ghost" aria-label={`Скопировать ${method.kind === "phone" ? "телефон" : "email"}`} onClick={() => copyMethod(method)}><Copy /></Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => startEdit(method)}>Изменить</Button>
          <Button type="button" size="icon" variant="ghost" disabled={pending} aria-label={`Удалить ${method.kind === "phone" ? "телефон" : "email"} ${method.value}`} onClick={() => removeMethod(method.id)}><Trash2 /></Button>
        </article>
      })}</div> : <p className="company-methods-empty">Общие телефоны и email пока не добавлены.</p>}
      {formOpen ? <div className="company-method-editor">
        <Field><FieldLabel htmlFor="company-method-label">Подпись <span className="company-method-optional">(необязательно)</span></FieldLabel><Input id="company-method-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder={kind === "phone" ? "Например, приёмная" : "Например, общий отдел"} /></Field>
        <Field><FieldLabel htmlFor="company-method-value">{kind === "phone" ? "Телефон компании" : "Email компании"}</FieldLabel><Input id="company-method-value" type={kind === "phone" ? "tel" : "email"} value={value} onChange={(event) => setValue(event.target.value)} placeholder={kind === "phone" ? "+7 900 000-00-00" : "office@example.ru"} /></Field>
        {error && <p className="registry-form-error" role="alert">{error}</p>}
        <div className="company-method-editor-actions"><Button type="button" size="sm" variant="outline" onClick={cancelEdit} disabled={pending}>Отмена</Button><Button type="button" size="sm" onClick={saveMethod} disabled={pending}>{pending ? "Сохранение…" : editing ? "Сохранить" : "Добавить"}</Button></div>
      </div> : null}
    </section>
  )
}
