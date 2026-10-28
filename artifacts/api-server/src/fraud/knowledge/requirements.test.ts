import test from "node:test";
import assert from "node:assert/strict";
import { guidance, getMissingFields, categoryGuide, caseFingerprint } from "./requirements";
import { isValidIncidentDate, redactSecrets } from "../agents/input-safety";
import { runReportingAgent } from "../agents/reporting-agent";
import type { CaseSnapshot } from "../types";

function completeCase(category: string): CaseSnapshot {
  return {
    id: "synthetic-evaluation", title: "Synthetic test only", status: "INTAKE", category,
    language: "en", complainantName: "Test Person", contactNumber: "9000000000",
    state: "Telangana", district: "Hyderabad", bank: "Test Bank",
    incidentDate: "2026-10-01", reportedAmount: 5000, transactionReference: "TEST-REF",
    incidentDescription: "Synthetic evaluation narrative. A caller impersonated a provider and instructed the test person to make a payment. The test person sent money and discovered that the promised service did not exist. No real person or transaction is involved.",
    transactions: [], missingFields: [],
    intakeDetails: {
      ...Object.fromEntries(Object.keys(guidance.commonQuestions).map(key => [key, "unknown"])),
      ...Object.fromEntries(Object.keys(categoryGuide(category).questions).map(key => [key, "unknown"])),
      moneyLost: "yes", address: "Synthetic address, 500001", identityDocumentReady: "yes",
      detailsConfirmed: "confirmed",
    },
  };
}

for (const category of guidance.categories) {
  test(`${category.name}: complete confirmation and category answers required`, () => {
    const data = completeCase(category.name);
    assert.deepEqual(getMissingFields(data), []);
    delete data.intakeDetails!.detailsConfirmed;
    assert.deepEqual(getMissingFields(data), ["intakeDetails.detailsConfirmed"]);
    const categoryKey = Object.keys(category.questions)[0];
    delete data.intakeDetails![categoryKey];
    assert.ok(getMissingFields(data).includes(`intakeDetails.${categoryKey}`));
  });
}

test("short narratives, missing contact and mismatched evidence block readiness", () => {
  const data = completeCase("UPI payment fraud");
  data.incidentDescription = "I lost money.";
  data.contactNumber = "";
  data.missingFields = ["evidenceAmountConfirmation"];
  const missing = getMissingFields(data);
  assert.ok(missing.includes("incidentDescription"));
  assert.ok(missing.includes("contactNumber"));
  assert.ok(missing.includes("evidenceAmountConfirmation"));
});

test("no-loss reports do not require invented loss amounts or transactions", () => {
  const data = completeCase("Phishing");
  data.intakeDetails!.moneyLost = "no";
  delete data.bank; delete data.reportedAmount; delete data.transactionReference;
  delete data.intakeDetails!.paymentMode; delete data.intakeDetails!.transactionDetails;
  delete data.intakeDetails!.affectedAccount;
  assert.deepEqual(getMissingFields(data), []);
});

test("changed facts invalidate the draft fingerprint; confirmation alone does not", () => {
  const data = completeCase("Investment scam");
  const hash = caseFingerprint(data);
  delete data.intakeDetails!.detailsConfirmed;
  assert.equal(caseFingerprint(data), hash);
  data.reportedAmount = 7000;
  assert.notEqual(caseFingerprint(data), hash);
});

test("portal readiness cannot ignore unavailable reference or identity document", () => {
  const data = completeCase("UPI payment fraud");
  assert.equal(runReportingAgent(data, true).ready, true);
  data.transactionReference = "unknown";
  assert.equal(runReportingAgent(data, true).ready, false);
  data.transactionReference = "TEST-REF";
  data.intakeDetails!.identityDocumentReady = "no";
  assert.equal(runReportingAgent(data, true).ready, false);
});

test("impossible and future incident dates are rejected", () => {
  assert.equal(isValidIncidentDate("2026-02-30"), false);
  assert.equal(isValidIncidentDate("2099-01-01"), false);
  assert.equal(isValidIncidentDate("2026-10-01"), true);
});

test("labeled authentication secrets are masked without masking a rupee amount", () => {
  const safe = redactSecrets("My OTP is 123456. PIN: 9876. CVV=123. Password is Secret123. I lost INR 5000.");
  for (const value of ["123456", "9876", "Secret123"]) assert.ok(!safe.includes(value));
  assert.ok(safe.includes("INR 5000"));
});
