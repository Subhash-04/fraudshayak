import type { FraudComplaint } from "@workspace/db";
import type { CaseSnapshot } from "../types";
import type { Classification } from "./classification-agent";
import { categoryGuide, collectionQuestions } from "../knowledge/requirements";

export function runComplaintAgent(
  caseData: CaseSnapshot,
  evidenceNames: string[],
  classification: Classification,
  version: number,
): FraudComplaint {
  const complainant = caseData.complainantName || "[Name to be added]";
  const date = caseData.incidentDate || "[Incident date to be added]";
  const amount =
    /^(no|none|no money lost)$/i.test(caseData.intakeDetails?.moneyLost ?? "")
      ? "INR 0 (no financial loss reported)"
      : caseData.reportedAmount && caseData.reportedAmount > 0
      ? `₹${caseData.reportedAmount.toLocaleString("en-IN")}`
      : "[Amount to be confirmed]";
  const narrative = [
    `I, ${complainant}, wish to report a suspected financial fraud incident dated ${date}.`,
    caseData.incidentDescription || "Incident details were not provided.",
    `The reported financial loss is ${amount}.`,
    `The incident is provisionally categorized as ${classification.category}. This classification is an assistance estimate and is not a finding of guilt.`,
    caseData.bank ? `Bank or payment provider reported: ${caseData.bank}.` : "",
    caseData.transactionReference
      ? `Transaction reference supplied: ${caseData.transactionReference}.`
      : "Transaction reference has not yet been provided.",
    `Complainant contact: ${caseData.contactNumber ?? "To be provided on the official portal"}. Location: ${caseData.district ?? "Unknown"}, ${caseData.state ?? "Unknown"}.`,
    `Suggested official reporting category: ${categoryGuide(caseData.category).portalMapping}`,
    ...Object.entries(caseData.intakeDetails ?? {}).filter(([key]) => key !== "detailsConfirmed").map(([key, answer]) =>
      `${collectionQuestions(caseData.category)[key] ?? key}\nComplainant's recorded answer: ${answer}`),
    "I request that the competent authority review the facts and supporting evidence listed below.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    caseId: caseData.id,
    version,
    title: `Financial cybercrime complaint — ${caseData.id.slice(0, 8).toUpperCase()}`,
    narrative,
    transactionSchedule: caseData.transactions,
    evidenceIndex: evidenceNames,
    checklist: [
      "Review names, dates, amount and transaction details before filing.",
      "Attach original transaction receipts, messages and relevant screenshots.",
      "Do not share OTPs, PINs, passwords, CVVs or full banking credentials.",
      "Submit through the official portal yourself; this app does not file complaints.",
    ],
    approved: false,
    updatedAt: new Date().toISOString(),
  };
}
