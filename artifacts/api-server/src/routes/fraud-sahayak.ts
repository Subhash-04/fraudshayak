import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { runOpenAIFinancialReview } from "../fraud/agents/gemini-agent";
import PDFDocument from "pdfkit";
import {
  db,
  fraudAgentRunsTable,
  fraudAuditLogsTable,
  fraudCasesTable,
  fraudEvidenceTable,
  fraudMessagesTable,
  fraudSessionsTable,
  type FraudComplaint,
} from "@workspace/db";
import {
  ApproveFraudComplaintBody,
  CreateFraudCaseBody,
  CreateFraudSessionBody,
  GenerateFraudComplaintParams,
  GetFraudAgentRunsParams,
  GetFraudCaseParams,
  GetFraudComplaintParams,
  GetFraudSessionParams,
  PrepareFraudSubmissionParams,
  RecordFraudAcknowledgementBody,
  RecordFraudAcknowledgementParams,
  SendFraudMessageBody,
  UpdateFraudCaseBody,
  UpdateFraudCaseParams,
  UpdateFraudComplaintBody,
  UpdateFraudComplaintParams,
  UploadFraudEvidenceParams,
} from "@workspace/api-zod";
import { runClassificationAgent } from "../fraud/agents/classification-agent";
import { runComplaintAgent } from "../fraud/agents/complaint-agent";
import { runConversationAgent } from "../fraud/agents/conversation-agent";
import { inspectEvidence } from "../fraud/agents/evidence-agent";
import { runFinancialAnalysisAgent } from "../fraud/agents/financial-analysis-agent";
import { runReportingAgent } from "../fraud/agents/reporting-agent";
import { getMissingFields, executeChatWorkflow, snapshot } from "../fraud/orchestration/chat-workflow";
import { requireAuth } from "../middlewares/requireAuth";
import { guidance, categoryGuide, publicCollectionChecklist, caseFingerprint, collectionQuestions } from "../fraud/knowledge/requirements";
import { redactSecrets } from "../fraud/agents/input-safety";

