import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowRight, BadgeCheck, Banknote,
  Check, CheckCircle2, ChevronRight, Clock3, ExternalLink, FileCheck2,
  FileText, FolderOpen, HeartHandshake, Languages, LoaderCircle, LockKeyhole, LogOut,
  MessageCircle, Paperclip, Plus, RefreshCw, Send, Shield, Sparkles,
  UploadCloud, UserRound, X,
} from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, useRoute, Router as WouterRouter } from 'wouter';
import { shadcn } from '@clerk/themes';
import {
  useApproveFraudComplaint, useAnalyzeFraudCase, useCreateFraudCase,
  useCreateFraudSession, useExportFraudCaseJson, useExportFraudComplaintPdf,
  useGenerateFraudComplaint, useGetFraudAgentRuns, useGetFraudCase,
  useGetFraudComplaint, useGetFraudDashboard, useGetFraudSession,
  useListFraudCases, usePrepareFraudSubmission, useRecordFraudAcknowledgement,
  useSendFraudMessage, useEnsureFraudCaseSession, useUpdateFraudCase, useUpdateFraudComplaint,
  useUploadFraudEvidence, getGetFraudCaseQueryKey, getGetFraudComplaintQueryKey,
  getGetFraudSessionQueryKey, getGetFraudAgentRunsQueryKey,
  getGetFraudDashboardQueryKey, getListFraudCasesQueryKey,
} from '@workspace/api-client-react';
import type { AgentRun, CaseDetail, FraudCase, Message } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { VoiceInput } from '@/components/voice-input';
import { AgentProgress } from '@/components/agent-progress';
import { canGenerateDraft, isDraftReady } from '@/lib/draft-readiness';
import { CollectionChecklist } from '@/components/collection-checklist';

const queryClient = new QueryClient();
const SESSION_KEY = 'fraud-sahayak-session';
const portalUrl = 'https://www.cybercrime.gov.in/';
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not provided';
const dateOnly = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Date not recorded';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#2b6965',
    colorForeground: '#213836',
    colorMutedForeground: '#64837e',
    colorDanger: '#c64b43',
    colorBackground: '#fdfcf9',
    colorInput: '#fffdfa',
    colorInputForeground: '#213836',
    colorNeutral: '#ded8c8',
    fontFamily: 'DM Sans, Noto Sans Telugu, sans-serif',
    borderRadius: '12px',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: {
      width: 'min(100%, 480px)',
      overflow: 'hidden',
      borderRadius: '18px',
      backgroundColor: '#fdfcf9',
      boxShadow: '0 20px 60px rgba(28, 62, 57, .12)',
    },
    card: { border: 'none', boxShadow: 'none', backgroundColor: 'transparent' },
    footer: { border: 'none', backgroundColor: 'transparent' },
    headerTitle: { color: '#213836', fontFamily: 'Manrope, sans-serif', fontWeight: 800 },
    headerSubtitle: { color: '#64837e' },
    socialButtonsBlockButtonText: { color: '#213836' },
    formFieldLabel: { color: '#213836' },
    formFieldInput: {
      borderRadius: '10px',
      borderColor: '#ded8c8',
      backgroundColor: '#fffdfa',
      color: '#213836',
    },
    formButtonPrimary: {
      borderRadius: '10px',
      backgroundColor: '#2b6965',
      color: '#f8f6ef',
      fontFamily: 'DM Sans, sans-serif',
    },
    footerActionText: { color: '#64837e' },
    footerActionLink: { color: '#2b6965' },
    dividerText: { color: '#64837e' },
  },
};

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function StatusPill({ value }: { value?: string | null }) {
  const status = value || 'In progress';
  const type = /ready|approved|complete|filed/i.test(status) ? 'green' : /urgent|failed/i.test(status) ? 'red' : 'amber';
  return <span className={`pill ${type}`} data-testid="status-case">{status.replaceAll('_', ' ')}</span>;
}

function AppFrame({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const { signOut } = useClerk();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" data-testid="link-home">
          <span className="brand-mark">S</span>
          <span><span className="brand-title">Fraud Sahayak</span><span className="brand-caption">Your incident, in order</span></span>
        </Link>
        <div>
          <div className="nav-label">Workspace</div>
          <nav className="nav-list" aria-label="Main navigation">
            <Link href="/" className={`nav-link ${path === '/' ? 'active' : ''}`} data-testid="link-chat"><MessageCircle size={17} /> Case workspace</Link>
            <Link href="/activity" className={`nav-link ${path === '/activity' ? 'active' : ''}`} data-testid="link-activity"><Activity size={17} /> Agent activity</Link>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><strong>Support, not authority</strong><p>This service helps organize your account. It is not affiliated with any bank, police service, or government portal.</p></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><span>Fraud Sahayak</span><ChevronRight size={13} /><span>{path.startsWith('/case/') ? 'Complaint review' : path === '/activity' ? 'Agent activity' : 'Case workspace'}</span></div>
          <div className="topbar-right"><span>Private case workspace</span><span className="secure-pill"><LockKeyhole size={12} /> Secure session</span><button className="button secondary small" onClick={() => void signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={13} /> Sign out</button></div>
        </header>
        {children}
        <footer className="notice-footer">Fraud Sahayak is an independent assistance tool. It does not file complaints on your behalf or represent any authority. Information shown is based on details you provide.</footer>
      </main>
    </div>
  );
}

function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return <div className="card card-pad" aria-label="Loading">
    <div className="skeleton" style={{ height: 16, width: '38%', marginBottom: 20 }} />
    {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height: i === rows - 1 ? 42 : 54, marginBottom: 12 }} />)}
  </div>;
}

function ErrorNotice({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="alert error" role="alert"><strong>We couldn’t load this information.</strong><div>{errorText(error)}</div><button className="button secondary small" style={{ marginTop: 10 }} onClick={retry} data-testid="button-retry"><RefreshCw size={13} /> Try again</button></div>;
}

function UrgentSupport() {
  return <section className="card aside-card urgent-card">
    <span className="eyebrow">Act quickly</span>
    <h3 className="aside-title">Report a financial cyber fraud</h3>
    <div className="helpline" data-testid="text-helpline">1930</div>
    <p className="subhead" style={{ fontSize: 11, marginTop: 5 }}>Call the national cyber-fraud helpline as soon as possible. For immediate danger, contact local emergency services.</p>
    <a className="portal-link" href={portalUrl} target="_blank" rel="noreferrer" data-testid="link-official-portal">Visit cybercrime.gov.in <ExternalLink size={13} /></a>
    <p style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))', margin: '9px 0 0' }}>Official portal link. Fraud Sahayak is not affiliated with it.</p>
  </section>;
}

