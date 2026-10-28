import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { fraudCasesTable } from "./fraud-cases";

export const fraudSessionsTable = pgTable("fraud_sessions", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => fraudCasesTable.id, { onDelete: "cascade" }),
  language: text("language").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fraudMessagesTable = pgTable("fraud_messages", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => fraudSessionsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
