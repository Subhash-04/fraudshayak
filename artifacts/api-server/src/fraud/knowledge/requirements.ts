import guidance from "./financial-fraud.json";
import type { CaseSnapshot } from "../types";
import { createHash } from "node:crypto";

export { guidance };

export function caseFingerprint(data: CaseSnapshot): string {
  const { detailsConfirmed: _, ...intakeDetails } = data.intakeDetails ?? {};
  return createHash("sha256").update(JSON.stringify({
    category: data.category, complainantName: data.complainantName, contactNumber: data.contactNumber,
    email: data.email, state: data.state, district: data.district, incidentDescription: data.incidentDescription,
    incidentDate: data.incidentDate, bank: data.bank, reportedAmount: data.reportedAmount,
    transactionReference: data.transactionReference, transactions: data.transactions,
    intakeDetails: Object.fromEntries(Object.entries(intakeDetails).sort(([a], [b]) => a.localeCompare(b))),
  })).digest("hex");
}

export function categoryGuide(category?: string | null) {
  return guidance.categories.find(item => item.name === category)
    ?? guidance.categories.find(item => item.name === "Other suspected financial fraud")!;
}

export const coreQuestions: Record<string, string> = {
  incidentDescription: "Please describe what happened in more detail: how it started, what was promised, what you did and when you discovered the suspected fraud. The portal checklist asks for a narrative of at least 200 characters.",
  incidentDate: "On what date did this happen? Please confirm the date in YYYY-MM-DD format.",
  reportedAmount: "What was the total amount actually lost in rupees? Do not include promised returns.",
  bank: "Which bank, wallet or payment provider was involved?",
  complainantName: "What full name should appear in the complaint draft?",
  contactNumber: "What contact mobile number should appear in the complaint? Do not share an OTP.",
  state: "Which state or union territory do you live in?",
  district: "Which district do you live in?",
  transactionReference: "What is the affected transaction reference or UTR? Use the exact reference; if unavailable, say unknown.",
  evidenceAmountConfirmation: "The document amount differs from your reported amount. Which amount is correct, and why?",
};

export function collectionQuestions(category?: string | null): Record<string, string> {
  const questions: Record<string, string> = { ...coreQuestions, ...guidance.commonQuestions };
  for (const [key, value] of Object.entries(categoryGuide(category).questions)) {
    if (typeof value === "string") questions[key] = value;
  }
  return questions;
}

export function getMissingFields(data: CaseSnapshot): string[] {
  const details = data.intakeDetails ?? {};
  const noLoss = /^(no|none|no money lost)$/i.test(details.moneyLost ?? "");
  const fields: Array<[string, unknown]> = [
    ["incidentDescription", (data.incidentDescription?.trim().length ?? 0) >= 200],
    ["incidentDate", data.incidentDate],
    ["complainantName", data.complainantName],
    ["contactNumber", data.contactNumber],
    ["state", data.state],
    ["district", data.district],
  ];
  if (!noLoss) fields.push(["reportedAmount", (data.reportedAmount ?? 0) > 0], ["bank", data.bank]);
  const missing = fields.filter(([, value]) => !value || (typeof value === "string" && !value.trim())).map(([key]) => key);
  const common = Object.keys(guidance.commonQuestions).filter(key => key !== "detailsConfirmed");
  const category = Object.keys(categoryGuide(data.category).questions);
  for (const key of [...common, ...category]) {
    if (noLoss && ["affectedAccount", "transactionDetails", "paymentMode"].includes(key)) continue;
    if (!details[key]?.trim()) missing.push(`intakeDetails.${key}`);
  }
  if (!noLoss && !data.transactionReference?.trim() && !details.transactionReference?.trim()) missing.push("transactionReference");
  if (data.missingFields.includes("evidenceAmountConfirmation")) missing.push("evidenceAmountConfirmation");
  if (!missing.length && details.detailsConfirmed !== "confirmed") missing.push("intakeDetails.detailsConfirmed");
  return [...new Set(missing)];
}

export function nextCollectionQuestion(data: CaseSnapshot): string | undefined {
  const key = getMissingFields(data)[0]?.replace(/^intakeDetails\./, "");
  return key ? collectionQuestions(data.category)[key] : undefined;
}

export function publicCollectionChecklist(data: CaseSnapshot) {
  const missing = new Set(getMissingFields(data));
  const questions = collectionQuestions(data.category);
  const keys = [...Object.keys(coreQuestions).filter(key => key !== "evidenceAmountConfirmation"),
    ...Object.keys(guidance.commonQuestions), ...Object.keys(categoryGuide(data.category).questions)];
  return keys.map(key => ({
    key,
    question: questions[key],
    answer: data.intakeDetails?.[key] ?? (data as unknown as Record<string, unknown>)[key]?.toString() ?? null,
    complete: key === "detailsConfirmed" ? data.intakeDetails?.detailsConfirmed === "confirmed" : !missing.has(key) && !missing.has(`intakeDetails.${key}`),
    unknown: /^(unknown|not available|not known|provide on portal|none available|not yet|no)$/i.test(data.intakeDetails?.[key] ?? ""),
  }));
}
