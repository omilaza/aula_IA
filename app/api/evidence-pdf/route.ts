import { getDb } from "../../../db";
import {
  attendance,
  exitTickets,
  labEvidence,
  levelingRecords,
  sessionFiveEvidence,
  sessionFourEvidence,
  sessionSixEvidence,
  sessionThreeEvidence,
  sessionTwoEvidence,
} from "../../../db/schema";
import {
  buildEvidencePdf,
  readableJson,
  type EvidencePdfDocument,
  type EvidenceSession,
  verifyPdfAccessCode,
} from "../../evidence-pdf-server";

const sessions = new Set<EvidenceSession>(["S1", "S2", "S3", "S4", "S5P", "S5", "S6"]);
export const primaryEvidenceSessions = ["S1", "S2", "S3", "S4", "S5"] as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genericError = "No fue posible recuperar el comprobante. Revisa el correo, la sesión y el código de descarga más reciente.";

type JsonRecord = Record<string, unknown>;

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: unknown) {
  return clean(value, 180).toLowerCase();
}

function participantFields(row: typeof attendance.$inferSelect | undefined, fallbackName: string, email: string) {
  return [
    { label: "Nombre", value: row?.fullName || fallbackName },
    { label: "Correo", value: email },
    { label: "Institución", value: row?.institution },
    { label: "Función", value: row?.role },
  ];
}

async function attendanceFor(email: string, session: EvidenceSession) {
  const db = getDb();
  const [row] = await db.find(attendance, { email, session }, { limit: 1 });
  return row;
}

async function sessionOneDocument(email: string) {
  const db = getDb();
  const [exit] = await db.find(exitTickets, { email, session: "S1" }, { limit: 1 });
  if (!exit) return null;
  const [lab, participant] = await Promise.all([
    db.find(labEvidence, { email, session: "S1" }, { limit: 1 }),
    attendanceFor(email, "S1"),
  ]);
  const evidence = lab[0];
  if (!evidence) return null;
  const document: EvidencePdfDocument = {
    session: "S1",
    title: "Sesión 1 · Evidencia de trabajo con contexto",
    savedAt: exit.createdAt,
    confirmationCode: exit.evidenceCode,
    participant: participantFields(participant, participant?.fullName || "", email),
    sections: [
      {
        title: "Laboratorio",
        fields: [
          { label: "Ruta", value: evidence.route },
          { label: "Caso", value: evidence.caseKey },
          { label: "Contexto", value: readableJson(evidence.contextJson) },
          { label: "Prompt inicial", value: evidence.promptV1 },
          { label: "Prompt revisado", value: evidence.promptV2 },
          { label: "Respuesta inicial", value: evidence.responseV1 },
          { label: "Respuesta revisada", value: evidence.responseV2 },
          { label: "Revisión", value: evidence.review },
          { label: "Lista de cotejo", value: readableJson(evidence.checklistJson) },
          { label: "Código de laboratorio", value: evidence.evidenceCode },
        ],
      },
      {
        title: "Evidencia de salida",
        fields: [
          { label: "Aprendizaje", value: readableJson(exit.learning) },
          { label: "Aplicación y revisión", value: readableJson(exit.application) },
          { label: "Vinculación", value: readableJson(exit.remainingQuestion) },
          { label: "Confianza declarada", value: exit.confidence },
        ],
      },
    ],
  };
  return document;
}

async function sessionTwoDocument(email: string) {
  const db = getDb();
  const [evidence] = await db.find(
    sessionTwoEvidence,
    { email, session: "S2", route: "principal", activity: "evidencia-principal" },
    { limit: 1 },
  );
  if (!evidence) return null;
  const participant = await attendanceFor(email, "S2");
  return {
    session: "S2",
    title: "Sesión 2 · Evidencia principal",
    savedAt: evidence.updatedAt,
    confirmationCode: evidence.confirmationCode,
    participant: [
      ...participantFields(participant, evidence.fullName, email),
      { label: "Identificador", value: evidence.participantId },
      { label: "Intento / versión", value: `${evidence.attempt} / ${evidence.responseVersion}` },
      { label: "Estado", value: evidence.status },
    ],
    sections: [
      {
        title: "Producto y contexto",
        fields: [
          { label: "Título", value: evidence.productTitle },
          { label: "Propósito", value: evidence.purpose },
          { label: "Contexto pedagógico", value: evidence.pedagogicalContext },
          { label: "Fuentes", value: evidence.sources },
        ],
      },
      {
        title: "Proceso con IA y decisión docente",
        fields: [
          { label: "Prompt", value: evidence.prompt },
          { label: "Resultado de IA o contingencia", value: evidence.aiResult },
          { label: "Revisión docente", value: evidence.teacherReview },
          { label: "Riesgo detectado", value: evidence.detectedRisk },
          { label: "Ajuste", value: evidence.adjustment },
          { label: "Lista de cotejo", value: readableJson(evidence.checklistJson) },
        ],
      },
    ],
  } satisfies EvidencePdfDocument;
}

