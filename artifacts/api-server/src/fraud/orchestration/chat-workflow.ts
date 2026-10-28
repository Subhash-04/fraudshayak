import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { and, eq } from "drizzle-orm";
import {
  db,
  fraudAgentRunsTable,
  fraudCasesTable,
  fraudEvidenceTable,
  fraudMessagesTable,
  fraudSessionsTable,
} from "@workspace/db";
import { runClassificationAgent } from "../agents/classification-agent";
import { runConversationAgent } from "../agents/conversation-agent";
import { runFinancialAnalysisAgent } from "../agents/financial-analysis-agent";
import {
  runOpenAIConversationAgent,
  runOpenAIFinancialReview,
  translateCollectionQuestion,
} from "../agents/gemini-agent";
import type {
  AgentResult,
  CaseSnapshot,
  IncidentFacts,
  IntakeResult,
} from "../types";
import type { Classification } from "../agents/classification-agent";
import { getMissingFields, nextCollectionQuestion } from "../knowledge/requirements";
import { redactSecrets } from "../agents/input-safety";

function snapshot(row: typeof fraudCasesTable.$inferSelect): CaseSnapshot {
  const data: CaseSnapshot = {
    id: row.id,
    title: row.title,
    status: row.status,
    language: row.language === "te" ? "te" : "en",
    category: row.category,
    intakeDetails: row.intakeDetails ?? {},
    complainantName: row.complainantName ?? undefined,
    contactNumber: row.contactNumber ?? undefined,
    email: row.email ?? undefined,
    state: row.state ?? undefined,
    district: row.district ?? undefined,
    incidentDescription: row.incidentDescription ?? undefined,
    incidentDate: row.incidentDate ?? undefined,
    bank: row.bank ?? undefined,
    reportedAmount: Number(row.reportedAmount),
    transactionReference: row.transactionReference ?? undefined,
    transactions: row.transactions ?? [],
    missingFields: row.missingFields ?? [],
  };
  data.missingFields = getMissingFields(data);
  return data;
}

function nextQuestion(data: CaseSnapshot, urgent: boolean): string {
  const prompts: Record<string, string> = {
    incidentDescription: "What happened? Please describe it in your own words.",
    incidentDate: "When did this happen? An approximate date is okay.",
    reportedAmount: "Approximately how much money was affected?",
    bank: "Which bank or payment provider was involved?",
    complainantName: "What name should I use for the complaint?",
    state: "Which state or union territory did this happen in?",
    evidenceAmountConfirmation: "One document shows an amount different from what you reported. What amount should the complaint use?",
  };
  const missing = data.missingFields[0];
  const prompt = prompts[missing ?? ""];
  if (!missing) {
    return "I’ve checked the details you shared. I can prepare a complaint draft for you to review; you will submit it through the official portal yourself.";
  }
  if (urgent) {
    return `If the transaction was unauthorized, contact your bank through its official fraud channel and call 1930 immediately. ${prompt ?? "I can help prepare the complaint."}`;
  }
  return prompt ?? "I could not confirm that detail. Please clarify it so I can continue.";
}

