"use server"

import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { companies, type CompanyContactMethod } from "@/lib/db/schema"

export type SavedCompany = {
  id: number
  legalName: string
  contactMethods: CompanyContactMethod[]
  createdAt?: string
  createdBy?: string
  leadAmount?: number
  contractAmount?: number
  customerDebt?: number
}

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : ""

function normalizeCompanyMethods(input: unknown): CompanyContactMethod[] {
  if (!Array.isArray(input) || input.length > 30) throw new Error("Допустимо не более 30 общих контактов компании")
  return input.map((method, index) => {
    if (!method || typeof method !== "object") throw new Error("Некорректный контакт компании")
    const item = method as Partial<CompanyContactMethod>
    if (item.kind !== "phone" && item.kind !== "email") throw new Error("Допустимы только телефоны и email компании")
    const value = text(item.value, 500)
    if (!value) throw new Error("Укажите телефон или email")
    if (item.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Некорректный email")
    if (item.kind === "phone" && !/[\d+]/.test(value)) throw new Error("Некорректный телефон")
    return {
      id: text(item.id, 100) || `company-method-${index}`,
      kind: item.kind,
      label: text(item.label, 100),
      value,
    }
  })
}

function toSavedCompany(row: typeof companies.$inferSelect): SavedCompany {
  return {
    id: row.id,
    legalName: row.legalName,
    contactMethods: row.contactMethods,
    createdAt: row.createdAt?.toISOString(),
    createdBy: row.createdBy ?? undefined,
    leadAmount: row.leadAmount ?? undefined,
    contractAmount: row.contractAmount ?? undefined,
    customerDebt: row.customerDebt ?? undefined,
  }
}

export async function getCompanies(): Promise<SavedCompany[]> {
  const rows = await db.select().from(companies).orderBy(asc(companies.legalName))
  return rows.map(toSavedCompany)
}

export async function saveCompanyContactMethods(legalNameInput: string, methodsInput: unknown): Promise<SavedCompany> {
  const legalName = text(legalNameInput, 300)
  if (!legalName) throw new Error("Не указано название компании")
  const contactMethods = normalizeCompanyMethods(methodsInput)
  const [row] = await db.insert(companies).values({ legalName, contactMethods })
    .onConflictDoUpdate({ target: companies.legalName, set: { contactMethods } })
    .returning()
  return toSavedCompany(row)
}
