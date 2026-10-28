import { useState } from 'react';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useGetFraudGuidance, useUpdateFraudCase, type CaseDetail } from '@workspace/api-client-react';

export function CollectionChecklist({ detail, onSaved }: { detail: CaseDetail; onSaved: () => void }) {
  const guidance = useGetFraudGuidance();
  const update = useUpdateFraudCase();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const items = detail.collectionChecklist ?? [];
  const categories = Array.isArray(guidance.data?.categories)
    ? guidance.data.categories.filter((item): item is { name: string } => !!item && typeof item === 'object' && 'name' in item && typeof item.name === 'string')
    : [];
  const save = (data: { category?: string; intakeDetails?: Record<string, string> }) => {
    setError('');
    update.mutate({ caseId: detail.id, data }, {
      onSuccess: () => { setAnswers({}); onSaved(); },
      onError: cause => setError(cause instanceof Error ? cause.message : 'Could not save the answer.'),
    });
  };
  return <details className="collection-checklist" data-testid="category-collection-checklist">
    <summary>Category checklist · {items.filter(item => item.complete).length}/{items.length} answered · {detail.category || 'Awaiting classification'}</summary>
    <p>Suggested official category: {detail.portalCategory}. Confirm the current options on the official portal.</p>
    <label>Correct the case category
      <select value={detail.category ?? ''} disabled={update.isPending || !categories.length} onChange={event => save({ category: event.target.value })} data-testid="select-fraud-category">
        {!detail.category && <option value="">Choose a category</option>}
        {categories.map(item => <option key={item.name}>{item.name}</option>)}
      </select>
    </label>
    <p>These are app collection questions, not a claim that every item is government-mandatory. Mark genuinely unavailable investigative details as unknown. Never enter OTPs, PINs, passwords or full card numbers.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="collection-items">
      {items.map(item => <div className="collection-item" key={item.key}>
        <div>{item.complete ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}<strong>{item.question}</strong></div>
        <p>{item.key === 'detailsConfirmed' ? item.complete ? 'Explicitly confirmed' : 'Confirm in chat only after reviewing all details.' : item.answer || (item.complete ? 'Not applicable' : 'Not yet answered')}{item.unknown ? ' · Follow up on the official portal if required.' : ''}</p>
        {item.key !== 'detailsConfirmed' && Object.hasOwn(detail.intakeDetails ?? {}, item.key) && <div className="collection-edit">
          <input value={answers[item.key] ?? item.answer ?? ''} onChange={event => setAnswers(previous => ({ ...previous, [item.key]: event.target.value }))} maxLength={2500} aria-label={`Correct ${item.key}`} />
          <button className="button secondary small" disabled={update.isPending || !answers[item.key]?.trim()} onClick={() => save({ intakeDetails: { [item.key]: answers[item.key].trim() } })}>Save correction</button>
        </div>}
      </div>)}
    </div>
    {guidance.data && <button className="button secondary small" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(guidance.data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'financial-fraud-collection-guide.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }} data-testid="download-fraud-guidance">Download sourced reference file</button>}
    <a className="portal-link" href="https://www.cybercrime.gov.in/" target="_blank" rel="noreferrer">Official portal <ExternalLink size={12} /></a>
  </details>;
}