function makeRun(
  id: string,
  agent: string,
  input: string,
  output: string,
  durationMs: number,
): AgentResult {
  return {
    agent,
    trigger: "chat.message",
    status: "COMPLETED",
    inputSummary: input.slice(0, 240),
    outputSummary: output.slice(0, 240),
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}

async function persistRuns(caseId: string, runs: AgentResult[]) {
  if (!runs.length) return;
  await db.insert(fraudAgentRunsTable).values(
    runs.map((run) => ({
      id: crypto.randomUUID(),
      caseId,
      agent: run.agent,
      trigger: run.trigger,
      status: run.status,
      inputSummary: run.inputSummary,
      outputSummary: run.outputSummary,
      durationMs: run.durationMs,
    })),
  );
}

const ChatState = Annotation.Root({
  caseId: Annotation<string>(),
  sessionId: Annotation<string>(),
  text: Annotation<string>(),
  intake: Annotation<IntakeResult | null>(),
  classification: Annotation<Classification | null>(),
  assistantText: Annotation<string>(),
  runs: Annotation<AgentResult[]>({
    reducer: (previous, next) => previous.concat(next),
    default: () => [],
  }),
});

const graph = new StateGraph(ChatState)
  .addNode("conversation", async (state) => {
    const started = performance.now();
    const [rows] = await Promise.all([
      db.select().from(fraudCasesTable).where(eq(fraudCasesTable.id, state.caseId)),
    ]);
    const row = rows[0];
    if (!row) throw new Error("Case not found");
    const current = snapshot(row);
    const localIntake = runConversationAgent(state.text, current);
    const aiIntake = await runOpenAIConversationAgent(state.text, current);
    const facts: IncidentFacts = {
      ...aiIntake.facts,
    };
    if (current.missingFields[0]?.startsWith("intakeDetails.")) {
      // Short category answers must not be misread by the legacy generic intake.
      for (const key of Object.keys(localIntake.facts) as Array<keyof IncidentFacts>) {
        if (!(key in aiIntake.facts)) delete facts[key];
      }
    }
    const intakeDetails = { ...current.intakeDetails, ...facts.intakeDetails };
    const explicitlyConfirmed = /\b(i confirm all details|confirm all details|all details are correct)\b/i.test(state.text)
      && current.missingFields[0] === "intakeDetails.detailsConfirmed";
    const substantiveChange = Object.entries(facts).some(([key, value]) =>
      key !== "intakeDetails" && value !== (current as unknown as Record<string, unknown>)[key])
      || Object.entries(facts.intakeDetails ?? {}).some(([key, value]) =>
        key !== "detailsConfirmed" && value !== current.intakeDetails?.[key]);
    if (substantiveChange || current.category !== aiIntake.classification.category) delete intakeDetails.detailsConfirmed;
    if (explicitlyConfirmed && !substantiveChange && current.category === aiIntake.classification.category) intakeDetails.detailsConfirmed = "confirmed";
    else if (facts.intakeDetails?.detailsConfirmed) delete intakeDetails.detailsConfirmed;
    if (current.missingFields[0] === "transactionReference" && /^(unknown|not available|not known)$/i.test(state.text.trim())) {
      intakeDetails.transactionReference = "unknown";
    }
    facts.intakeDetails = intakeDetails;
    const intake = {
      ...localIntake,
      facts,
      language: facts.language ?? localIntake.language,
    };
    const noLoss = /^(no|none|no money lost)$/i.test(intakeDetails.moneyLost ?? "");
    const amount = noLoss ? 0 : facts.reportedAmount ?? current.reportedAmount ?? 0;
    const transactions = noLoss ? [] : [...current.transactions];
    if (!noLoss && facts.reportedAmount !== undefined) {
      const existing = transactions.find((item) => item.source === "user-report");
      if (existing) {
        existing.amount = facts.reportedAmount;
        existing.reference = facts.transactionReference ?? existing.reference;
        existing.bank = facts.bank ?? existing.bank;
        existing.date = facts.incidentDate ?? existing.date;
      } else {
        transactions.push({
          id: `${state.caseId}-reported-loss`,
          amount: facts.reportedAmount,
          source: "user-report",
          reference: facts.transactionReference ?? null,
          bank: facts.bank ?? null,
          date: facts.incidentDate ?? null,
          authorized: false,
        });
      }
    }
    const updatedLanguage = facts.language ?? current.language;
    const next: CaseSnapshot = {
      ...current,
      ...facts,
      category: aiIntake.classification.category,
      reportedAmount: amount,
      language: updatedLanguage,
      transactions,
    };
    const unresolvedEvidenceConfirmation = current.missingFields.includes("evidenceAmountConfirmation")
      && facts.reportedAmount === undefined;
    const remainingMarkers = unresolvedEvidenceConfirmation
      ? current.missingFields
      : current.missingFields.filter((field) => field !== "evidenceAmountConfirmation");
    next.missingFields = getMissingFields({ ...next, missingFields: remainingMarkers });
    const status = next.incidentDescription ? "INFORMATION_REQUIRED" : "INTAKE";
    await db
      .update(fraudCasesTable)
      .set({
        complainantName: next.complainantName ?? null,
        contactNumber: next.contactNumber ?? null,
        email: next.email ?? null,
        state: next.state ?? null,
        district: next.district ?? null,
        incidentDescription: next.incidentDescription ?? null,
        incidentDate: next.incidentDate ?? null,
        bank: next.bank ?? null,
        category: next.category ?? null,
        intakeDetails,
        ...(substantiveChange ? { analysis: null, complaint: row.complaint ? { ...row.complaint, approved: false } : null } : {}),
        reportedAmount: String(amount),
        transactionReference: next.transactionReference ?? null,
        transactions,
        missingFields: next.missingFields,
        language: updatedLanguage,
        status,
        title: next.incidentDescription?.slice(0, 72) || current.title,
        updatedAt: new Date(),
      })
      .where(eq(fraudCasesTable.id, state.caseId));
    await db
      .update(fraudSessionsTable)
      .set({ language: updatedLanguage })
      .where(eq(fraudSessionsTable.id, state.sessionId));
    const question = nextCollectionQuestion(next);
    const assistantText = question
      ? await translateCollectionQuestion(`${intake.urgent ? "For an urgent unauthorized loss, contact your bank's verified fraud channel and call 1930 now; do not wait to complete this checklist. " : ""}${question}`, next.language)
      : "Thank you for confirming the category-specific details. Your complaint can now be drafted for your review. Nothing has been filed with the cybercrime portal.";
    const run = makeRun(
      "",
      "OpenAI Conversation Intake",
      "Latest user reply; uploaded evidence is excluded.",
      `OpenAI checked the reply and extracted ${Object.keys(facts).length} fields; ${next.missingFields.length} fields remain.`,
      performance.now() - started,
    );
    await persistRuns(state.caseId, [run]);
    return {
      intake,
      classification: aiIntake.classification,
      assistantText,
      runs: [run],
    };
  })
  .addNode("classify", async (state) => {
    const started = performance.now();
    const [row] = await db
      .select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, state.caseId));
    if (!row) throw new Error("Case not found");
    const result =
      state.classification ??
      runClassificationAgent(row.incidentDescription ?? state.text);
    await db
      .update(fraudCasesTable)
      .set({ category: result.category, updatedAt: new Date() })
      .where(eq(fraudCasesTable.id, state.caseId));
    const run = makeRun(
      "",
      "OpenAI Fraud Classification and Triage",
      state.text,
      `${result.category}; ${result.urgency} urgency; confidence ${result.confidence.toFixed(2)}.`,
      performance.now() - started,
    );
    await persistRuns(state.caseId, [run]);
    return { classification: result, runs: [run] };
  })
  .addNode("financial-analysis", async (state) => {
    const started = performance.now();
    const [row] = await db
      .select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, state.caseId));
    if (!row) throw new Error("Case not found");
    const [evidenceRows] = await Promise.all([
      db.select().from(fraudEvidenceTable).where(eq(fraudEvidenceTable.caseId, state.caseId)),
    ]);
    const data = snapshot(row);
    const classification =
      state.classification ?? runClassificationAgent(row.incidentDescription ?? state.text);
    const conflicts = evidenceRows.flatMap((item) => {
      const found = item.extractedText?.match(
        /(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d{1,2})?)/i,
      );
      if (!found?.[1]) return [];
      const amount = Number(found[1].replaceAll(",", ""));
      return amount !== (data.reportedAmount ?? 0)
        ? [`${item.name} mentions ₹${amount.toLocaleString("en-IN")}; the reported total is ₹${(data.reportedAmount ?? 0).toLocaleString("en-IN")}. Please confirm.`]
        : [];
    });
    const baseAnalysis = runFinancialAnalysisAgent(
      data,
      classification,
      [],
      conflicts,
    );
    const review = await runOpenAIFinancialReview(
      data,
      classification,
      conflicts.length,
    );
    const analysis = {
      ...baseAnalysis,
      provider: "openai-compatible" as const,
      patterns: review.summary
        ? [...baseAnalysis.patterns, `OpenAI case review: ${review.summary}`]
        : baseAnalysis.patterns,
      recommendations: [
        ...new Set([
          ...baseAnalysis.recommendations,
          ...review.questions.map((question) => `Confirm before filing: ${question}`),
          ...review.recommendations,
        ]),
      ],
    };
    await db
      .update(fraudCasesTable)
      .set({ analysis, status: data.missingFields.length > 0 ? "INFORMATION_REQUIRED" : "ANALYSIS_COMPLETED", updatedAt: new Date() })
      .where(eq(fraudCasesTable.id, state.caseId));
    const run = makeRun(
      "",
      "OpenAI Financial Fraud Analysis",
      `Transactions: ${data.transactions.length}; evidence: ${evidenceRows.length}.`,
      `Reported total ₹${analysis.reportedTotal.toLocaleString("en-IN")}; ${analysis.conflicts.length} conflict(s).`,
      performance.now() - started,
    );
    await persistRuns(state.caseId, [run]);
    return { runs: [run] };
  })
  .addEdge(START, "conversation")
  .addConditionalEdges(
    "conversation",
    (state) =>
      state.intake?.urgent ||
      (state.intake?.facts.incidentDescription !== undefined) ||
      (state.intake?.facts.reportedAmount !== undefined)
        ? "classify"
        : "end",
    { classify: "classify", end: END },
  )
  .addEdge("classify", "financial-analysis")
  .addEdge("financial-analysis", END)
  .compile();