async function sessionThreeDocument(email: string) {
  const db = getDb();
  const [evidence] = await db.find(
    sessionThreeEvidence,
    { email, session: "S3", route: "principal", activity: "evidencia-principal" },
    { limit: 1 },
  );
  if (!evidence) return null;
  const participant = await attendanceFor(email, "S3");
  return {
    session: "S3",
    title: "Sesión 3 · Evidencia de secuencia didáctica",
    savedAt: evidence.updatedAt,
    confirmationCode: evidence.confirmationCode,
    participant: [
      ...participantFields(participant, evidence.fullName, email),
      { label: "Identificador", value: evidence.participantId },
      { label: "Intento / versión", value: `${evidence.attempt} / ${evidence.responseVersion}` },
      { label: "Estado", value: evidence.status },
    ],
    sections: [
      {
        title: "Diseño contextualizado",
        fields: [
          { label: "Título", value: evidence.sequenceTitle },
          { label: "Nivel educativo", value: evidence.educationalLevel },
          { label: "Asignatura", value: evidence.subject },
          { label: "Dificultad", value: evidence.difficultyLevel },
          { label: "Propósito", value: evidence.purpose },
          { label: "Contexto", value: evidence.pedagogicalContext },
          { label: "Fuentes", value: evidence.sources },
        ],
      },
      {
        title: "Proceso, revisión y ajuste",
        fields: [
          { label: "Prompt", value: evidence.prompt },
          { label: "Borrador de IA", value: evidence.aiDraft },
          { label: "Secuencia de actividades", value: evidence.activitySequence },
          { label: "Evidencia de aprendizaje", value: evidence.assessmentEvidence },
          { label: "Revisión docente", value: evidence.teacherReview },
          { label: "Riesgo", value: evidence.detectedRisk },
          { label: "Adaptación", value: evidence.adaptation },
          { label: "Ajuste", value: evidence.adjustment },
          { label: "Lista de cotejo", value: readableJson(evidence.checklistJson) },
        ],
      },
    ],
  } satisfies EvidencePdfDocument;
}

async function sessionFourDocument(email: string) {
  const db = getDb();
  const [evidence] = await db.find(
    sessionFourEvidence,
    { email, session: "S4", route: "principal", activity: "evidencia-principal" },
    { limit: 1 },
  );
  if (!evidence) return null;
  const participant = await attendanceFor(email, "S4");
  return {
    session: "S4",
    title: "Sesión 4 · Evaluación y retroalimentación con IA",
    savedAt: evidence.updatedAt,
    confirmationCode: evidence.confirmationCode,
    participant: [
      ...participantFields(participant, evidence.fullName, email),
      { label: "Identificador", value: evidence.participantId },
      { label: "Intento / versión", value: `${evidence.attempt} / ${evidence.responseVersion}` },
      { label: "Estado", value: evidence.status },
    ],
    sections: [
      {
        title: "Referencia pedagógica",
        fields: [
          { label: "Título", value: evidence.evaluationTitle },
          { label: "Caso", value: evidence.caseKey },
          { label: "Nivel educativo", value: evidence.educationalLevel },
          { label: "Asignatura", value: evidence.subject },
          { label: "Dificultad", value: evidence.difficultyLevel },
          { label: "Momento de evaluación", value: evidence.evaluationMoment },
          { label: "Propósito", value: evidence.learningPurpose },
          { label: "Contexto", value: evidence.pedagogicalContext },
          { label: "Fuente o caso", value: evidence.sourceCase },
          { label: "Criterios e indicadores", value: evidence.criteriaIndicators },
        ],
      },
      {
        title: "Proceso, retroalimentación y decisión",
        fields: [
          { label: "Prompt", value: evidence.prompt },
          { label: "Borrador de IA o contingencia", value: evidence.aiDraft },
          { label: "Análisis de evidencia", value: evidence.evidenceAnalysis },
          { label: "Retroalimentación final", value: evidence.generatedFeedback },
          { label: "Revisión docente", value: evidence.teacherReview },
          { label: "Riesgo o sesgo", value: evidence.detectedRisk },
          { label: "Adaptación", value: evidence.adaptation },
          { label: "Decisión final y seguimiento", value: evidence.finalDecision },
          { label: "Lista de cotejo", value: readableJson(evidence.checklistJson) },
        ],
      },
    ],
  } satisfies EvidencePdfDocument;
}

