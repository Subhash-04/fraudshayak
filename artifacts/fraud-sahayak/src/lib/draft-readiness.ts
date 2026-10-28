type DraftCase = {
  missingFields: string[];
  analysis?: unknown;
  complaint?: unknown;
  draftStale?: boolean;
};

export function canGenerateDraft(detail: DraftCase | undefined): boolean {
  return !!detail && detail.missingFields.length === 0 && !!detail.analysis;
}

export function isDraftReady(detail: DraftCase | undefined): boolean {
  return canGenerateDraft(detail) && !!detail?.complaint && !detail.draftStale;
}
