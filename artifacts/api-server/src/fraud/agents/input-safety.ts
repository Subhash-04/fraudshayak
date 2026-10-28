// Best-effort redaction for typed/transcribed secrets. Not a substitute for
// warnings, consent, secure uploads, or a production DLP review.
export function redactSecrets(text: string): string {
  return text
    .replace(/\b(otp|one[- ]time password|pin|cvv|cvc|password|passcode)\b(\s*(?:is|was|:|=|-)?\s*)([a-z0-9!@#$%^&*_.-]{3,64})/gi,
      (_match, label: string, separator: string, value: string) =>
        /^(?:was|is|not|never|shared|requested|asked|number|code|should|with|from|and|are|the)$/i.test(value)
          ? `${label}${separator}${value}` : `${label}${separator}[REDACTED]`)
    .replace(/\b((?:credit|debit)?\s*card(?:\s+number)?\s*(?:is|:|=)?\s*)(\d[ -]?){13,19}\b/gi,
      (_match, label: string) => `${label}[REDACTED CARD NUMBER]`);
}

export function isValidIncidentDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    && value <= new Date().toISOString().slice(0, 10);
}