function Dashboard() {
  const queryClient = useQueryClient();
  const casesQuery = useListFraudCases({ query: { queryKey: getListFraudCasesQueryKey() } });
  const dashQuery = useGetFraudDashboard({ query: { queryKey: getGetFraudDashboardQueryKey() } });
  const createCase = useCreateFraudCase();
  const [, setLocation] = useLocation();
  const newCase = () => createCase.mutate({ data: { language: 'en', title: 'New fraud incident' } }, {
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: getListFraudCasesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetFraudDashboardQueryKey() });
      setLocation(`/case/${result.id}`);
    },
  });
  const summary = dashQuery.data;
  const cases = casesQuery.data ?? [];
  const statItems = [
    ['All cases', summary?.totalCases], ['Need your details', summary?.awaitingInformation],
    ['Analysed', summary?.analyzed], ['Complaint drafts', summary?.complaintsPrepared],
    ['Ready to prepare', summary?.readyForFiling], ['Reported filed', summary?.userReportedFiled],
    ['Verified filed', summary?.verifiedFiled], ['Agent issues', summary?.agentFailures],
  ] as const;
  return <div className="page">
    <div className="page-heading">
      <div><span className="eyebrow">A steadier next step</span><h1>Let’s put the facts<br />in one place.</h1><p className="subhead">Describe what happened. We’ll help you organize the timeline, evidence and complaint draft.</p></div>
      <button className="button" onClick={newCase} disabled={createCase.isPending} data-testid="button-new-case">{createCase.isPending ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />} Start a new case</button>
    </div>
    {createCase.isError && <div className="alert error" style={{ marginBottom: 14 }} data-testid="error-create-case">{errorText(createCase.error)}</div>}
    {dashQuery.isLoading ? <div className="stat-grid">{statItems.map(([label]) => <div className="card stat" key={label}><div className="skeleton" style={{ height: 11, width: '70%' }} /><div className="skeleton" style={{ height: 31, width: '35%', marginTop: 13 }} /></div>)}</div> :
      dashQuery.isError ? <ErrorNotice error={dashQuery.error} retry={() => void dashQuery.refetch()} /> :
      <div className="stat-grid">{statItems.map(([label, value]) => <div className="card stat" key={label} data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="stat-label">{label}</div><div className="stat-value">{value ?? 0}</div><div className="stat-foot">Across your workspace</div></div>)}</div>}
    <div className="dashboard-grid">
      <section className="card card-pad">
        <div className="section-head"><h2>Your cases</h2><span className="pill" data-testid="text-case-count">{cases.length} {cases.length === 1 ? 'case' : 'cases'}</span></div>
        {casesQuery.isLoading ? <LoadingBlock rows={3} /> : casesQuery.isError ? <ErrorNotice error={casesQuery.error} retry={() => void casesQuery.refetch()} /> :
          cases.length === 0 ? <div className="empty-state"><div className="empty-icon"><FolderOpen size={19} /></div><strong>No cases yet</strong><br />Start with a new case or tell us what happened in the conversation.</div> :
          <div className="case-list">{cases.map(item => <CaseRow key={item.id} item={item} />)}</div>}
      </section>
      <div className="stack">
        <UrgentSupport />
        <section className="card card-pad">
          <div className="section-head"><h2>How this helps</h2><HeartHandshake size={18} color="hsl(var(--primary))" /></div>
          <div className="line-item"><span className="line-label">1. Tell your story</span><span className="line-value">In your words</span></div>
          <div className="line-item"><span className="line-label">2. Organize evidence</span><span className="line-value">Keep a clear record</span></div>
          <div className="line-item"><span className="line-label">3. Review your draft</span><span className="line-value">Before you submit</span></div>
          <p className="subhead" style={{ fontSize: 10, margin: '12px 0 0' }}>You decide what to share and when. Nothing here confirms a complaint was officially filed.</p>
        </section>
      </div>
    </div>
  </div>;
}

function CaseRow({ item }: { item: FraudCase }) {
  return <Link href={`/case/${item.id}`} className="case-row" data-testid={`case-row-${item.id}`}>
    <div style={{ minWidth: 0 }}><div className="case-name" data-testid={`case-title-${item.id}`}>{item.title || 'Untitled incident'}</div><div className="case-meta">{dateOnly(item.updatedAt)} · {item.evidenceCount} evidence item{item.evidenceCount === 1 ? '' : 's'}</div></div>
    <div><div className="case-amount">{money(item.reportedAmount)}</div><div style={{ textAlign: 'right', marginTop: 6 }}><StatusPill value={item.status} /></div></div>
  </Link>;
}