const router: IRouter = Router();
router.use(requireAuth);
const requestBudgets = new Map<string, { startedAt: number; count: number }>();
router.use((req, res, next) => {
  if (req.method !== "POST" || !/\/(messages|transcribe|analyze|complaint)$/.test(req.path)) { next(); return; }
  const nowMs = Date.now();
  for (const [key, value] of requestBudgets) if (nowMs - value.startedAt >= 60000) requestBudgets.delete(key);
  const budget = requestBudgets.get(req.userId!) ?? { startedAt: nowMs, count: 0 };
  budget.count++;
  requestBudgets.set(req.userId!, budget);
  if (budget.count > 12) {
    res.setHeader("Retry-After", String(Math.ceil((60000 - (nowMs - budget.startedAt)) / 1000)));
    res.status(429).json({ error: "Too many AI requests. Please wait a minute before trying again." });
    return;
  }
  next();
});
router.get("/fraud-sahayak/guidance", (_req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="financial-fraud-collection-guide.json"');
  res.json(guidance);
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
const evidenceDirectory = path.resolve(
  process.env.FRAUD_STORAGE_DIR ?? ".local/fraud-evidence",
);
const PORTAL = "https://www.cybercrime.gov.in/";
const HELPLINE = "1930";
const now = () => new Date().toISOString();

function baseCase(row: typeof fraudCasesTable.$inferSelect, evidenceCount: number) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    language: row.language === "te" ? "te" as const : "en" as const,
    category: row.category,
    reportedAmount: Number(row.reportedAmount),
    evidenceCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function publicEvidence(row: typeof fraudEvidenceTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    sha256: row.sha256,
    extractionStatus: row.extractionStatus,
    extractedText: row.extractedText,
    createdAt: row.createdAt.toISOString(),
  };
}

async function evidenceForCase(caseId: string) {
  return db
    .select()
    .from(fraudEvidenceTable)
    .where(eq(fraudEvidenceTable.caseId, caseId))
    .orderBy(fraudEvidenceTable.createdAt);
}

async function detailForCase(row: typeof fraudCasesTable.$inferSelect) {
  const [sessions, evidence] = await Promise.all([
    db.select().from(fraudSessionsTable).where(eq(fraudSessionsTable.caseId, row.id)),
    evidenceForCase(row.id),
  ]);
  const sessionIds = sessions.map((session) => session.id);
  const messages = sessionIds.length
    ? await db
        .select()
        .from(fraudMessagesTable)
        .where(inArray(fraudMessagesTable.sessionId, sessionIds))
        .orderBy(fraudMessagesTable.createdAt)
    : [];
  const transactions = row.transactions ?? [];
  const caseDetail = {
    ...baseCase(row, evidence.length),
    complainantName: row.complainantName,
    contactNumber: row.contactNumber,
    email: row.email,
    state: row.state,
    district: row.district,
    incidentDescription: row.incidentDescription,
    incidentDate: row.incidentDate,
    bank: row.bank,
    transactionReference: row.transactionReference,
    transactions,
    evidence: evidence.map(publicEvidence),
    missingFields: getMissingFields(snapshot(row)),
    analysis: row.analysis,
    complaint: row.complaint,
    acknowledgement: row.acknowledgement,
    intakeDetails: row.intakeDetails ?? {},
    collectionChecklist: publicCollectionChecklist(snapshot(row)),
    portalCategory: categoryGuide(row.category).portalMapping,
    draftStale: !!row.complaint && row.complaint.sourceFingerprint !== caseFingerprint(snapshot(row)),
  };
  return {
    ...caseDetail,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant" | "system",
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

async function getCase(caseId: string, userId: string) {
  const [row] = await db
    .select()
    .from(fraudCasesTable)
    .where(
      and(
        eq(fraudCasesTable.id, caseId),
        eq(fraudCasesTable.userId, userId),
      ),
    );
  return row;
}

async function addRun(
  caseId: string,
  agent: string,
  trigger: string,
  inputSummary: string,
  outputSummary: string,
  durationMs = 0,
  status: "COMPLETED" | "FAILED" = "COMPLETED",
) {
  const [run] = await db
    .insert(fraudAgentRunsTable)
    .values({
      id: randomUUID(),
      caseId,
      agent,
      trigger,
      status,
      inputSummary: inputSummary.slice(0, 240),
      outputSummary: outputSummary.slice(0, 240),
      durationMs: Math.max(0, Math.round(durationMs)),
    })
    .returning();
  return {
    id: run.id,
    agent: run.agent,
    trigger: run.trigger,
    status: run.status as "COMPLETED" | "FAILED",
    inputSummary: run.inputSummary,
    outputSummary: run.outputSummary,
    durationMs: run.durationMs,
    createdAt: run.createdAt.toISOString(),
  };
}

function detectMime(file: Express.Multer.File): string | null {
  const bytes = file.buffer;
  if (
    bytes.subarray(0, 5).toString("ascii") === "%PDF-" &&
    (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf"))
  ) {
    return "application/pdf";
  }
  if (
    bytes[0] === 0x89 &&
    bytes.subarray(1, 4).toString("ascii") === "PNG" &&
    file.originalname.toLowerCase().endsWith(".png")
  ) {
    return "image/png";
  }
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    file.originalname.toLowerCase().match(/\.jpe?g$/)
  ) {
    return "image/jpeg";
  }
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === ".txt" && file.mimetype === "text/plain") return "text/plain";
  if (extension === ".csv" && file.mimetype === "text/csv") return "text/csv";
  return null;
}

router.post("/fraud-sahayak/sessions", async (req, res): Promise<void> => {
  const parsed = CreateFraudSessionBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const language = parsed.data.language === "te" ? "te" : "en";
  const caseId = randomUUID();
  const sessionId = randomUUID();
  const started = performance.now();
  const [row] = await db
    .insert(fraudCasesTable)
    .values({
      id: caseId,
      userId: req.userId!,
      title: "New financial fraud complaint",
      status: "INTAKE",
      language,
      missingFields: ["incidentDescription", "reportedAmount", "bank"],
    })
    .returning();
  await db.insert(fraudSessionsTable).values({ id: sessionId, caseId, language });
  const greeting =
    language === "te"
      ? "ఫ్రాడ్ సహాయక్ — సిమ్యులేషన్‌కు స్వాగతం.\n\nభాషను ఎంచుకోండి:\n1. English\n2. తెలుగు\n\nమీరు వివరాలను సిద్ధం చేసుకోవచ్చు. అధికారిక ఫిర్యాదు మీరే cybercrime.gov.in లో దాఖలు చేయాలి."
      : "Welcome to Fraud Sahayak — Simulation.\n\nWe can help document a financial fraud incident and prepare a complaint for your review.\n\nPlease choose your language:\n1. English\n2. తెలుగు\n\nThis service is not a government or police system. You submit any complaint yourself through the official portal.";
  const [message] = await db
    .insert(fraudMessagesTable)
    .values({
      id: randomUUID(),
      sessionId,
      role: "assistant",
      text: greeting,
    })
    .returning();
  const startCase = snapshot(row);
  runConversationAgent("hello", startCase);
  await addRun(
    caseId,
    "Conversation Intake",
    "session.create",
    "New complaint session",
    "Sent language selection and simulation disclosures.",
    performance.now() - started,
  );
  await db.insert(fraudAuditLogsTable).values({
    id: randomUUID(),
    caseId,
    eventType: "session.created",
    details: { language },
  });
  res.status(201).json({
    id: sessionId,
    caseId,
    language,
    createdAt: message.createdAt.toISOString(),
  });
});

router.get("/fraud-sahayak/sessions/:sessionId", async (req, res): Promise<void> => {
  const params = GetFraudSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db
    .select()
    .from(fraudSessionsTable)
    .where(eq(fraudSessionsTable.id, params.data.sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const row = await getCase(session.caseId, req.userId!);
  if (!row) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const detail = await detailForCase(row);
  res.json({
    id: session.id,
    caseId: session.caseId,
    language: session.language === "te" ? "te" : "en",
    createdAt: session.createdAt.toISOString(),
    messages: detail.messages,
    case: detail,
  });
});

router.get("/fraud-sahayak/cases", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(fraudCasesTable)
    .where(eq(fraudCasesTable.userId, _req.userId!))
    .orderBy(fraudCasesTable.updatedAt);
  const cases = await Promise.all(
    rows.map(async (row) => {
      const evidence = await evidenceForCase(row.id);
      return baseCase(row, evidence.length);
    }),
  );
  res.json(cases.reverse());
});

router.post("/fraud-sahayak/cases", async (req, res): Promise<void> => {
  const parsed = CreateFraudCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(fraudCasesTable)
    .values({
      id: randomUUID(),
      userId: req.userId!,
      title: parsed.data.title || "New financial fraud complaint",
      status: "INTAKE",
      language: parsed.data.language === "te" ? "te" : "en",
      missingFields: ["incidentDescription", "reportedAmount", "bank"],
    })
    .returning();
  const result = baseCase(row, 0);
  res.status(201).json(result);
});

router.get("/fraud-sahayak/cases/:caseId", async (req, res): Promise<void> => {
  const params = GetFraudCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await getCase(params.data.caseId, req.userId!);
  if (!row) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.json(await detailForCase(row));
});

router.post("/fraud-sahayak/cases/:caseId/session", async (req, res): Promise<void> => {
  const params = GetFraudCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(fraudSessionsTable)
    .where(eq(fraudSessionsTable.caseId, current.id))
    .orderBy(desc(fraudSessionsTable.createdAt))
    .limit(1);
  if (existing) {
    res.json({
      id: existing.id,
      caseId: existing.caseId,
      language: existing.language === "te" ? "te" : "en",
      createdAt: existing.createdAt.toISOString(),
    });
    return;
  }

  const sessionId = randomUUID();
  const language = current.language === "te" ? "te" : "en";
  const [session] = await db
    .insert(fraudSessionsTable)
    .values({ id: sessionId, caseId: current.id, language })
    .returning();
  const missing = getMissingFields(snapshot(current));
  const greeting = missing.length
    ? language === "te"
      ? "ఒక్కో ప్రశ్నకు ఒక్కసారి సమాధానం ఇవ్వండి. ఏమి జరిగిందో మీ మాటల్లో చెప్పండి. OTP, PIN, పాస్‌వర్డ్ లేదా CVV పంపవద్దు."
      : "I’ll ask one question at a time. First, what happened? Please don’t share an OTP, PIN, password, or CVV."
    : language === "te"
      ? "మీ వివరాలను పరిశీలించడానికి సిద్ధంగా ఉన్నాను. పత్రాలు జోడించండి లేదా ఫిర్యాదు ముసాయిదాను సిద్ధం చేయండి."
      : "I have enough details to review. You can add evidence or prepare a complaint draft for your review.";
  await db.insert(fraudMessagesTable).values({
    id: randomUUID(),
    sessionId: session.id,
    role: "assistant",
    text: greeting,
  });
  await addRun(
    current.id,
    "Conversation Intake",
    "session.start",
    "Opened case conversation",
    "Started a one-question-at-a-time intake.",
    0,
  );
  res.status(201).json({
    id: session.id,
    caseId: session.caseId,
    language,
    createdAt: session.createdAt.toISOString(),
  });
});

router.patch("/fraud-sahayak/cases/:caseId", async (req, res): Promise<void> => {
  const params = UpdateFraudCaseParams.safeParse(req.params);
  const parsed = UpdateFraudCaseBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const data = parsed.data;
  const intakeDetails = { ...current.intakeDetails, ...data.intakeDetails };
  const allowedIntake = new Set([...Object.keys(collectionQuestions(data.category ?? current.category)), "transactionReference"]);
  for (const key of Object.keys(intakeDetails)) {
    if (!allowedIntake.has(key)) delete intakeDetails[key];
  }
  delete intakeDetails.detailsConfirmed;
  const incidentDate =
    data.incidentDate instanceof Date
      ? data.incidentDate.toISOString().slice(0, 10)
      : data.incidentDate;
  const transactions = [...(current.transactions ?? [])];
  if (data.reportedAmount !== undefined && data.reportedAmount !== null) {
    const existing = transactions.find((item) => item.source === "user-report");
    if (existing) existing.amount = data.reportedAmount;
    else {
      transactions.push({
        id: `${current.id}-reported-loss`,
        amount: data.reportedAmount,
        source: "user-report",
        reference: data.transactionReference ?? current.transactionReference,
        bank: data.bank ?? current.bank,
        date: incidentDate ?? current.incidentDate,
        authorized: false,
      });
    }
  }
  const next: import("../fraud/types").CaseSnapshot = {
    ...snapshot(current),
    intakeDetails,
    complainantName: data.complainantName ?? current.complainantName ?? undefined,
    contactNumber: data.contactNumber ?? current.contactNumber ?? undefined,
    email: data.email ?? current.email ?? undefined,
    state: data.state ?? current.state ?? undefined,
    district: data.district ?? current.district ?? undefined,
    incidentDescription:
      data.incidentDescription ?? current.incidentDescription ?? undefined,
    incidentDate: incidentDate ?? current.incidentDate ?? undefined,
    bank: data.bank ?? current.bank ?? undefined,
    transactionReference:
      data.transactionReference ?? current.transactionReference ?? undefined,
    reportedAmount: data.reportedAmount ?? Number(current.reportedAmount),
    transactions,
  };
  const values = {
    title: current.title,
    complainantName: data.complainantName,
    contactNumber: data.contactNumber,
    email: data.email,
    state: data.state,
    district: data.district,
    incidentDescription: data.incidentDescription,
    incidentDate,
    bank: data.bank,
    transactionReference: data.transactionReference,
    reportedAmount:
      data.reportedAmount === undefined || data.reportedAmount === null
        ? undefined
        : String(data.reportedAmount),
    category: data.category,
    intakeDetails,
    transactions,
    missingFields: getMissingFields({
      ...next,
      category: data.category ?? next.category,
    }),
    analysis: null,
    complaint: current.complaint ? { ...current.complaint, approved: false } : null,
    status: "INFORMATION_REQUIRED",
    updatedAt: new Date(),
  };
  const [updated] = await db
    .update(fraudCasesTable)
    .set(values)
    .where(eq(fraudCasesTable.id, current.id))
    .returning();
  res.json(baseCase(updated, (await evidenceForCase(updated.id)).length));
});

router.post("/fraud-sahayak/chat/transcribe", (req, res): void => {
  upload.single("file")(req, res, async (error: unknown) => {
    if (error || !req.file || req.file.size < 44) {
      res.status(400).json({ error: "Record a message of up to 60 seconds and try again." });
      return;
    }
    const buffer = req.file.buffer;
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
      res.status(400).json({ error: "A WAV voice recording is required." });
      return;
    }
    try {
      const result = await openai.audio.transcriptions.create({
        model: "gpt-4o-mini-transcribe",
        file: new File([new Uint8Array(buffer)], "voice.wav", { type: "audio/wav" }),
        response_format: "json",
      }, { timeout: 60000, maxRetries: 2 });
      const text = result.text?.trim();
      if (!text) {
        res.status(400).json({ error: "No speech was detected. Please record again." });
        return;
      }
      res.json({ text: redactSecrets(text.slice(0, 10000)) });
    } catch {
      req.log.warn("Voice transcription service failed");
      res.status(503).json({ error: "Voice transcription is temporarily unavailable. Please try again or type your message." });
    }
  });
});

router.post("/fraud-sahayak/chat/messages", async (req, res): Promise<void> => {
  const parsed = SendFraudMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db
    .select()
    .from(fraudSessionsTable)
    .where(eq(fraudSessionsTable.id, parsed.data.sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const ownedCase = await getCase(session.caseId, req.userId!);
  if (!ownedCase) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  try {
    const result = await executeChatWorkflow(
      session.caseId,
      session.id,
      parsed.data.text,
    );
    const refreshed = await getCase(session.caseId, req.userId!);
    if (!refreshed) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    res.json({
      userMessage: {
        id: result.userMessage.id,
        role: "user",
        text: result.userMessage.text,
        createdAt: result.userMessage.createdAt.toISOString(),
      },
      assistantMessage: {
        id: result.assistantMessage.id,
        role: "assistant",
        text: result.assistantMessage.text,
        createdAt: result.assistantMessage.createdAt.toISOString(),
      },
      case: await detailForCase(refreshed),
      agentRuns: result.runs.map((run, index) => ({
        ...run,
        id: `${session.caseId}-chat-${index}-${Date.now()}`,
        createdAt: now(),
      })),
    });
  } catch (error) {
    req.log.error({ caseId: session.caseId }, "Fraud chat processing failed");
    res.status(500).json({
      error:
        error instanceof Error
          ? "Message could not be processed. Please retry."
          : "Message could not be processed.",
    });
  }
});

router.post("/fraud-sahayak/cases/:caseId/evidence", (req, res, next) => {
  upload.single("file")(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "File exceeds the 10 MB upload limit." });
        return;
      }
      res.status(400).json({ error: "Upload could not be accepted." });
      return;
    }
    next();
  });
}, async (req, res): Promise<void> => {
  const params = UploadFraudEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Choose a file to upload." });
    return;
  }
  const mimeType = detectMime(file);
  if (!mimeType) {
    res.status(400).json({ error: "Supported files: PDF, PNG, JPG, TXT or CSV." });
    return;
  }
  const started = performance.now();
  const extraction = await inspectEvidence(file.buffer, mimeType);
  const [duplicate] = await db
    .select()
    .from(fraudEvidenceTable)
    .where(
      and(
        eq(fraudEvidenceTable.caseId, current.id),
        eq(fraudEvidenceTable.sha256, extraction.sha256),
      ),
    );
  if (duplicate) {
    res.status(409).json({ error: "This exact evidence file is already attached." });
    return;
  }
  await mkdir(evidenceDirectory, { recursive: true });
  const storagePath = path.join(evidenceDirectory, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  await writeFile(storagePath, file.buffer, { mode: 0o600, flag: "wx" });
  const [evidence] = await db
    .insert(fraudEvidenceTable)
    .values({
      id: randomUUID(),
      caseId: current.id,
      name: path.basename(file.originalname).slice(0, 200),
      mimeType,
      size: file.size,
      sha256: extraction.sha256,
      storagePath,
      extractionStatus: extraction.extractionStatus,
      extractedText: extraction.extractedText,
    })
    .returning();
  const transactions = [...(current.transactions ?? [])];
  if (extraction.amount) {
    transactions.push({
      id: `${evidence.id}-extracted`,
      amount: extraction.amount,
      source: `evidence:${evidence.name}`,
      reference: extraction.reference ?? null,
      bank: current.bank,
      date: current.incidentDate,
      authorized: false,
    });
  }
  const mismatch =
    extraction.amount !== undefined &&
    Number(current.reportedAmount) > 0 &&
    extraction.amount !== Number(current.reportedAmount);
  const missing = new Set(current.missingFields ?? []);
  if (extraction.reference && !current.transactionReference) {
    missing.delete("transactionReference");
  }
  if (mismatch) missing.add("evidenceAmountConfirmation");
  await db
    .update(fraudCasesTable)
    .set({
      transactions,
      transactionReference:
        current.transactionReference ?? extraction.reference ?? null,
      reportedAmount:
        Number(current.reportedAmount) > 0
          ? current.reportedAmount
          : String(extraction.amount ?? 0),
      missingFields: [...missing],
      intakeDetails: { ...current.intakeDetails, detailsConfirmed: "" },
      complaint: current.complaint ? { ...current.complaint, approved: false, sourceFingerprint: undefined } : null,
      analysis: null,
      updatedAt: new Date(),
    })
    .where(eq(fraudCasesTable.id, current.id));
  await addRun(
    current.id,
    "Evidence Collection and Validation",
    "evidence.upload",
    `${mimeType}; ${file.size} bytes`,
    `${extraction.extractionStatus}; SHA-256 calculated${mismatch ? "; amount conflict detected" : ""}.`,
    performance.now() - started,
  );
  await db.insert(fraudAuditLogsTable).values({
    id: randomUUID(),
    caseId: current.id,
    eventType: "evidence.uploaded",
    details: { evidenceId: evidence.id, sha256: extraction.sha256, extractionStatus: extraction.extractionStatus },
  });
  res.status(201).json(publicEvidence(evidence));
});