export async function executeChatWorkflow(
  caseId: string,
  sessionId: string,
  text: string,
) {
  text = redactSecrets(text);
  const [userMessage] = await db
    .insert(fraudMessagesTable)
    .values({
      id: crypto.randomUUID(),
      sessionId,
      role: "user",
      text,
    })
    .returning();
  const runId = crypto.randomUUID();
  const started = performance.now();
  await db.insert(fraudAgentRunsTable).values({
    id: runId, caseId, agent: "OpenAI Case Workflow", trigger: "chat.message",
    status: "RUNNING", inputSummary: "Processing user message; uploaded evidence excluded.",
    outputSummary: "Intake, triage and case review are in progress.", durationMs: 0,
  });
  let result;
  try {
    result = await graph.invoke({
    caseId,
    sessionId,
    text,
    intake: null,
    classification: null,
    assistantText: "",
    runs: [],
    });
    await db.update(fraudAgentRunsTable).set({
      status: "COMPLETED", outputSummary: "Agent workflow completed.",
      durationMs: Math.round(performance.now() - started),
    }).where(eq(fraudAgentRunsTable.id, runId));
  } catch (error) {
    await db.update(fraudAgentRunsTable).set({
      status: "FAILED", outputSummary: "Agent service could not finish. Please retry; no complaint was submitted.",
      durationMs: Math.round(performance.now() - started),
    }).where(eq(fraudAgentRunsTable.id, runId));
    throw error;
  }
  const [assistantMessage] = await db
    .insert(fraudMessagesTable)
    .values({
      id: crypto.randomUUID(),
      sessionId,
      role: "assistant",
      text: result.assistantText,
    })
    .returning();
  const [caseRow] = await db
    .select()
    .from(fraudCasesTable)
    .where(eq(fraudCasesTable.id, caseId));
  if (!caseRow) throw new Error("Case not found");
  return { userMessage, assistantMessage, caseRow, runs: result.runs };
}

export { snapshot, getMissingFields };