async function sessionFivePreparationDocument(email: string) {
  const db = getDb();
  const [evidence] = await db.find(
    levelingRecords,
    { email, session: "S5", route: "preparatoria", activity: "nivelacion-instrumentos" },
    { limit: 1 },
  );
  if (!evidence) return null;
  return {
    session: "S5P",
    title: "Sesión 5 · Comprobante de preparación",
    savedAt: evidence.updatedAt,
    confirmationCode: evidence.confirmationCode,
    participant: [
      { label: "Nombre", value: evidence.fullName },
      { label: "Correo", value: email },
      { label: "Institución", value: evidence.institution },
      { label: "Función", value: evidence.role },
      { label: "Identificador", value: evidence.participantId },
      { label: "Intento / versión", value: `${evidence.attempt} / ${evidence.responseVersion}` },
      { label: "Estado", value: evidence.status },
    ],
    sections: [
      {
        title: "Nivelación de instrumentos",
        fields: [
          { label: "Ruta", value: evidence.route },
          { label: "Actividad", value: evidence.activity },
          { label: "Tipo de evidencia", value: evidence.evidenceType },
          { label: "Recorrido registrado", value: readableJson(evidence.responseJson) },
          { label: "Resultado", value: evidence.result },
        ],
      },
    ],
  } satisfies EvidencePdfDocument;
}

async function sessionFiveDocument(email: string) {
  const db = getDb();
  const [evidence] = await db.find(
    sessionFiveEvidence,
    { email, session: "S5", route: "principal", activity: "evidencia-principal" },
    { limit: 1 },
  );
  if (!evidence) return null;
  const participant = await attendanceFor(email, "S5");
  return {
    session: "S5",
    title: "Sesión 5 · Instrumentos y análisis de evidencias",
    savedAt: evidence.updatedAt,
    confirmationCode: evidence.confirmationCode,
    participant: [
      ...participantFields(participant, evidence.fullName, email),
      { label: "Identificador", value: evidence.participantId },
      { label: "Intento / versión", value: `${evidence.attempt} / ${evidence.responseVersion}` },
      { label: "Estado", value: evidence.status },
    ],
    sections: [
      {
        title: "Secuencia e instrumento",
        fields: [
          { label: "Clave de secuencia", value: evidence.sequenceKey },
          { label: "Título", value: evidence.sequenceTitle },
          { label: "Nivel educativo", value: evidence.educationalLevel },
          { label: "Asignatura", value: evidence.subject },
          { label: "Dificultad", value: evidence.difficultyLevel },
          { label: "Tipo de instrumento", value: evidence.instrumentType },
          { label: "Propósito de aprendizaje", value: evidence.learningPurpose },
          { label: "Contexto pedagógico", value: evidence.pedagogicalContext },
          { label: "Caso o fuente", value: evidence.sourceCase },
          { label: "Diseño del instrumento", value: evidence.instrumentDesign },
          { label: "Criterios y descriptores", value: evidence.criteriaDescriptors },
          { label: "Prompt conservado", value: evidence.prompt },
        ],
      },
      {
        title: "Análisis y decisión docente",
        fields: [
          { label: "Borrador de IA o contingencia", value: evidence.aiDraft },
          { label: "Resumen del conjunto de datos", value: evidence.datasetSummary },
          { label: "Hallazgos", value: evidence.findings },
          { label: "Comparación entre grupos", value: evidence.groupComparison },
          { label: "Decisión docente", value: evidence.teacherDecision },
          { label: "Limitaciones", value: evidence.limitations },
          { label: "Adaptación", value: evidence.adaptation },
          { label: "Lista de cotejo", value: readableJson(evidence.checklistJson) },
        ],
      },
    ],
  } satisfies EvidencePdfDocument;
}

