import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { Lead } from "@/components/lead-card"

export type LeadData = Omit<Lead, "id" | "stage">

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  stage: text("stage").notNull(),
  position: integer("position").notNull().default(0),
  data: jsonb("data").$type<LeadData>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