function ChatPage() {
  const [voiceBusy, setVoiceBusy] = useState(false);
  const queryClient = useQueryClient();
  const [session, setSession] = useState<{ id: string; caseId: string; language: 'en' | 'te'; createdAt?: string } | null>(null);
  const [language, setLanguage] = useState<'en' | 'te'>('en');
  const [text, setText] = useState('');
  const [showIntro, setShowIntro] = useState(true);
  const [, setLocation] = useLocation();
  const createSession = useCreateFraudSession();
  const sendMessage = useSendFraudMessage();
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data?.id && data?.caseId) { setSession(data); setLanguage(data.language === 'te' ? 'te' : 'en'); }
      }
    } catch { sessionStorage.removeItem(SESSION_KEY); }
  }, []);
  const sessionQuery = useGetFraudSession(session?.id ?? '', { query: { enabled: !!session?.id, queryKey: getGetFraudSessionQueryKey(session?.id ?? '') } });
  const detail = sessionQuery.data;
  const messages = detail?.messages ?? [];
  const invalidate = (caseId?: string) => {
    void queryClient.invalidateQueries({ queryKey: getListFraudCasesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetFraudDashboardQueryKey() });
    if (caseId) void queryClient.invalidateQueries({ queryKey: getGetFraudCaseQueryKey(caseId) });
  };
  const submitText = (value = text) => {
    const clean = value.trim();
    if (!clean || createSession.isPending || sendMessage.isPending) return;
    setText('');
    setShowIntro(false);
    const dispatch = (sessionId: string, caseId: string) => sendMessage.mutate({ data: { sessionId, text: clean } }, {
      onSuccess: (result) => {
        void queryClient.invalidateQueries({ queryKey: getGetFraudSessionQueryKey(sessionId) });
        invalidate(result.case.id || caseId);
      },
      onError: () => setText(clean),
    });
    if (session) dispatch(session.id, session.caseId);
    else createSession.mutate({ data: { language } }, {
      onSuccess: (created) => {
        const saved = { id: created.id, caseId: created.caseId, language: created.language, createdAt: created.createdAt };
        setSession(saved);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved));
        void queryClient.invalidateQueries({ queryKey: getGetFraudSessionQueryKey(created.id) });
        dispatch(created.id, created.caseId);
      },
    });
  };
  const startFresh = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null); setText(''); setShowIntro(true);
    setLanguage('en');
  };
  const sendError = createSession.isError ? createSession.error : sendMessage.isError ? sendMessage.error : null;
  return <div className="page">
    <div className="page-heading">
      <div><span className="eyebrow">Case workspace</span><h1>Start with what<br />you remember.</h1><p className="subhead">A private, step-by-step space to record the incident. You can correct details at any time.</p></div>
      <button className="button secondary" onClick={() => session ? setLocation(`/case/${session.caseId}`) : startFresh()} data-testid="button-review-case"><FileText size={16} /> {session ? 'Review case' : 'New conversation'}</button>
    </div>
    {sessionQuery.isError && <ErrorNotice error={sessionQuery.error} retry={() => void sessionQuery.refetch()} />}
    <div className="chat-layout">
      <section className="card chat-panel">
        <div className="chat-head">
          <div><div className="chat-head-title">Incident conversation</div><small>{session ? `Case ${session.caseId.slice(0, 8)} · saved for this browser` : 'No details are saved until you send a message'}</small></div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="button secondary small" onClick={() => setLanguage(language === 'en' ? 'te' : 'en')} data-testid="button-language"><Languages size={14} /> {language === 'en' ? 'English' : 'తెలుగు'}</button>
            {session && <button className="button secondary small" onClick={startFresh} data-testid="button-new-conversation"><Plus size={14} /> New</button>}
          </div>
        </div>
        <div className="messages" role="log" aria-live="polite">
          {showIntro && messages.length === 0 && <div className="message" data-testid="message-welcome">
            {language === 'en' ? 'I’m here to help you put the details in order. What happened, and when did you first notice it? Share only what you feel comfortable sharing.' : 'వివరాలను క్రమంగా నమోదు చేయడంలో నేను సహాయం చేస్తాను. ఏమి జరిగింది, మీరు మొదట ఎప్పుడు గమనించారు? మీకు సౌకర్యంగా ఉన్న వివరాలనే పంచుకోండి.'}
            <div className="message-meta">Fraud Sahayak · assistance only</div>
          </div>}
          {sessionQuery.isLoading && session && <div className="skeleton" style={{ height: 66 }} />}
          {messages.map(message => <ChatBubble key={message.id} message={message} />)}
          {(createSession.isPending || sendMessage.isPending) && <div className="message" data-testid="status-assistant-thinking"><span className="skeleton" style={{ display: 'block', height: 12, width: '70%' }} /><span className="skeleton" style={{ display: 'block', height: 12, width: '45%', marginTop: 9 }} /></div>}
          {sendError && <div className="alert error" role="alert" data-testid="error-chat">{errorText(sendError)} Your text is still available to resend.</div>}
        </div>
        <AgentProgress caseId={session?.caseId} busy={createSession.isPending || sendMessage.isPending} />
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); if (!voiceBusy) submitText(); }}>
          <VoiceInput disabled={createSession.isPending || sendMessage.isPending} onBusyChange={setVoiceBusy} onTranscript={value => setText(previous => [previous.trim(), value].filter(Boolean).join(' ').slice(0, 10000))} />
          <textarea value={text} onChange={event => setText(event.target.value)} placeholder={language === 'en' ? 'Write a message…' : 'సందేశం రాయండి…'} maxLength={10000} aria-label="Your message" data-testid="input-chat-message" />
          <button type="submit" className="button" disabled={voiceBusy || !text.trim() || createSession.isPending || sendMessage.isPending} data-testid="button-send-message">{sendMessage.isPending || createSession.isPending ? <LoaderCircle size={16} /> : <Send size={16} />}<span className="hide-mobile">Send</span></button>
        </form>
      </section>
      <aside className="chat-aside">
        <UrgentSupport />
        {detail?.case && <section className="card aside-card">
          <div className="section-head"><h2>Case snapshot</h2><button className="button secondary small" onClick={() => setLocation(`/case/${detail.case.id}`)} data-testid="button-open-snapshot">Open <ArrowRight size={13} /></button></div>
          <div className="line-item"><span className="line-label">Status</span><StatusPill value={detail.case.status} /></div>
          <div className="line-item"><span className="line-label">Reported amount</span><span className="line-value">{money(detail.case.reportedAmount)}</span></div>
          <div className="line-item"><span className="line-label">Evidence</span><span className="line-value">{detail.case.evidenceCount} items</span></div>
        </section>}
        <section className="card aside-card">
          <div className="section-head"><h2>Helpful to include</h2><Sparkles size={16} color="hsl(var(--accent))" /></div>
          <p className="subhead" style={{ fontSize: 11 }}>Approximate date and time, amount, bank or payment app, transaction reference, and what you did after noticing.</p>
          <div className="alert info" style={{ marginTop: 13 }}>Never share your PIN, password, OTP, or full card details here.</div>
        </section>
      </aside>
    </div>
  </div>;
}

function ChatBubble({ message }: { message: Message }) {
  return <div className={`message ${message.role === 'user' ? 'user' : ''}`} data-testid={`message-${message.id}`}>
    {message.text}<div className="message-meta">{message.role === 'user' ? 'You' : 'Sahayak'} · {dateTime(message.createdAt)}</div>
  </div>;
}

const caseFields = [
  { key: 'complainantName', label: 'Your name', placeholder: 'Name as you want it on the draft' },
  { key: 'contactNumber', label: 'Contact number', placeholder: 'Phone number' },
  { key: 'email', label: 'Email', placeholder: 'Email address' },
  { key: 'state', label: 'State', placeholder: 'State' },
  { key: 'district', label: 'District', placeholder: 'District' },
  { key: 'incidentDate', label: 'Incident date', placeholder: 'YYYY-MM-DD' },
  { key: 'bank', label: 'Bank or payment provider', placeholder: 'Provider name' },
  { key: 'transactionReference', label: 'Transaction reference', placeholder: 'Reference or UTR' },
  { key: 'reportedAmount', label: 'Reported loss (INR)', placeholder: '0', type: 'number' },
] as const;

