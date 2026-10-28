import type { CaseSnapshot } from "../types";
import type { Classification } from "./classification-agent";

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function rupees(paise: number): number {
  return paise / 100;
}

export function runFinancialAnalysisAgent(
  caseData: CaseSnapshot,
  classification: Classification,
  evidenceAmounts: number[],
  conflictMessages: string[],
) {
  const transactionAmounts = caseData.transactions.map((item) => toPaise(item.amount));
  const reportedPaise =
    transactionAmounts.length > 0
      ? transactionAmounts.reduce((sum, amount) => sum + amount, 0)
      : toPaise(caseData.reportedAmount ?? 0);
  const supportedPaise = evidenceAmounts.reduce(
    (sum, amount) => sum + toPaise(amount),
    0,
  );
  const uniqueEvidencePaise = Math.min(supportedPaise, reportedPaise);
  const knownReportedAmount = rupees(reportedPaise);
  const missingFields = [...caseData.missingFields];
  if (
    caseData.transactions.some((item) => !item.reference) &&
    !missingFields.includes("transactionReference")
  ) {
    missingFields.push("transactionReference");
  }
  const timeline = caseData.incidentDate
    ? [`${caseData.incidentDate} — incident date reported by the complainant.`]
    : [];
  return {
    category: classification.category,
    confidence: classification.confidence,
    urgency: classification.urgency,
    reportedTotal: knownReportedAmount,
    evidenceSupportedTotal: rupees(uniqueEvidencePaise),
    unrecoveredTotal: knownReportedAmount,
    transactionCount: caseData.transactions.length || (knownReportedAmount > 0 ? 1 : 0),
    timeline,
    patterns: [
      ...(caseData.transactions.length > 1
        ? ["Multiple reported transactions; compare individual references before filing."]
        : []),
      ...(classification.evidence.length
        ? [`Classification signals: ${classification.evidence.join(", ")}.`]
        : []),
    ],
    conflicts: conflictMessages,
    missingFields,
    recommendations: [
      "Contact your bank using a verified official channel.",
      "For urgent financial cyber fraud, call 1930 and report at https://www.cybercrime.gov.in/.",
      "Preserve original transaction messages and documents; do not alter evidence files.",
    ],
    provider: "deterministic" as const,
  };
}
