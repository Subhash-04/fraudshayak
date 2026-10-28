import type { CaseSnapshot, IncidentFacts, IntakeResult } from "../types";

const bankNames = [
  "SBI",
  "State Bank of India",
  "HDFC",
  "ICICI",
  "Axis",
  "Kotak",
  "Punjab National Bank",
  "PNB",
  "Bank of Baroda",
  "Canara",
  "Union Bank",
  "IDFC",
  "IndusInd",
  "Yes Bank",
];

function getAmount(text: string): number | undefined {
  const match = text.match(
    /(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (!match?.[1]) return undefined;
  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function getDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const date = new Date();
  if (/\byesterday\b/.test(lower) || /\bనిన్న\b/.test(text)) {
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  if (/\btoday\b/.test(lower) || /\bఈ రోజు\b/.test(text)) {
    return date.toISOString().slice(0, 10);
  }
  const explicit = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicit?.[1]) return explicit[1];
  const indianDate = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (indianDate) {
    const day = Number(indianDate[1]);
    const month = Number(indianDate[2]);
    const year = Number(indianDate[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return undefined;
}

function extractFacts(text: string, current: CaseSnapshot): IncidentFacts {
  const facts: IncidentFacts = {};
  const lower = text.toLowerCase();
  const nameMatch = text.match(
    /(?:my name is|i am|i'm|నా పేరు)\s+([A-Za-z][A-Za-z .'-]{1,60})/i,
  );
  if (nameMatch?.[1]) facts.complainantName = nameMatch[1].trim();

  const phoneMatch = text.match(/(?:\+91[\s-]?)?[6-9]\d{9}\b/);
  if (phoneMatch?.[0]) facts.contactNumber = phoneMatch[0].trim();

  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  if (emailMatch?.[0]) facts.email = emailMatch[0];

  const bank = bankNames.find((candidate) =>
    lower.includes(candidate.toLowerCase()),
  );
  if (bank) facts.bank = bank;

  const amount = getAmount(text);
  if (amount !== undefined) facts.reportedAmount = amount;

  const refMatch = text.match(
    /(?:utr|transaction\s*(?:id|ref(?:erence)?|number)|reference(?:\s*(?:id|number))?)\s*(?:is|:|#|-)?\s*([A-Z0-9-]{6,32})/i,
  );
  if (refMatch?.[1]) facts.transactionReference = refMatch[1];

  const date = getDate(text);
  if (date) facts.incidentDate = date;

  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
  ];
  const stateMatch = states.find((candidate) =>
    new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text),
  );
  if (stateMatch) facts.state = stateMatch;
  const districtMatch = text.match(/\bfrom\s+([A-Z][A-Za-z .'-]{2,35})/);
  if (districtMatch?.[1] && !facts.state) facts.district = districtMatch[1].trim();

  const expectedField = current.missingFields[0];
  const plainAnswer = text.trim().replace(/[.!?]+$/, "");
  if (expectedField === "incidentDescription" && plainAnswer.length >= 6 && !/^(hi|hello|hey|skip|not sure)$/i.test(plainAnswer)) {
    facts.incidentDescription = current.incidentDescription
      ? `${current.incidentDescription}\n${plainAnswer}`
      : plainAnswer;
  }
  if (expectedField === "complainantName" && !facts.complainantName && /^[\p{L}][\p{L} .'-]{1,79}$/u.test(plainAnswer)) {
    facts.complainantName = plainAnswer;
  }
  if (
    (expectedField === "reportedAmount" || expectedField === "evidenceAmountConfirmation") &&
    facts.reportedAmount === undefined
  ) {
    const bareAmount = plainAnswer.match(/^(?:₹\s*)?([\d,]+(?:\.\d{1,2})?)$/);
    if (bareAmount?.[1]) {
      const amount = Number(bareAmount[1].replaceAll(",", ""));
      if (Number.isFinite(amount) && amount > 0) facts.reportedAmount = amount;
    }
  }
  if (expectedField === "bank" && !facts.bank) {
    const directBank = bankNames.find((candidate) => lower.includes(candidate.toLowerCase()));
    if (directBank) facts.bank = directBank;
  }

  if (
    /\b(scam|fraud|stole|taken|unauthori[sz]ed|cheated|lost|deducted|debit)\b/i.test(
      text,
    ) ||
    /మోసం|డబ్బు|పోయింది/.test(text)
  ) {
    if (!facts.incidentDescription) {
      facts.incidentDescription = current.incidentDescription
        ? `${current.incidentDescription}\n${text}`
        : text;
    }
  }

  if (/\b(1|english)\b/i.test(text)) facts.language = "en";
  if (/\b(2|telugu|తెలుగు)\b/i.test(text)) facts.language = "te";
  return facts;
}

function hasIncident(text: string): boolean {
  return /\b(scam|fraud|stole|taken|unauthori[sz]ed|cheated|lost|deducted|debit|otp|upi|bank|money|payment|transaction|₹|rs\.?)\b/i.test(
    text,
  ) || /మోసం|డబ్బు|బ్యాంకు|పేమెంట్|లావాదేవీ/.test(text);
}

export function runConversationAgent(
  text: string,
  current: CaseSnapshot,
): IntakeResult {
  const facts = extractFacts(text, current);
  const language = facts.language ?? current.language;
  const lower = text.toLowerCase();
  const urgent = hasIncident(text) && /₹|rs\.?|unauthori[sz]ed|stole|taken|lost|fraud|scam/i.test(text);

  if (/^(hi|hello|hey|namaste|నమస్తే)$/i.test(text.trim())) {
    return {
      facts,
      language,
      urgent: false,
      assistantText:
        language === "te"
          ? "నమస్తే. ఏ ఆర్థిక మోసం జరిగింది? మీకు తెలిసిన వివరాలను మీ మాటల్లో చెప్పండి."
          : "Hello. Please describe what happened in your own words. If money was taken without permission, contact your bank through its official channel and call 1930 now.",
    };
  }

  if (language === "te") {
    return {
      facts,
      language,
      urgent,
      assistantText: urgent
        ? "మీ బ్యాంక్ అధికారిక మోసాల హెల్ప్‌లైన్‌ను సంప్రదించండి, వెంటనే 1930కు కాల్ చేయండి. ఫిర్యాదుకు వివరాలు సిద్ధం చేయడంలో సహాయం చేస్తాను. ఏ బ్యాంక్ ఖాతా నుంచి డబ్బు తీసుకున్నారు?"
        : "ఫిర్యాదు వివరాలను క్రమబద్ధం చేయడంలో సహాయం చేస్తాను. మీ బ్యాంక్ పేరు లేదా లావాదేవీ రిఫరెన్స్ తెలిసి ఉంటే చెప్పండి.",
    };
  }

  if (!hasIncident(text)) {
    const nextMissing = current.missingFields[0];
    const prompts: Record<string, string> = {
      complainantName: "What name should I use for the complaint?",
      bank: "Which bank or payment provider was involved?",
      transactionReference:
        "Do you have the transaction reference number or a payment screenshot?",
      incidentDate: "When did the transaction or incident happen?",
      contactNumber:
        "What contact number would you like listed? Do not share any OTP, PIN, password, or CVV.",
      state: "Which state or union territory did this happen in?",
    };
    return {
      facts,
      language,
      urgent: false,
      assistantText:
        prompts[nextMissing ?? ""] ??
        "Please tell me what happened, including how the person contacted you and what money was affected.",
    };
  }

  return {
    facts,
    language,
    urgent,
    assistantText: urgent
      ? "If this was unauthorized, contact your bank through its official fraud channel and call 1930 immediately. I’ll help organize the complaint. Which bank account or payment provider was involved?"
      : "I’ll help organize the details without assuming facts that are not confirmed. Do you know the bank or payment provider involved?",
  };
}