async function sessionSixDocument(email: string) {
  const db = getDb();
  const [evidence] = await db.find(
    sessionSixEvidence,
    { email, session: "S6", activity: "evidencia-principal" },
    { orderBy: "updatedAt", descending: true, limit: 1 },
  );
  if (!evidence) return null;
  const participant = await attendanceFor(email, "S6");
  return {
    session: "S6",
    title: "Sesión 6 · Proyecto didáctico integrado AULA-IA",
    savedAt: evidence.updatedAt,
    confirmationCode: evidence.confirmationCode,
    participant: [
      ...participantFields(participant, evidence.fullName, email),
      { label: "Identificador", value: evidence.participantId },
      { label: "Ruta", value: evidence.route },
      { label: "Intento / versión", value: `${evidence.attempt} / ${evidence.responseVersion}` },
      { label: "Estado", value: evidence.status },
    ],
    sections: [
      {
        title: "Necesidad y diseño contextualizado",
        fields: [
          { label: "Título del proyecto", value: evidence.projectTitle },
          { label: "Necesidad docente", value: evidence.teachingNeed },
          { label: "Nivel educativo", value: evidence.educationalLevel },
          { label: "Asignatura", value: evidence.subject },
          { label: "Contexto pedagógico", value: evidence.pedagogicalContext },
          { label: "Propósito de aprendizaje", value: evidence.learningPurpose },
          { label: "Fuentes y trazabilidad", value: evidence.sourceTraceability },
          { label: "Prompt contextualizado y revisado", value: evidence.prompt },
        ],
      },
      {
        title: "Secuencia, evaluación y decisión docente",
        fields: [
          { label: "Secuencia de actividades", value: evidence.activitySequence },
          { label: "Evidencia esperada", value: evidence.assessmentEvidence },
          { label: "Instrumento y criterios", value: evidence.instrumentCriteria },
          { label: "Análisis, datos faltantes y límites", value: evidence.analysisLimits },
          { label: "Decisión docente", value: evidence.teacherDecision },
          { label: "Nueva evidencia de seguimiento", value: evidence.followUpEvidence },
          { label: "Adaptación o apoyo", value: evidence.adaptation },
        ],
      },
      {
        title: "Revisión profesional y transferencia",
        fields: [
          { label: "Aporte de la IA", value: evidence.aiContribution },
          { label: "Revisión y cambios docentes", value: evidence.teacherReview },
          { label: "Primer paso de implementación", value: evidence.implementationStep },
          { label: "Lista de verificación", value: readableJson(evidence.checklistJson) },
        ],
      },
    ],
  } satisfies EvidencePdfDocument;
}

export async function loadEvidenceDocument(session: EvidenceSession, email: string) {
  if (session === "S1") return sessionOneDocument(email);
  if (session === "S2") return sessionTwoDocument(email);
  if (session === "S3") return sessionThreeDocument(email);
  if (session === "S4") return sessionFourDocument(email);
  if (session === "S5P") return sessionFivePreparationDocument(email);
  if (session === "S5") return sessionFiveDocument(email);
  if (session === "S6") return sessionSixDocument(email);
  return null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 8_192) return Response.json({ error: genericError }, { status: 413 });

  let payload: JsonRecord;
  try {
    payload = (await request.json()) as JsonRecord;
  } catch {
    return Response.json({ error: genericError }, { status: 400 });
  }
  const session = clean(payload.session, 3).toUpperCase() as EvidenceSession;
  const email = normalizeEmail(payload.email);
  const code = clean(payload.code, 100);
  if (!sessions.has(session) || !emailPattern.test(email) || !/^PDF(?:[1-6]|5P)-[A-Za-z0-9_-]{40,60}$/.test(code)) {
    return Response.json({ error: genericError }, { status: 400 });
  }

  try {
    const document = await loadEvidenceDocument(session, email);
    if (!document || !(await verifyPdfAccessCode(session, email, document.confirmationCode, code))) {
      return Response.json({ error: genericError }, { status: 403 });
    }
    const pdf = buildEvidencePdf(document);
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="AULA-IA_${session}_Evidencia.pdf"`,
        "Cache-Control": "private, no-store",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return Response.json({ error: genericError }, { status: 500 });
  }
}
