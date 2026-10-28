import {
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export type FraudTransaction = {
  id: string;
  amount: number;
  source: string;
  reference: string | null;
  bank: string | null;
  date: string | null;
  authorized: boolean | null;
};

export type FraudAnalysis = {
  category: string;
  confidence: number;
  urgency: string;
  reportedTotal: number;
  evidenceSupportedTotal: number;
  unrecoveredTotal: number;
  transactionCount: number;
  timeline: string[];
  patterns: string[];
  conflicts: string[];
  missingFields: string[];
  recommendations: string[];
  provider: "deterministic" | "openai-compatible";
};

export type FraudComplaint = {
  caseId: string;
  version: number;
  title: string;
  narrative: string;
  transactionSchedule: FraudTransaction[];
  evidenceIndex: string[];
  checklist: string[];
  approved: boolean;
  updatedAt: string;
  sourceFingerprint?: string;
};

export const fraudCasesTable = pgTable("fraud_cases", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull().default("unassigned"),
  title: text("title").notNull(),
  status: text("status").notNull().default("INTAKE"),
  language: text("language").notNull().default("en"),
  category: text("category"),
  intakeDetails: jsonb("intake_details").$type<Record<string, string>>().notNull().default({}),
  complainantName: text("complainant_name"),
  contactNumber: text("contact_number"),
  email: text("email"),
  state: text("state"),
  district: text("district"),
  incidentDescription: text("incident_description"),
  incidentDate: text("incident_date"),
  bank: text("bank"),
  reportedAmount: numeric("reported_amount", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  transactionReference: text("transaction_reference"),
  transactions: jsonb("transactions")
    .$type<FraudTransaction[]>()
    .notNull()
    .default([]),
  missingFields: jsonb("missing_fields").$type<string[]>().notNull().default([]),
  analysis: jsonb("analysis").$type<FraudAnalysis | null>(),
  complaint: jsonb("complaint").$type<FraudComplaint | null>(),
  acknowledgement: text("acknowledgement"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FraudCase = typeof fraudCasesTable.$inferSelect;