function CasePage({ id }: { id: string }) {
  const [voiceBusy, setVoiceBusy] = useState(false);
  const client = useQueryClient();
  const detailQuery = useGetFraudCase(id, { query: { queryKey: getGetFraudCaseQueryKey(id) } });
  const ensureSession = useEnsureFraudCaseSession();
  const sendMessage = useSendFraudMessage();
  const uploadEvidence = useUploadFraudEvidence();
  const analyze = useAnalyzeFraudCase();
  const generateComplaint = useGenerateFraudComplaint();
  const [sessionId, setSessionId] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [view, setView] = useState<'chat' | 'details'>('chat');
  const [error, setError] = useState('');
  const ensuredFor = useRef('');
  const analyzedFor = useRef('');
  const generatedFor = useRef('');
  const detail = detailQuery.data;

  const invalidateCase = () => {
    void client.invalidateQueries({ queryKey: getGetFraudCaseQueryKey(id) });
    void client.invalidateQueries({ queryKey: getGetFraudComplaintQueryKey(id) });
    void client.invalidateQueries({ queryKey: getGetFraudAgentRunsQueryKey(id) });
    void client.invalidateQueries({ queryKey: getListFraudCasesQueryKey() });
    void client.invalidateQueries({ queryKey: getGetFraudDashboardQueryKey() });
  };

  useEffect(() => {
    if (ensuredFor.current === id) return;
    ensuredFor.current = id;
    ensureSession.mutate({ caseId: id }, {
      onSuccess: session => {
        setSessionId(session.id);
        void client.invalidateQueries({ queryKey: getGetFraudCaseQueryKey(id) });
      },
      onError: cause => { ensuredFor.current = ''; setError(errorText(cause)); },
    });
  }, [id]);

  useEffect(() => {
    if (!detail || detail.missingFields.length > 0 || detail.analysis || analyzedFor.current === id) return;
    analyzedFor.current = id;
    analyze.mutate({ caseId: id }, {
      onSuccess: () => invalidateCase(),
      onError: cause => { analyzedFor.current = ''; setError(errorText(cause)); },
    });
  }, [detail, id]);

  useEffect(() => {
    if (!canGenerateDraft(detail) || detail?.complaint || generatedFor.current === id) return;
    generatedFor.current = id;
    generateComplaint.mutate({ caseId: id }, {
      onSuccess: () => invalidateCase(),
      onError: cause => { generatedFor.current = ''; setError(errorText(cause)); },
    });
  }, [detail, id]);

  if (detailQuery.isLoading) return <div className="page"><LoadingBlock rows={6} /></div>;
  if (detailQuery.isError || !detail) return <div className="page"><div className="page-heading"><div><span className="eyebrow">Case workspace</span><h1>We can’t open this case.</h1></div></div><ErrorNotice error={detailQuery.error || new Error('Case not found')} retry={() => void detailQuery.refetch()} /></div>;

  const nextMissing = detail.missingFields[0];
  const questionFor = (value?: string) => {
    if (!value) return 'What would you like to add or correct?';
    const sourcedQuestion = detail.collectionChecklist?.find(item => item.key === value.replace(/^intakeDetails\./, ''))?.question;
    if (sourcedQuestion) return sourcedQuestion;
    const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
    const field = caseFields.find(item =>
      normalized.includes(item.key.toLowerCase()) ||
      normalized.includes(item.label.toLowerCase().replace(/[^a-z]/g, '')),
    );
    const label = field?.label || value.replaceAll('_', ' ').toLowerCase();
    const questions: Record<string, string> = {
      complainantName: 'What name would you like on the complaint draft?',
      contactNumber: 'What contact number should be included?',
      email: 'What email address should be included? You can say “skip” if you prefer.',
      state: 'Which state did this happen in?',
      district: 'Which district did this happen in?',
      incidentDate: 'On what date did this happen? An approximate date is fine.',
      bank: 'Which bank or payment provider was involved?',
      transactionReference: 'Do you have a transaction reference or UTR?',
      reportedAmount: 'What amount was lost, in rupees? An estimate is fine.',
      incidentDescription: 'Please describe what happened in your own words.',
    };
    return field ? questions[field.key] : `Could you share ${label}?`;
  };
  const question = questionFor(nextMissing);
  const messages = [...detail.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const timeline = [
    ...messages.map(message => ({ kind: 'message' as const, id: message.id, createdAt: message.createdAt, message })),
    ...detail.evidence.map(evidence => ({ kind: 'evidence' as const, id: evidence.id, createdAt: evidence.createdAt, evidence })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const uploading = uploadEvidence.isPending;
  const sending = sendMessage.isPending;

  const submitMessage = () => {
    const outgoing = text.trim();
    if (!outgoing || !sessionId || sending || voiceBusy) return;
    setError('');
    sendMessage.mutate({ data: { sessionId, text: outgoing } }, {
      onSuccess: result => {
        setText('');
        client.setQueryData(getGetFraudCaseQueryKey(id), result.case);
        invalidateCase();
      },
      onError: cause => setError(errorText(cause)),
    });
  };
  const uploadSelected = () => {
    if (!file) return;
    setError('');
    uploadEvidence.mutate({ caseId: id, data: { file } }, {
      onSuccess: () => {
        setFile(null);
        invalidateCase();
        analyze.mutate({ caseId: id }, {
          onSuccess: invalidateCase,
          onError: cause => setError(`The file was added, but its case review could not finish: ${errorText(cause)}`),
        });
      },
      onError: cause => setError(errorText(cause)),
    });
  };

  return <div className="page case-chat-page">
    <div className="case-chat-top">
      <div><span className="eyebrow">Private case workspace · {id.slice(0, 8)}</span><h1 data-testid="text-case-title">{detail.title || 'Your incident'}</h1></div>
      <div className="case-view-tabs" role="tablist" aria-label="Case views">
        <button className={`case-view-tab ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')} role="tab" aria-selected={view === 'chat'} data-testid="tab-case-chat"><MessageCircle size={15} /> Conversation</button>
        <button className={`case-view-tab ${view === 'details' ? 'active' : ''}`} onClick={() => setView('details')} role="tab" aria-selected={view === 'details'} data-testid="tab-case-details"><FileCheck2 size={15} /> Review & details</button>
      </div>
    </div>
    {error && <div className="alert error case-chat-error" role="alert" data-testid="error-case-chat">{error}</div>}
    {view === 'details' ? <div className="case-details-embedded"><CaseDetails id={id} /></div> : <section className="card chat-panel case-chat-window" aria-label="Case conversation">
      <header className="chat-head case-chat-header">
        <div className="case-assistant-mark">FS</div>
        <div className="case-chat-heading"><div className="chat-head-title">Fraud Sahayak</div><small>Here to help you put the details in order</small></div>
        <div className="case-private-note"><LockKeyhole size={13} /> Private to your case</div>
      </header>
      <div className="case-chat-trust"><Shield size={14} /><span>Your answers help prepare a draft for your review. Nothing is submitted from this chat.</span></div>
      <CollectionChecklist detail={detail} onSaved={invalidateCase} />
      <div className="messages case-message-list" role="log" aria-live="polite" data-testid="list-case-messages">
        <div className="case-day-divider"><span>CASE CONVERSATION</span></div>
        {timeline.length === 0 ? <div className="message case-welcome" data-testid="message-case-welcome">
          Hello. I can help record what happened and organize the information for a complaint draft. Share only what you are comfortable adding.
          <div className="message-meta">Fraud Sahayak · Private workspace</div>
        </div> : timeline.map(item => item.kind === 'message'
          ? <ChatBubble key={item.id} message={item.message} />
          : <div className="message evidence-message" key={item.id} data-testid={`chat-evidence-${item.id}`}>
            <div className="evidence-chat-file"><FileText size={18} /><span><strong>{item.evidence.name}</strong><small>{item.evidence.mimeType} · {formatSize(item.evidence.size)}</small></span></div>
            <div className="evidence-extraction"><strong>Text extraction: {item.evidence.extractionStatus}</strong>{item.evidence.extractedText ? <p>{item.evidence.extractedText}</p> : <p>No extracted text is available for this file.</p>}</div>
            <div className="message-meta">Added to case · {dateTime(item.evidence.createdAt)}</div>
          </div>)}
        {nextMissing ? <div className="message case-prompt" data-testid="text-next-question">{question}<div className="message-meta">Details are still needed before your draft can be prepared.</div></div> :
          isDraftReady(detail) || analyze.isPending || generateComplaint.isPending ? <div className="message case-prompt" data-testid="status-case-preparing">{generateComplaint.isPending ? 'Your complaint draft is being prepared for review.' : isDraftReady(detail) ? 'Your draft is ready. You can read and edit it in Review & details.' : 'The required details are in place. I’m checking them before preparing your draft.'}<div className="message-meta">Fraud Sahayak</div></div> : null}
        {(sending || analyze.isPending || generateComplaint.isPending) && <div className="message case-typing" aria-label="Fraud Sahayak is working"><span></span><span></span><span></span></div>}
      </div>
      <div className="case-composer-wrap">
        <AgentProgress caseId={id} busy={sending || analyze.isPending || generateComplaint.isPending} />
        {file && <div className="attachment-preview" data-testid="preview-chat-attachment">
          <div className="attachment-file-icon"><FileText size={17} /></div>
          <div className="attachment-preview-copy"><strong>{file.name}</strong><span>{formatSize(file.size)} · ready to add to this case</span></div>
          <button className="attachment-remove" onClick={() => setFile(null)} aria-label="Remove attachment" data-testid="button-remove-attachment"><X size={16} /></button>
          <button className="button secondary small attachment-upload" onClick={uploadSelected} disabled={uploading} data-testid="button-upload-chat-evidence">{uploading ? <LoaderCircle size={14} /> : <UploadCloud size={14} />}{uploading ? 'Adding…' : 'Add to case'}</button>
        </div>}
        <div className="chat-composer case-composer">
          <label className="composer-attach" aria-label="Attach an image or PDF" data-testid="control-chat-attachment">
            <Paperclip size={19} />
            <input type="file" accept="image/png,image/jpeg,application/pdf" hidden disabled={uploading} onChange={event => { setFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} data-testid="input-chat-attachment" />
          </label>
          <VoiceInput disabled={!sessionId || sending} onBusyChange={setVoiceBusy} onTranscript={value => setText(previous => [previous.trim(), value].filter(Boolean).join(' ').slice(0, 10000))} />
          <textarea value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage(); } }} placeholder={sessionId ? 'Type or record a message…' : 'Opening your private conversation…'} disabled={!sessionId || sending} maxLength={10000} aria-label="Write a message" data-testid="input-chat-message" />
          <button className="button case-send-button" onClick={submitMessage} disabled={voiceBusy || !text.trim() || !sessionId || sending} aria-label="Send message" data-testid="button-send-message">{sending ? <LoaderCircle size={17} /> : <Send size={17} />}</button>
        </div>
        <div className="composer-caption">Tap the microphone, speak, then stop. Review the transcript before sending. Audio is processed by OpenAI and is not saved with your case. Never share OTPs or PINs.</div>
      </div>
    </section>}
  </div>;
}

function CaseDetails({ id }: { id: string }) {
  const client = useQueryClient();
  const detailQuery = useGetFraudCase(id, { query: { queryKey: getGetFraudCaseQueryKey(id) } });
  const complaintQuery = useGetFraudComplaint(id, { query: { queryKey: getGetFraudComplaintQueryKey(id) } });
  const runsQuery = useGetFraudAgentRuns(id, { query: { queryKey: getGetFraudAgentRunsQueryKey(id) } });
  const updateCase = useUpdateFraudCase();
  const analyze = useAnalyzeFraudCase();
  const generateComplaint = useGenerateFraudComplaint();
  const updateComplaint = useUpdateFraudComplaint();
  const approveComplaint = useApproveFraudComplaint();
  const uploadEvidence = useUploadFraudEvidence();
  const prepare = usePrepareFraudSubmission();
  const recordAcknowledgement = useRecordFraudAcknowledgement();
  const exportJson = useExportFraudCaseJson(id, { query: { enabled: false, queryKey: ['export-case-json', id] } });
  const exportPdf = useExportFraudComplaintPdf(id, { query: { enabled: false, queryKey: ['export-complaint-pdf', id] } });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [complaintTitle, setComplaintTitle] = useState('');
  const [narrative, setNarrative] = useState('');
  const [reference, setReference] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [operationError, setOperationError] = useState('');
  const detail = detailQuery.data;
  const complaint = complaintQuery.data ?? detail?.complaint;
  const pending = analyze.isPending || generateComplaint.isPending || updateCase.isPending || updateComplaint.isPending || approveComplaint.isPending || uploadEvidence.isPending || prepare.isPending || recordAcknowledgement.isPending;

  useEffect(() => {
    if (detail) {
      const next: Record<string, string> = {};
      for (const item of caseFields) {
        const value = detail[item.key as keyof CaseDetail];
        next[item.key] = value == null ? '' : String(value);
      }
      setFields(next);
    }
  }, [detail]);
  useEffect(() => {
    if (complaint) { setComplaintTitle(complaint.title); setNarrative(complaint.narrative); }
  }, [complaint?.caseId, complaint?.updatedAt]);

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetFraudCaseQueryKey(id) });
    void client.invalidateQueries({ queryKey: getGetFraudComplaintQueryKey(id) });
    void client.invalidateQueries({ queryKey: getGetFraudAgentRunsQueryKey(id) });
    void client.invalidateQueries({ queryKey: getListFraudCasesQueryKey() });
    void client.invalidateQueries({ queryKey: getGetFraudDashboardQueryKey() });
  };
  const act = (operation: () => void) => { setOperationError(''); operation(); };
  const saveFacts = () => {
    const payload: Record<string, string | number | null> = {};
    for (const item of caseFields) {
      const value = fields[item.key] ?? '';
      payload[item.key] = item.key === 'reportedAmount' ? (value === '' ? null : Number(value)) : (value.trim() || null);
    }
    updateCase.mutate({ caseId: id, data: payload }, { onSuccess: invalidate, onError: error => setOperationError(errorText(error)) });
  };
  const upload = (file?: File) => {
    if (!file) return;
    setUploadMessage('');
    setOperationError('');
    uploadEvidence.mutate({ caseId: id, data: { file } }, {
      onSuccess: evidence => { setUploadMessage(`${evidence.name} uploaded and added to this case.`); invalidate(); },
      onError: error => setOperationError(errorText(error)),
    });
  };
  const downloadJson = async () => {
    setOperationError('');
    try {
      const result = await exportJson.refetch();
      if (!result.data) throw result.error || new Error('The case export was empty.');
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `fraud-sahayak-case-${id}.json`);
    } catch (error) { setOperationError(errorText(error)); }
  };
  const downloadPdf = async () => {
    setOperationError('');
    try {
      const result = await exportPdf.refetch();
      if (!result.data) throw result.error || new Error('The complaint export was empty.');
      downloadBlob(result.data, `fraud-sahayak-complaint-${id}.pdf`);
    } catch (error) { setOperationError(errorText(error)); }
  };

  if (detailQuery.isLoading) return <div className="page"><LoadingBlock rows={6} /></div>;
  if (detailQuery.isError || !detail) return <div className="page"><div className="page-heading"><div><span className="eyebrow">Case record</span><h1>We can’t open this case.</h1></div></div><ErrorNotice error={detailQuery.error || new Error('Case not found')} retry={() => void detailQuery.refetch()} /></div>;

  return <div className="page">
    <div className="page-heading">
      <div><span className="eyebrow">Complaint review · Case {detail.id.slice(0, 8)}</span><h1>{detail.title || 'Your incident'}</h1><p className="subhead">Check every detail carefully. This draft is not an official report or confirmation of filing.</p></div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}><StatusPill value={detail.status} /><button className="button secondary" onClick={downloadJson} disabled={exportJson.isFetching} data-testid="button-export-json">{exportJson.isFetching ? <LoaderCircle size={15} /> : <ArrowDownToLine size={15} />} Export case JSON</button></div>
    </div>
    {operationError && <div className="alert error" role="alert" style={{ marginBottom: 15 }} data-testid="error-case-action">{operationError}</div>}
    <div className="detail-columns">
      <div className="stack">
        <section className="card card-pad">
          <div className="section-head"><div><span className="eyebrow">01 / Facts</span><h2>Review and correct details</h2></div><UserRound size={17} color="hsl(var(--primary))" /></div>
          <div className="field-grid">
            {caseFields.map(field => <div className="field" key={field.key}><label htmlFor={`field-${field.key}`}>{field.label}</label><input id={`field-${field.key}`} type={'type' in field ? field.type : 'text'} min={'type' in field && field.type === 'number' ? 0 : undefined} value={fields[field.key] ?? ''} placeholder={field.placeholder} onChange={event => setFields(current => ({ ...current, [field.key]: event.target.value }))} data-testid={`input-${field.key}`} /></div>)}
            <div className="field full"><label htmlFor="field-description">What happened?</label><textarea id="field-description" value={fields.incidentDescription ?? ''} placeholder="Describe the incident in your own words." onChange={event => setFields(current => ({ ...current, incidentDescription: event.target.value }))} data-testid="input-incident-description" /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button className="button" onClick={saveFacts} disabled={updateCase.isPending} data-testid="button-save-facts">{updateCase.isPending ? <LoaderCircle size={15} /> : <Check size={15} />} Save details</button></div>
        </section>
        <section className="card card-pad">
          <div className="section-head"><div><span className="eyebrow">02 / Evidence</span><h2>Keep relevant records together</h2></div><Paperclip size={17} color="hsl(var(--primary))" /></div>
          <p className="subhead" style={{ fontSize: 11, marginBottom: 14 }}>Upload screenshots, statements, messages, or transaction records. Files are sent to the case service.</p>
          <label className="button secondary" style={{ display: 'inline-flex', cursor: uploadEvidence.isPending ? 'wait' : 'pointer' }} data-testid="control-upload-evidence">
            {uploadEvidence.isPending ? <LoaderCircle size={15} /> : <UploadCloud size={15} />} {uploadEvidence.isPending ? 'Uploading…' : 'Choose evidence file'}
            <input type="file" hidden disabled={uploadEvidence.isPending} onChange={event => { upload(event.target.files?.[0]); event.currentTarget.value = ''; }} data-testid="input-evidence-file" />
          </label>
          {uploadMessage && <div className="alert info" style={{ marginTop: 12 }} data-testid="status-evidence-upload">{uploadMessage}</div>}
          {uploadEvidence.isError && <div className="alert error" style={{ marginTop: 12 }} data-testid="error-evidence-upload">{errorText(uploadEvidence.error)}</div>}
          {detail.evidence.length === 0 ? <div className="empty-state" style={{ paddingBottom: 5 }}><div className="empty-icon"><FolderOpen size={18} /></div>No evidence has been added yet.</div> :
            detail.evidence.map(evidence => <div className="line-item" key={evidence.id} data-testid={`evidence-item-${evidence.id}`}><span><strong>{evidence.name}</strong><br /><span className="case-meta">{evidence.mimeType} · {formatSize(evidence.size)} · {evidence.extractionStatus}</span></span><span className="case-meta">{dateOnly(evidence.createdAt)}</span></div>)}
        </section>
        <section className="card card-pad">
          <div className="section-head"><div><span className="eyebrow">03 / Complaint draft</span><h2>Read it as if it were yours</h2></div><FileCheck2 size={17} color="hsl(var(--primary))" /></div>
          <CollectionChecklist detail={detail} onSaved={invalidate} />
          {(detail.missingFields.length > 0 || detail.draftStale) && <div className="alert info" data-testid="draft-incomplete-warning">Your case has missing or changed details. Review the category checklist and confirm your answers in chat. Any earlier draft is preserved but is not ready for filing.</div>}
          {detail.draftStale && <button className="button secondary" disabled={!canGenerateDraft(detail) || generateComplaint.isPending} onClick={() => generateComplaint.mutate({ caseId: id }, { onSuccess: invalidate, onError: cause => setOperationError(errorText(cause)) })} data-testid="button-regenerate-draft">Generate updated draft from confirmed details</button>}
          {complaintQuery.isLoading ? <div className="skeleton" style={{ height: 120 }} /> :
            complaintQuery.isError ? <><ErrorNotice error={complaintQuery.error} retry={() => void complaintQuery.refetch()} /><button className="button" style={{ marginTop: 12 }} disabled={!canGenerateDraft(detail) || generateComplaint.isPending} onClick={() => generateComplaint.mutate({ caseId: id }, { onSuccess: invalidate, onError: error => setOperationError(errorText(error)) })} data-testid="button-generate-complaint">{generateComplaint.isPending ? <LoaderCircle size={15} /> : <FileText size={15} />} Generate draft</button></> :
            complaint ? <div className="stack">
              <div className="field"><label htmlFor="complaint-title">Draft title</label><input id="complaint-title" value={complaintTitle} onChange={event => setComplaintTitle(event.target.value)} data-testid="input-complaint-title" /></div>
              <div className="field"><label htmlFor="complaint-narrative">Complaint narrative</label><textarea id="complaint-narrative" style={{ minHeight: 240 }} value={narrative} onChange={event => setNarrative(event.target.value)} data-testid="input-complaint-narrative" /></div>
              {complaint.checklist?.length > 0 && <div><div className="stat-label" style={{ marginBottom: 8 }}>Draft checklist</div><ul className="analysis-list">{complaint.checklist.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <button className="button secondary" disabled={updateComplaint.isPending} onClick={() => updateComplaint.mutate({ caseId: id, data: { title: complaintTitle, narrative } }, { onSuccess: invalidate, onError: error => setOperationError(errorText(error)) })} data-testid="button-save-complaint">{updateComplaint.isPending ? <LoaderCircle size={15} /> : <Check size={15} />} Save draft</button>
                <button className="button secondary" disabled={exportPdf.isFetching} onClick={downloadPdf} data-testid="button-export-pdf">{exportPdf.isFetching ? <LoaderCircle size={15} /> : <ArrowDownToLine size={15} />} Download PDF</button>
              </div>
              <div className="alert info">Prepared for your review only. You must submit the complaint through the official channel yourself.</div>
              {complaint.approved ? <div className="alert info" data-testid="status-complaint-approved"><BadgeCheck size={14} style={{ verticalAlign: 'middle' }} /> You approved this draft. Approval does not mean it was filed.</div> :
                <button className="button" disabled={detail.missingFields.length > 0 || detail.draftStale || approveComplaint.isPending} onClick={() => approveComplaint.mutate({ caseId: id, data: { approved: true } }, { onSuccess: invalidate, onError: error => setOperationError(errorText(error)) })} data-testid="button-approve-complaint">{approveComplaint.isPending ? <LoaderCircle size={15} /> : <CheckCircle2 size={15} />} I have reviewed and approve this draft</button>}
            </div> :
            <div className="empty-state"><div className="empty-icon"><FileText size={18} /></div><strong>No draft prepared</strong><br />Complete the required details and run the analysis before creating a complaint draft.<button className="button" style={{ marginTop: 14 }} disabled={!canGenerateDraft(detail) || generateComplaint.isPending} onClick={() => generateComplaint.mutate({ caseId: id }, { onSuccess: invalidate, onError: error => setOperationError(errorText(error)) })} data-testid="button-generate-complaint">{generateComplaint.isPending ? <LoaderCircle size={15} /> : <FileText size={15} />} Generate draft</button></div>}
        </section>
      </div>
      <div className="stack">
        <section className="card card-pad">
          <div className="section-head"><div><span className="eyebrow">04 / Analysis</span><h2>Reported loss and findings</h2></div><Banknote size={17} color="hsl(var(--primary))" /></div>
          {detail.analysis ? <div>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', marginBottom: 13 }}>
              <div className="card stat"><div className="stat-label">Reported total</div><div className="stat-value" style={{ fontSize: 22 }} data-testid="value-reported-total">{money(detail.analysis.reportedTotal)}</div></div>
              <div className="card stat"><div className="stat-label">Evidence supported</div><div className="stat-value" style={{ fontSize: 22 }} data-testid="value-supported-total">{money(detail.analysis.evidenceSupportedTotal)}</div></div>
            </div>
            <div className="line-item"><span className="line-label">Unrecovered amount</span><span className="line-value">{money(detail.analysis.unrecoveredTotal)}</span></div>
            <div className="line-item"><span className="line-label">Category / confidence</span><span className="line-value">{detail.analysis.category} · {Math.round(detail.analysis.confidence * 100)}%</span></div>
            <div className="line-item"><span className="line-label">Urgency / transactions</span><span className="line-value">{detail.analysis.urgency} · {detail.analysis.transactionCount}</span></div>
            {detail.analysis.recommendations?.length > 0 && <><div className="stat-label" style={{ marginTop: 13, marginBottom: 8 }}>Suggested next steps</div><ul className="analysis-list">{detail.analysis.recommendations.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
            {detail.analysis.conflicts?.length > 0 && <div className="alert" style={{ marginTop: 13 }}><strong>Details to reconcile</strong><ul className="analysis-list">{detail.analysis.conflicts.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
          </div> : <div className="empty-state" style={{ padding: '15px' }}>Analysis will help compare reported totals with available evidence.</div>}
          <button className="button" style={{ width: '100%', marginTop: 14 }} disabled={analyze.isPending} onClick={() => analyze.mutate({ caseId: id }, { onSuccess: invalidate, onError: error => setOperationError(errorText(error)) })} data-testid="button-run-analysis">{analyze.isPending ? <LoaderCircle size={15} /> : <RefreshCw size={15} />} {detail.analysis ? 'Refresh analysis' : 'Analyze case'}</button>
          {analyze.isError && <div className="alert error" style={{ marginTop: 10 }} data-testid="error-analysis">{errorText(analyze.error)}</div>}
        </section>
        <section className="card card-pad">
          <div className="section-head"><h2>Transaction record</h2><span className="pill">{detail.transactions.length} items</span></div>
          {detail.transactions.length === 0 ? <p className="subhead" style={{ fontSize: 11 }}>No transactions are recorded yet. Add details in the conversation or case facts.</p> :
            detail.transactions.map(tx => <div className="transaction" key={tx.id} data-testid={`transaction-${tx.id}`}><strong>{money(tx.amount)} · {tx.source}</strong><span>{tx.authorized === false ? <span className="pill red">Not authorized</span> : tx.authorized === true ? <span className="pill green">Authorized</span> : <span className="pill">Unknown</span>}</span><small>{tx.bank || 'Provider not recorded'} · {dateOnly(tx.date)}</small><small>{tx.reference || 'No reference recorded'}</small></div>)}
        </section>
        <section className="card card-pad">
          <div className="section-head"><div><span className="eyebrow">05 / Prepare to submit</span><h2>Keep your next step yours</h2></div><Shield size={17} color="hsl(var(--primary))" /></div>
          <p className="subhead" style={{ fontSize: 11 }}>Check what you may need before opening the official portal. This does not submit anything.</p>
          {detail.missingFields?.length > 0 && <div className="alert" style={{ marginBottom: 12 }}><strong>Details still missing</strong><ul className="analysis-list">{detail.missingFields.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
          <button className="button secondary" style={{ width: '100%' }} disabled={prepare.isPending} onClick={() => prepare.mutate({ caseId: id }, { onSuccess: () => { invalidate(); }, onError: error => setOperationError(errorText(error)) })} data-testid="button-prepare-submission">{prepare.isPending ? <LoaderCircle size={15} /> : <CheckCircle2 size={15} />} Check submission readiness</button>
          {prepare.data && <div className={`alert ${prepare.data.ready ? 'info' : ''}`} style={{ marginTop: 12 }} data-testid="status-submission-readiness"><strong>{prepare.data.ready ? 'Your checklist is ready' : 'Some details need attention'}</strong><ul className="analysis-list">{prepare.data.checklist?.map((item, i) => <li key={i}>{item}</li>)}</ul><a className="portal-link" href={portalUrl} target="_blank" rel="noreferrer" data-testid="link-submission-portal">Continue to official portal <ExternalLink size={13} /></a></div>}
          <div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: 17, paddingTop: 15 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>User-reported acknowledgement</div>
            {detail.acknowledgement ? <div className="alert info" data-testid="status-user-acknowledgement">Reference recorded: {detail.acknowledgement}. This is user-reported and has not been verified.</div> :
              <><p className="subhead" style={{ fontSize: 10, marginBottom: 9 }}>Only enter a reference after you submit it yourself. It will be stored as unverified.</p><div style={{ display: 'flex', gap: 8 }}><input value={reference} onChange={event => setReference(event.target.value)} placeholder="Reference number" aria-label="User-reported reference" style={{ minWidth: 0, flex: 1, border: '1px solid hsl(var(--border))', borderRadius: 9, padding: '0 10px', fontSize: 11, background: 'hsl(var(--card))' }} data-testid="input-acknowledgement-reference" /><button className="button small" disabled={!reference.trim() || recordAcknowledgement.isPending} onClick={() => recordAcknowledgement.mutate({ caseId: id, data: { reference: reference.trim() } }, { onSuccess: invalidate, onError: error => setOperationError(errorText(error)) })} data-testid="button-record-acknowledgement">{recordAcknowledgement.isPending ? <LoaderCircle size={14} /> : <Check size={14} />} Record</button></div></>}
          </div>
        </section>
        <section className="card card-pad">
          <div className="section-head"><h2>Agent execution history</h2><Activity size={16} color="hsl(var(--primary))" /></div>
          {runsQuery.isLoading ? <div className="skeleton" style={{ height: 85 }} /> :
            runsQuery.isError ? <ErrorNotice error={runsQuery.error} retry={() => void runsQuery.refetch()} /> :
            runsQuery.data?.length ? <AgentRunList runs={runsQuery.data} /> : <div className="empty-state" style={{ padding: 15 }}>No agent runs have been recorded for this case.</div>}
        </section>
      </div>
    </div>
  </div>;
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AgentRunList({ runs }: { runs: AgentRun[] }) {
  return <div className="activity-list">{runs.map(run => <div className="activity-row" key={run.id} data-testid={`agent-run-${run.id}`}><div className="activity-mark">{run.status === 'RUNNING' ? <LoaderCircle size={15} className="voice-spinner" /> : run.status === 'COMPLETED' ? <Check size={15} /> : <AlertCircle size={15} />}</div><div><div className="activity-name">{run.agent} <span className={`pill ${run.status === 'COMPLETED' ? 'green' : run.status === 'RUNNING' ? '' : 'red'}`}>{run.status}</span></div><div className="activity-desc">{run.trigger} · {run.outputSummary || run.inputSummary}</div><div className="case-meta">{run.status === 'RUNNING' ? 'In progress' : `${run.durationMs} ms`}</div></div><div className="activity-time">{dateTime(run.createdAt)}</div></div>)}</div>;
}

function ActivityPage() {
  const casesQuery = useListFraudCases({ query: { queryKey: getListFraudCasesQueryKey() } });
  const dashboard = useGetFraudDashboard({ query: { queryKey: getGetFraudDashboardQueryKey() } });
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!selected && casesQuery.data?.length) setSelected(casesQuery.data[0].id);
  }, [casesQuery.data, selected]);
  const runsQuery = useGetFraudAgentRuns(selected, { query: { enabled: !!selected, queryKey: getGetFraudAgentRunsQueryKey(selected) } });
  const runList = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  return <div className="page">
    <div className="page-heading"><div><span className="eyebrow">Transparent by design</span><h1>What the agents<br />actually did.</h1><p className="subhead">Execution history comes from the case service. No activity is invented or estimated.</p></div><span className="secure-pill"><Activity size={13} /> Recorded runs only</span></div>
    {dashboard.isLoading ? <div className="stat-grid">{Array.from({ length: 4 }, (_, i) => <div className="card stat" key={i}><div className="skeleton" style={{ height: 12 }} /><div className="skeleton" style={{ height: 28, marginTop: 12 }} /></div>)}</div> :
      dashboard.isError ? <ErrorNotice error={dashboard.error} retry={() => void dashboard.refetch()} /> :
      <div className="stat-grid">
        {[
          ['Total cases', dashboard.data?.totalCases ?? 0], ['Analysed', dashboard.data?.analyzed ?? 0],
          ['Complaint drafts', dashboard.data?.complaintsPrepared ?? 0], ['Recorded agent failures', dashboard.data?.agentFailures ?? 0],
        ].map(([label, value]) => <div className="card stat" key={String(label)} data-testid={`activity-stat-${String(label).toLowerCase().replaceAll(' ', '-')}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-foot">Persisted service count</div></div>)}
      </div>}
    <section className="card card-pad">
      <div className="section-head"><div><span className="eyebrow">Run log</span><h2>Case execution history</h2></div>
        <select value={selected} onChange={event => setSelected(event.target.value)} aria-label="Select case" style={{ maxWidth: 260, minWidth: 140, border: '1px solid hsl(var(--border))', borderRadius: 9, padding: '9px 11px', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: 11 }} data-testid="select-activity-case">
          <option value="">Choose a case</option>{(casesQuery.data ?? []).map(item => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
        </select>
      </div>
      {casesQuery.isError && <ErrorNotice error={casesQuery.error} retry={() => void casesQuery.refetch()} />}
      {!casesQuery.isLoading && !casesQuery.isError && casesQuery.data?.length === 0 && <div className="empty-state"><div className="empty-icon"><FolderOpen size={18} /></div>No cases to display yet.</div>}
      {runsQuery.isLoading && <LoadingBlock rows={4} />}
      {runsQuery.isError && <ErrorNotice error={runsQuery.error} retry={() => void runsQuery.refetch()} />}
      {selected && !runsQuery.isLoading && !runsQuery.isError && (runList.length ? <AgentRunList runs={runList} /> : <div className="empty-state"><div className="empty-icon"><Clock3 size={18} /></div>No agent executions are recorded for this case.</div>)}
      {!selected && casesQuery.data?.length !== 0 && <div className="empty-state"><div className="empty-icon"><Activity size={18} /></div>Select a case to view its actual recorded execution history.</div>}
    </section>
    <div className="alert info" style={{ marginTop: 16 }}><strong>About these records</strong><br />Only server-recorded agent runs appear here. A case acknowledgement entered by a user remains unverified and is not treated as a filed or confirmed complaint.</div>
  </div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><AppFrame><Switch>
    <Route path="/" component={Dashboard} />
    <Route path="/chat" component={ChatPage} />
    <Route path="/activity" component={ActivityPage} />
    <Route path="/case/:id">{params => <CasePage id={params.id} />}</Route>
    <Route component={NotFound} />
  </Switch></AppFrame></ErrorBoundary>;
}

function PublicHome() {
  return <main className="public-home">
    <header className="public-nav">
      <Link href="/" className="public-brand">
        <span className="brand-mark">S</span>
        <span><strong>Fraud Sahayak</strong><small>Your incident, in order</small></span>
      </Link>
      <nav className="public-nav-actions" aria-label="Account">
        <Link href="/sign-in" className="public-sign-in">Sign in</Link>
        <Link href="/sign-up" className="button">Create account</Link>
      </nav>
    </header>
    <div className="public-content">
      <section className="public-intro">
        <span className="eyebrow">Independent incident support</span>
        <h1>Bring the facts together. Choose your next step.</h1>
        <p className="subhead">A private workspace to record what happened, keep relevant evidence together, and prepare a complaint draft for your review.</p>
        <div className="public-actions">
          <Link href="/sign-up" className="button">Create a private workspace <ArrowRight size={16} /></Link>
          <Link href="/sign-in" className="button secondary">I already have an account</Link>
        </div>
        <p className="public-disclosure">You stay in control of what you share. Fraud Sahayak does not file complaints or represent a bank, police service, or government portal.</p>
      </section>
      <aside className="public-support">
        <span className="eyebrow">Act quickly</span>
        <h2>Suspected financial cyber fraud?</h2>
        <div className="helpline">1930</div>
        <p>Call the national cyber-fraud helpline as soon as possible. For immediate danger, contact local emergency services.</p>
        <a className="portal-link" href={portalUrl} target="_blank" rel="noreferrer">Visit cybercrime.gov.in <ExternalLink size={13} /></a>
        <div className="public-support-note"><Shield size={16} /><span>Never share your PIN, password, OTP, or full card details here.</span></div>
      </aside>
    </div>
    <footer className="public-footer">Fraud Sahayak is an independent assistance tool. Any complaint must be submitted by you through the official portal.</footer>
  </main>;
}

function AuthLoading() {
  return <main className="auth-page"><div className="auth-loading"><span className="brand-mark">S</span><span>Opening your secure workspace…</span></div></main>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Router /> : <PublicHome />;
}

function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Router /> : <Redirect to="/" />;
}

function SignInPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (isSignedIn) return <Redirect to="/" />;
  return <main className="auth-page">
    <div className="auth-frame">
      <Link href="/" className="auth-back"><ChevronRight size={14} className="auth-back-icon" /> Back to Fraud Sahayak</Link>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <p className="auth-note">Your case information is available only in your account. Never share your PIN, password, or OTP.</p>
    </div>
  </main>;
}

function SignUpPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (isSignedIn) return <Redirect to="/" />;
  return <main className="auth-page">
    <div className="auth-frame">
      <Link href="/" className="auth-back"><ChevronRight size={14} className="auth-back-icon" /> Back to Fraud Sahayak</Link>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      <p className="auth-note">Create an account to keep your incident notes and evidence organized in one place.</p>
    </div>
  </main>;
}

function ClerkQueryCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        client.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);

  return null;
}

function ClerkAppRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClerkQueryCacheInvalidator />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/" component={HomeRoute} />
          <Route component={ProtectedRoute} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkAppRoutes /></WouterRouter>;
}

export default App;