router.post("/fraud-sahayak/cases/:caseId/analyze", async (req, res): Promise<void> => {
  const params = GetFraudCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const started = performance.now();
  const data = snapshot(current);
  const classification = runClassificationAgent(current.incidentDescription ?? "");
  const evidence = await evidenceForCase(current.id);
  const amounts = evidence.flatMap((file) => {
    const match = file.extractedText?.match(/(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d{1,2})?)/i);
    return match?.[1] ? [Number(match[1].replaceAll(",", ""))] : [];
  });
  const conflicts =
    amounts.length && amounts.some((amount) => amount !== Number(current.reportedAmount))
      ? ["One or more uploaded documents show an amount that differs from the reported amount. Confirm before filing."]
      : [];
  const baseAnalysis = runFinancialAnalysisAgent(data, classification, amounts, conflicts);
  let review;
  try {
    review = await runOpenAIFinancialReview(data, classification, conflicts.length);
  } catch {
    await addRun(current.id, "OpenAI Financial Fraud Analysis", "case.analyze",
      "Case review requested; evidence stays local.", "OpenAI review failed.", performance.now() - started, "FAILED");
    res.status(503).json({ error: "OpenAI case review is temporarily unavailable. Please retry." });
    return;
  }
  const analysis = {
    ...baseAnalysis, provider: "openai-compatible" as const,
    patterns: [...baseAnalysis.patterns, review.summary],
    recommendations: [...new Set([...baseAnalysis.recommendations, ...review.questions, ...review.recommendations])],
  };
  await db
    .update(fraudCasesTable)
    .set({
      category: classification.category,
      analysis,
      missingFields: analysis.missingFields,
      status: data.missingFields.length > 0 ? "INFORMATION_REQUIRED" : "ANALYSIS_COMPLETED",
      updatedAt: new Date(),
    })
    .where(eq(fraudCasesTable.id, current.id));
  await addRun(
    current.id,
    "Fraud Classification and Triage",
    "case.analyze",
    current.incidentDescription ?? "No incident description",
    classification.category,
    performance.now() - started,
  );
  await addRun(
    current.id,
    "OpenAI Financial Fraud Analysis",
    "case.analyze",
    `${data.transactions.length} reported transactions; ${evidence.length} evidence file(s).`,
    `Reported ₹${analysis.reportedTotal}; evidence-supported ₹${analysis.evidenceSupportedTotal}.`,
    performance.now() - started,
  );
  res.json(analysis);
});

