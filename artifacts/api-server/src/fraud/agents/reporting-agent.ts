import type { CaseSnapshot } from "../types";
import { getMissingFields, guidance, collectionQuestions } from "../knowledge/requirements";

export function runReportingAgent(
  caseData: CaseSnapshot,
  complaintApproved: boolean,
) {
  const missing = getMissingFields(caseData);
  const noLoss = /^(no|none|no money lost)$/i.test(caseData.intakeDetails?.moneyLost ?? "");
  const portalGaps: string[] = [];
  if (!noLoss && /^(unknown|not available|not known)?$/i.test(caseData.transactionReference ?? caseData.intakeDetails?.transactionReference ?? "")) {
    portalGaps.push("Obtain the exact transaction reference/UTR for the official portal, if required.");
  }
  if (/^(unknown|provide on portal|not available)?$/i.test(caseData.intakeDetails?.address ?? "")) {
    portalGaps.push("Complete your address and PIN code directly on the official portal.");
  }
  if (!/^yes$/i.test(caseData.intakeDetails?.identityDocumentReady ?? "")) {
    portalGaps.push("Keep an accepted identity document ready for the official portal.");
  }
  const ready = missing.length === 0 && portalGaps.length === 0 && complaintApproved;
  return {
    ready,
    portalUrl: "https://www.cybercrime.gov.in/",
    helpline: "1930",
    checklist: [
      ...missing.map(field => `Still needed: ${collectionQuestions(caseData.category)[field.replace(/^intakeDetails\./, "")] ?? field}`),
      ...portalGaps,
      ...(!complaintApproved ? ["Review and explicitly approve the complaint draft."] : []),
      ...guidance.filingSteps,
      "Record an acknowledgement only after you receive it from the official portal.",
    ],
    status: ready ? "READY_FOR_OFFICIAL_FILING" : "INFORMATION_REQUIRED",
  };
}
