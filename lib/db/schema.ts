import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import type { Lead } from "@/components/lead-card"

export type LeadData = Omit<Lead, "id" | "stage">

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  stage: text("stage").notNull(),
  position: integer("position").notNull().default(0),
  data: jsonb("data").$type<LeadData>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const leadTasks = pgTable("lead_tasks", {
  id: serial("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  dueDate: text("due_date").notNull().default(""),
  owner: text("owner").notNull().default(""),
  priority: text("priority").notNull().default("Средний"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const leadContacts = pgTable("lead_contacts", {
  id: serial("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull().default(""),
  role: text("role").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