router.get("/fraud-sahayak/cases/:caseId/complaint", async (req, res): Promise<void> => {
  const params = GetFraudComplaintParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  if (!current.complaint) {
    res.status(404).json({ error: "No complaint draft exists yet." });
    return;
  }
  res.json(current.complaint);
});

router.post("/fraud-sahayak/cases/:caseId/complaint", async (req, res): Promise<void> => {
  const params = GenerateFraudComplaintParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const started = performance.now();
  const data = snapshot(current);
  const evidence = await evidenceForCase(current.id);
  const classification = runClassificationAgent(current.incidentDescription ?? "");
  const existing = current.complaint as FraudComplaint | null;
  if (data.missingFields.length > 0 || !current.analysis) {
    res.status(409).json({
      error: data.missingFields.length > 0
        ? "Complete the required case details before preparing a complaint draft."
        : "Complete the case analysis before preparing a complaint draft.",
      missingFields: data.missingFields,
    });
    return;
  }
  const complaint = runComplaintAgent(
    data,
    evidence.map((item) => item.name),
    classification,
    (existing?.version ?? 0) + 1,
  );
  complaint.sourceFingerprint = caseFingerprint(data);
  await db
    .update(fraudCasesTable)
    .set({ complaint, status: "COMPLAINT_DRAFTED", updatedAt: new Date() })
    .where(eq(fraudCasesTable.id, current.id));
  await addRun(
    current.id,
    "Complaint Preparation",
    "complaint.generate",
    `${data.missingFields.length} missing field(s); ${evidence.length} evidence item(s).`,
    `Created complaint draft version ${complaint.version}; explicit review required.`,
    performance.now() - started,
  );
  res.json(complaint);
});

