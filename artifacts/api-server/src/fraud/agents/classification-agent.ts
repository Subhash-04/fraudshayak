export type Classification = {
  category: string;
  confidence: number;
  urgency: string;
  evidence: string[];
  uncertainty: string[];
};

const rules: Array<{ category: string; terms: string[] }> = [
  { category: "UPI payment fraud", terms: ["upi", "qr code", "gpay", "phonepe", "paytm"] },
  { category: "Remote access scam", terms: ["remote access", "screen sharing", "anydesk", "install an app", "app installed"] },
  { category: "OTP-related scam", terms: ["otp", "one-time password"] },
  { category: "Phishing", terms: ["phishing", "suspicious link", "fake website", "link"] },
  { category: "Bank impersonation", terms: ["bank officer", "from my bank", "bank representative", "impersonat"] },
  { category: "Investment scam", terms: ["investment", "trading platform", "crypto", "returns", "profit"] },
  { category: "Fake job scam", terms: ["job scam", "job offer", "recruiter", "registration fee"] },
  { category: "Debit or credit card fraud", terms: ["debit card", "credit card", "card transaction", "atm"] },
  { category: "Unauthorized bank transaction", terms: ["unauthorized", "without permission", "money was taken", "stole", "deducted"] },
  { category: "Mistaken transfer or payment dispute", terms: ["wrong upi", "wrong account", "sent by mistake", "mistaken transfer"] },
];

export function runClassificationAgent(text: string): Classification {
  const normalized = text.toLowerCase();
  const matched = rules
    .map((rule) => ({
      category: rule.category,
      evidence: rule.terms.filter((term) => normalized.includes(term)),
    }))
    .filter((item) => item.evidence.length > 0)
    .sort((a, b) => b.evidence.length - a.evidence.length);

  const primary = matched[0];
  const isMistake = primary?.category === "Mistaken transfer or payment dispute";
  const reportsLoss = /₹|rs\.?|rupees?|lost|taken|debit|deducted/i.test(text);
  const urgent = reportsLoss && !isMistake;
  return {
    category: primary?.category ?? "Other suspected financial fraud",
    confidence: primary ? Math.min(0.92, 0.58 + primary.evidence.length * 0.12) : 0.35,
    urgency: urgent ? "urgent" : "standard",
    evidence: primary?.evidence ?? [],
    uncertainty: primary
      ? ["Rule-based classification; confirm the mechanism with the complainant."]
      : ["No clear category signal found; ask a clarifying question."],
  };
}
