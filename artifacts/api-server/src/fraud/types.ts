export type IncidentFacts = {
  complainantName?: string;
  contactNumber?: string;
  email?: string;
  state?: string;
  district?: string;
  incidentDescription?: string;
  incidentDate?: string;
  bank?: string;
  reportedAmount?: number;
  transactionReference?: string;
  language?: "en" | "te";
  intakeDetails?: Record<string, string>;
};

export type Transaction = {
  id: string;
  amount: number;
  source: string;
  reference: string | null;
  bank: string | null;
  date: string | null;
  authorized: boolean | null;
};

export type CaseSnapshot = IncidentFacts & {
  id: string;
  title: string;
  status: string;
  category?: string | null;
  transactions: Transaction[];
  missingFields: string[];
  language: "en" | "te";
};

export type AgentResult = {
  agent: string;
  trigger: string;
  status: "COMPLETED" | "FAILED";
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
};

export type IntakeResult = {
  facts: IncidentFacts;
  assistantText: string;
  urgent: boolean;
  language: "en" | "te";
};