router.patch("/fraud-sahayak/cases/:caseId/complaint", async (req, res): Promise<void> => {
  const params = UpdateFraudComplaintParams.safeParse(req.params);
  const parsed = UpdateFraudComplaintBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current || !current.complaint) {
    res.status(404).json({ error: "Complaint draft not found." });
    return;
  }
  const old = current.complaint as FraudComplaint;
  const complaint: FraudComplaint = {
    ...old,
    ...parsed.data,
    version: old.version + 1,
    approved: false,
    updatedAt: now(),
  };
  await db
    .update(fraudCasesTable)
    .set({ complaint, status: "USER_REVIEW_REQUIRED", updatedAt: new Date() })
    .where(eq(fraudCasesTable.id, current.id));
  res.json(complaint);
});

router.post("/fraud-sahayak/cases/:caseId/complaint/approve", async (req, res): Promise<void> => {
  const params = GetFraudComplaintParams.safeParse(req.params);
  const parsed = ApproveFraudComplaintBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current || !current.complaint) {
    res.status(404).json({ error: "Complaint draft not found." });
    return;
  }
  if (parsed.data.approved && getMissingFields(snapshot(current)).length > 0) {
    res.status(409).json({ error: "Complete the missing case details before approving this draft." });
    return;
  }
  if (parsed.data.approved && current.complaint.sourceFingerprint !== caseFingerprint(snapshot(current))) {
    res.status(409).json({ error: "Case details changed. Generate and review an updated draft before approving." });
    return;
  }
  const complaint: FraudComplaint = {
    ...(current.complaint as FraudComplaint),
    approved: parsed.data.approved,
    updatedAt: now(),
  };
  const readiness = runReportingAgent(snapshot(current), complaint.approved);
  await db
    .update(fraudCasesTable)
    .set({
      complaint,
      status: parsed.data.approved ? readiness.status : "USER_REVIEW_REQUIRED",
      updatedAt: new Date(),
    })
    .where(eq(fraudCasesTable.id, current.id));
  await db.insert(fraudAuditLogsTable).values({
    id: randomUUID(),
    caseId: current.id,
    eventType: parsed.data.approved ? "complaint.approved" : "complaint.approval_revoked",
    details: { version: complaint.version },
  });
  res.json(complaint);
});

