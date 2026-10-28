import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { fraudCasesTable } from "./fraud-cases";

export const fraudEvidenceTable = pgTable("fraud_evidence", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => fraudCasesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  storagePath: text("storage_path").notNull(),
  extractionStatus: text("extraction_status").notNull(),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fraudAgentRunsTable = pgTable("fraud_agent_runs", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => fraudCasesTable.id, { onDelete: "cascade" }),
  agent: text("agent").notNull(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  inputSummary: text("input_summary").notNull(),
  outputSummary: text("output_summary").notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fraudAuditLogsTable = pgTable("fraud_audit_logs", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => fraudCasesTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
