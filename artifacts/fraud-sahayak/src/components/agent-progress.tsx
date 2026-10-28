import { Activity, CheckCircle2, AlertCircle, LoaderCircle } from 'lucide-react';
import { useGetFraudAgentRuns, getGetFraudAgentRunsQueryKey } from '@workspace/api-client-react';

export function AgentProgress({ caseId, busy }: { caseId?: string; busy: boolean }) {
  const runs = useGetFraudAgentRuns(caseId ?? '', { query: {
    queryKey: getGetFraudAgentRunsQueryKey(caseId ?? ''),
    enabled: !!caseId,
    refetchInterval: busy ? 1500 : 20000,
  } });
  const latest = [...(runs.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);
  const running = latest.some(run => run.status === 'RUNNING');
  return <div className="agent-progress" aria-live="polite" data-testid="agent-progress">
    <div className="agent-progress-title"><Activity size={14} />
      <strong>{busy || running ? 'Agents working on your request' : 'OpenAI case agents'}</strong>
      <span>{busy || running ? 'Processing' : 'Ready'}</span>
    </div>
    {latest.length ? latest.map(run => <div className={`agent-progress-row ${run.status.toLowerCase()}`} key={run.id}>
      {run.status === 'RUNNING' ? <LoaderCircle size={13} className="voice-spinner" /> : run.status === 'FAILED' ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
      <span>{run.agent}<small>{run.outputSummary}</small></span>
      <small>{run.status === 'RUNNING' ? 'Running' : run.status === 'FAILED' ? 'Failed' : 'Done'}</small>
    </div>) : <small>{runs.isError ? 'Execution history is unavailable. Open Agent activity to retry.' : busy ? 'Starting intake and triage…' : 'Agents run when you send a message or request a review. They do not monitor in the background.'}</small>}
  </div>;
}