router.get("/fraud-sahayak/cases/:caseId/agents", async (req, res): Promise<void> => {
  const params = GetFraudAgentRunsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await getCase(params.data.caseId, req.userId!))) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const rows = await db
    .select()
    .from(fraudAgentRunsTable)
    .where(eq(fraudAgentRunsTable.caseId, params.data.caseId))
    .orderBy(fraudAgentRunsTable.createdAt);
  res.json(rows.map((row) => ({
    id: row.id,
    agent: row.agent,
    trigger: row.trigger,
    status: row.status as "RUNNING" | "COMPLETED" | "FAILED",
    inputSummary: row.inputSummary,
    outputSummary: row.outputSummary,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
  })));
});

router.post("/fraud-sahayak/cases/:caseId/submission", async (req, res): Promise<void> => {
  const params = PrepareFraudSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const current = await getCase(params.data.caseId, req.userId!);
  if (!current) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const started = performance.now();
  const readiness = runReportingAgent(
    snapshot(current),
    Boolean(current.complaint?.approved && current.complaint.sourceFingerprint === caseFingerprint(snapshot(current))),
  );
  const status = readiness.ready ? "READY_FOR_OFFICIAL_FILING" : readiness.status;
  await db
    .update(fraudCasesTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(fraudCasesTable.id, current.id));
  await addRun(
    current.id,
    "Official Reporting and Case Tracking",
    "submission.prepare",
    `Complaint approval: ${Boolean((current.complaint as FraudComplaint | null)?.approved)}.`,
    `${status}; external portal submission remains user-controlled.`,
    performance.now() - started,
  );
  res.json(readiness);
});

router.post("/fraud-sahayak/cases/:caseId/acknowledgement", async (req, res): Promise<void> => {
  const params = RecordFraudAcknowledgementParams.safeParse(req.params);
  const parsed = RecordFraudAcknowledgementBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(fraudCasesTable)
    .set({
      acknowledgement: parsed.data.reference.trim(),
      status: "USER_REPORTED_FILED",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fraudCasesTable.id, params.data.caseId),
        eq(fraudCasesTable.userId, req.userId!),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  await db.insert(fraudAuditLogsTable).values({
    id: randomUUID(),
    caseId: updated.id,
    eventType: "acknowledgement.user_reported",
    details: { verificationSource: "user-entered" },
  });
  const base = baseCase(updated, (await evidenceForCase(updated.id)).length);
  res.json(base);
});

router.get("/fraud-sahayak/dashboard", async (_req, res): Promise<void> => {
  const [rows, agentRows] = await Promise.all([
    db.select().from(fraudCasesTable).where(eq(fraudCasesTable.userId, _req.userId!)),
    db.select().from(fraudAgentRunsTable),
  ]);
  const caseIds = rows.map((row) => row.id);
  const runs = caseIds.length
    ? agentRows.filter((run) => caseIds.includes(run.caseId))
    : [];
  res.json({
    totalCases: rows.length,
    awaitingInformation: rows.filter((row) => row.status === "INFORMATION_REQUIRED").length,
    analyzed: rows.filter((row) => row.analysis !== null).length,
    complaintsPrepared: rows.filter((row) => row.complaint !== null).length,
    readyForFiling: rows.filter((row) => row.status === "READY_FOR_OFFICIAL_FILING").length,
    userReportedFiled: rows.filter((row) => row.status === "USER_REPORTED_FILED").length,
    verifiedFiled: rows.filter((row) => row.status === "OFFICIALLY_SUBMITTED_VERIFIED").length,
    agentFailures: runs.filter((run) => run.status === "FAILED").length,
  });
});

router.get("/fraud-sahayak/cases/:caseId/export/json", async (req, res): Promise<void> => {
  const params = GetFraudCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await getCase(params.data.caseId, req.userId!);
  if (!row) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.setHeader("Content-Disposition", `attachment; filename="fraud-sahayak-${row.id}.json"`);
  res.json(await detailForCase(row));
});

router.get("/fraud-sahayak/cases/:caseId/export/pdf", async (req, res): Promise<void> => {
  const params = GetFraudCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await getCase(params.data.caseId, req.userId!);
  if (!row?.complaint) {
    res.status(row ? 409 : 404).json({ error: row ? "Generate a complaint draft first." : "Case not found" });
    return;
  }
  const complaint = row.complaint as FraudComplaint;
  res.status(200);
  res.type("application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="fraud-sahayak-${row.id}.pdf"`,
  );
  const pdf = new PDFDocument({ size: "A4", margin: 52, info: { Title: complaint.title } });
  pdf.pipe(res);
  pdf.fillColor("#9c3f26").fontSize(10).text(
    "DRAFT PREPARED BY FRAUD SAHAYAK — NOT AN OFFICIAL FILING OR GOVERNMENT DOCUMENT",
  );
  pdf.moveDown(1.5);
  pdf.fillColor("#173c39").fontSize(20).text(complaint.title, { align: "left" });
  pdf.moveDown(0.5);
  pdf.fillColor("#536361").fontSize(10).text(`Local case ID: ${row.id}`);
  pdf.moveDown(1.5);
  pdf.fillColor("#202b29").fontSize(11).text(complaint.narrative, {
    lineGap: 5,
    paragraphGap: 7,
  });
  pdf.moveDown(1.5);
  pdf.fillColor("#173c39").fontSize(14).text("Transaction schedule");
  pdf.moveDown(0.4);
  for (const transaction of complaint.transactionSchedule) {
    pdf.fillColor("#202b29").fontSize(10).text(
      `₹${transaction.amount.toLocaleString("en-IN")} — ${transaction.date ?? "date not supplied"} — ${transaction.bank ?? "provider not supplied"} — reference: ${transaction.reference ?? "not supplied"} — source: ${transaction.source}`,
    );
  }
  pdf.moveDown(1);
  pdf.fillColor("#173c39").fontSize(14).text("Evidence index");
  pdf.moveDown(0.4);
  for (const name of complaint.evidenceIndex) {
    pdf.fillColor("#202b29").fontSize(10).text(`• ${name}`);
  }
  pdf.addPage();
  pdf.fillColor("#173c39").fontSize(16).text("Official portal filing instructions");
  pdf.moveDown().fontSize(10).fillColor("#202b29").text(`Suggested portal category: ${categoryGuide(row.category).portalMapping}`);
  if (row.complaint.sourceFingerprint !== caseFingerprint(snapshot(row))) {
    pdf.moveDown().fillColor("#9c3f26").text("WARNING: This earlier draft does not match the latest recorded case details. Regenerate and review it before filing.");
  }
  for (const step of guidance.filingSteps) pdf.moveDown().fillColor("#202b29").fontSize(10).text(step);
  pdf.moveDown().fontSize(10).text(`Guidance reviewed: ${guidance.reviewedOn}. Scenario questions are application recommendations, not a verified live government form.`);
  for (const source of guidance.sources) pdf.moveDown(0.4).fontSize(8).text(`${source.title}: ${source.url}`);
  pdf.moveDown(1);
  pdf.fillColor("#536361").fontSize(9).text(
    `Official portal: ${PORTAL}\nFinancial cyber fraud helpline: ${HELPLINE}\nReview all details and submit through the official portal yourself. This application does not file complaints.`,
  );
  pdf.end();
});

export default router;
