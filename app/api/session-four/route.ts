import { getDb, increment, currentTimestamp } from "../../../db";
import { attendance, levelingRecords, sessionFourEvidence } from "../../../db/schema";
import { cases, difficultyEvidenceChecklist } from "../../session-four-data";

import { createPdfAccessCode } from "../../evidence-pdf-server";

const SESSION = "S4";
const PREPARATORY_ROUTE = "preparatoria";
const MAIN_ROUTE = "principal";
const LEVELING_ATTENDANCE_ACTIVITY = "registro-entrada";
const MAIN_EVIDENCE_ACTIVITY = "evidencia-principal";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const activityPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const difficultyLevels = new Set(["basico", "intermedio", "avanzado"]);
const evaluationMoments = new Set(["diagnostica", "formativa", "sumativa"]);

type JsonRecord = Record<string, unknown>;

function clean(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: unknown) {
  return clean(value, 180).toLowerCase();
}

function confirmationCode(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedJson(value: unknown, max = 30_000) {
  if (!isRecord(value) || Object.keys(value).length === 0) return null;
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 0 && serialized.length <= max ? serialized : null;
  } catch {
    return null;
  }
}

function normalizeChecklist(value: unknown) {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value)
    .slice(0, 25)
    .map(([key, item]) => [clean(key, 240), item] as const)
    .filter(([key]) => Boolean(key));
  if (entries.length < 6) return null;
  const checklist = Object.fromEntries(
    entries.map(([key, item]) => {
      const normalized = item === true || ["si", "sí", "yes", "true"].includes(clean(item, 12).toLowerCase());
      return [key, normalized];
    }),
  );
  return {
    checklist,
    achieved: Object.values(checklist).filter(Boolean).length,
    total: entries.length,
  };
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  if (message.includes("no such table")) {
    return "La Sesión 4 todavía está en preparación. Tus datos no se enviaron; conserva esta página abierta e inténtalo después de la publicación.";
  }
  return "No fue posible guardar tu respuesta. Verifica tu conexión e inténtalo nuevamente. El texto visible permanece en el formulario.";
}

async function participantIdFor(email: string) {
  const db = getDb();
  const [leveling] = await db.find(levelingRecords, { email, session: SESSION }, { columns: ["participantId"], limit: 1 });
  return leveling?.participantId || confirmationCode("PAR");
}

export async function GET() {
  return Response.json({
    ok: true,
    session: SESSION,
    actions: ["leveling_attendance", "leveling_activity", "s4_main_attendance", "s4_evidence"],
  });
}

export async function POST(request: Request) {
  let payload: JsonRecord;
  try {
    payload = (await request.json()) as JsonRecord;
  } catch {
    return Response.json(
      { error: "No pudimos leer el formulario. Recarga la página e inténtalo nuevamente; conserva antes cualquier texto que hayas escrito." },
      { status: 400 },
    );
  }

  const action = clean(payload.action, 50);

  try {
    const db = getDb();

    if (action === "leveling_attendance") {
      const email = normalizeEmail(payload.email);
      const fullName = clean(payload.fullName, 160);
      const institution = clean(payload.institution, 180);
      const role = clean(payload.role, 80);
      const consent = payload.consent === true;
      if (!emailPattern.test(email) || !fullName || !institution || !role || !consent) {
        return Response.json(
          { error: "Completa nombre, correo, institución y función, y acepta el aviso de privacidad para registrar tu entrada a la preparación." },
          { status: 400 },
        );
      }

      const [existing] = await db.find(levelingRecords, { email, session: SESSION, route: PREPARATORY_ROUTE, activity: LEVELING_ATTENDANCE_ACTIVITY }, { columns: ["participantId"], limit: 1 });
      const participantId = existing?.participantId || (await participantIdFor(email));
      const code = confirmationCode("NP4");
      const responseJson = JSON.stringify({ consent: true });

      await db.upsert(
        levelingRecords,
        {
          participantId,
          fullName,
          email,
          institution,
          role,
          session: SESSION,
          route: PREPARATORY_ROUTE,
          activity: LEVELING_ATTENDANCE_ACTIVITY,
          evidenceType: "asistencia",
          responseJson,
          result: "Entrada registrada",
          status: "completado",
          confirmationCode: code,
        },
        {
          fullName,
          institution,
          role,
          responseJson,
          result: "Entrada registrada",
          attempt: increment(1),
          responseVersion: increment(1),
          status: "completado",
          confirmationCode: code,
          updatedAt: currentTimestamp,
        },
      );

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          message: "Tu entrada a la preparación de la Sesión 4 fue registrada. Al terminar, regístrate también en la sesión principal.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "leveling_activity") {
      const email = normalizeEmail(payload.email);
      const activity = clean(payload.activity, 60).toLowerCase();
      const evidenceType = clean(payload.evidenceType, 60) || "practica-guiada";
      const responseJson = boundedJson(payload.response);
      const result = clean(payload.result, 800);
      const completed = payload.completed !== false;
      if (!emailPattern.test(email) || !activityPattern.test(activity) || activity === LEVELING_ATTENDANCE_ACTIVITY || !responseJson) {
        return Response.json(
          { error: "Escribe tu correo y completa la actividad antes de guardarla. Tus respuestas visibles permanecen en el formulario." },
          { status: 400 },
        );
      }

      const [registration] = await db.find(levelingRecords, { email, session: SESSION, route: PREPARATORY_ROUTE, activity: LEVELING_ATTENDANCE_ACTIVITY }, { columns: ["participantId", "fullName", "institution", "role"], limit: 1 });
      if (!registration) {
        return Response.json(
          { error: "Primero registra tu entrada a la preparación con este mismo correo. Después podrás guardar la actividad." },
          { status: 400 },
        );
      }

      const [existing] = await db.find(levelingRecords, { email, session: SESSION, route: PREPARATORY_ROUTE, activity }, { columns: ["id"], limit: 1 });
      const code = confirmationCode("ACT4");
      const status = completed ? "completado" : "en_progreso";

      await db.upsert(
        levelingRecords,
        {
          participantId: registration.participantId,
          fullName: registration.fullName,
          email,
          institution: registration.institution,
          role: registration.role,
          session: SESSION,
          route: PREPARATORY_ROUTE,
          activity,
          evidenceType,
          responseJson,
          result,
          status,
          confirmationCode: code,
        },
        {
          evidenceType,
          responseJson,
          result,
          attempt: increment(1),
          responseVersion: increment(1),
          status,
          confirmationCode: code,
          updatedAt: currentTimestamp,
        },
      );

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          status,
          message: completed ? "Actividad completada. Tu preparación fue registrada y ya puedes continuar." : "Tu avance fue guardado.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "s4_main_attendance") {
      const email = normalizeEmail(payload.email);
      const fullName = clean(payload.fullName, 160);
      const institution = clean(payload.institution, 180);
      const role = clean(payload.role, 80);
      const consent = payload.consent === true;
      if (!emailPattern.test(email) || !fullName || !institution || !role || !consent) {
        return Response.json(
          { error: "Completa los campos obligatorios y acepta el aviso de privacidad para registrar tu asistencia a la sesión principal." },
          { status: 400 },
        );
      }

      const [existing] = await db.find(attendance, { email, session: SESSION }, { columns: ["id"], limit: 1 });
      const code = confirmationCode("AS4");

      await db.upsert(attendance, { email, fullName, institution, role, session: SESSION, consent, confirmationCode: code }, { fullName, institution, role, consent, confirmationCode: code, createdAt: currentTimestamp });

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          message: "Tu asistencia a la Sesión 4 principal fue registrada correctamente.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "s4_evidence") {
      const email = normalizeEmail(payload.email);
      const caseKey = clean(payload.caseKey, 30).toLowerCase();
      const evaluationTitle = clean(payload.evaluationTitle, 300);
      const educationalLevel = clean(payload.educationalLevel, 80);
      const subject = clean(payload.subject, 120);
      const difficultyLevel = clean(payload.difficultyLevel, 30).toLowerCase();
      const learningPurpose = clean(payload.learningPurpose, 3_000);
      const evaluationMoment = clean(payload.evaluationMoment, 30).toLowerCase();
      const pedagogicalContext = clean(payload.pedagogicalContext, 5_000);
      const sourceCase = clean(payload.sourceCase, 5_000);
      const criteriaIndicators = clean(payload.criteriaIndicators, 7_000);
      const prompt = clean(payload.prompt, 14_000);
      const aiDraft = clean(payload.aiDraft, 18_000);
      const evidenceAnalysis = clean(payload.evidenceAnalysis, 9_000);
      const generatedFeedback = clean(payload.generatedFeedback, 9_000);
      const teacherReview = clean(payload.teacherReview, 8_000);
      const detectedRisk = clean(payload.detectedRisk, 5_000);
      const adaptation = clean(payload.adaptation, 6_000);
      const finalDecision = clean(payload.finalDecision, 7_000);
      const checklistResult = normalizeChecklist(payload.checklist);

      if (!emailPattern.test(email)) {
        return Response.json({ error: "Escribe el mismo correo que utilizaste para registrar tu asistencia principal." }, { status: 400 });
      }

      const selectedCase = cases.find((item) => item.key === caseKey);
      if (!selectedCase || selectedCase.level !== educationalLevel || selectedCase.subject !== subject) {
        return Response.json(
          { error: "Selecciona nuevamente el caso. El nivel educativo, la asignatura y la evidencia deben corresponder a la misma ruta." },
          { status: 400 },
        );
      }
      if (!difficultyLevels.has(difficultyLevel)) {
        return Response.json({ error: "Selecciona una ruta de dificultad: básica, intermedia o avanzada. No necesitas completar las tres." }, { status: 400 });
      }
      if (!evaluationMoments.has(evaluationMoment)) {
        return Response.json({ error: "Selecciona el momento de evaluación: diagnóstica, formativa o sumativa." }, { status: 400 });
      }
      const criticalFields: Array<readonly [string, string, number]> = [
        ["Criterios e indicadores", criteriaIndicators, 30],
        ["Prompt principal", prompt, 80],
        ["Borrador de IA o contingencia", aiDraft, 30],
        ["Análisis de evidencia e inferencias", evidenceAnalysis, 40],
        ["Retroalimentación final", generatedFeedback, 60],
        ["Revisión docente del borrador", teacherReview, 30],
        ["Riesgo, sesgo o afirmación no sustentada", detectedRisk, 20],
        ["Adaptación o apoyo", adaptation, 20],
        ["Decisión final y ajuste realizado", finalDecision, 30],
      ];
      const missingCriticalFields = criticalFields.filter(([, value, minimum]) => value.length < minimum).map(([label]) => label);
      if (missingCriticalFields.length) {
        return Response.json(
          { error: `No podemos acreditar todavía. Revisa estos campos críticos: ${missingCriticalFields.join("; ")}.`, fields: missingCriticalFields },
          { status: 400 },
        );
      }

      const selectedDifficultyChecklist = difficultyEvidenceChecklist[
        difficultyLevel as keyof typeof difficultyEvidenceChecklist
      ];
      const missingChecklistItems = selectedDifficultyChecklist.filter((item) => checklistResult?.checklist[item] !== true);
      if (!checklistResult || checklistResult.total !== selectedDifficultyChecklist.length || missingChecklistItems.length) {
        const difficultyLabel = difficultyLevel === "basico" ? "Básica" : difficultyLevel === "intermedio" ? "Intermedia" : "Avanzada";
        return Response.json(
          { error: `No podemos acreditar todavía. Ruta ${difficultyLabel}: completa exactamente ${selectedDifficultyChecklist.length} casillas. Pendientes: ${missingChecklistItems.length ? missingChecklistItems.join("; ") : "la lista enviada no corresponde a esta ruta"}.`, fields: missingChecklistItems },
          { status: 400 },
        );
      }

      const [mainAttendance] = await db.find(attendance, { email, session: SESSION }, { columns: ["fullName"], limit: 1 });
      if (!mainAttendance) {
        return Response.json(
          { error: "Primero registra tu asistencia a la Sesión 4 principal con este mismo correo. Después podrás enviar la evidencia acreditable." },
          { status: 400 },
        );
      }

      const [existing] = await db.find(sessionFourEvidence, { email, session: SESSION, route: MAIN_ROUTE, activity: MAIN_EVIDENCE_ACTIVITY }, { columns: ["participantId"], limit: 1 });
      const participantId = existing?.participantId || (await participantIdFor(email));
      const code = confirmationCode("EV4");
      const checklistJson = JSON.stringify(checklistResult.checklist);

      await db.upsert(
        sessionFourEvidence,
        {
          participantId,
          fullName: mainAttendance.fullName,
          email,
          session: SESSION,
          route: MAIN_ROUTE,
          activity: MAIN_EVIDENCE_ACTIVITY,
          caseKey,
          evaluationTitle,
          educationalLevel,
          subject,
          difficultyLevel,
          learningPurpose,
          evaluationMoment,
          pedagogicalContext,
          sourceCase,
          criteriaIndicators,
          prompt,
          aiDraft,
          evidenceAnalysis,
          generatedFeedback,
          teacherReview,
          detectedRisk,
          adaptation,
          finalDecision,
          checklistJson,
          status: "recibida",
          confirmationCode: code,
        },
        {
          fullName: mainAttendance.fullName,
          caseKey,
          evaluationTitle,
          educationalLevel,
          subject,
          difficultyLevel,
          learningPurpose,
          evaluationMoment,
          pedagogicalContext,
          sourceCase,
          criteriaIndicators,
          prompt,
          aiDraft,
          evidenceAnalysis,
          generatedFeedback,
          teacherReview,
          detectedRisk,
          adaptation,
          finalDecision,
          checklistJson,
          attempt: increment(1),
          responseVersion: increment(1),
          status: "recibida",
          confirmationCode: code,
          updatedAt: currentTimestamp,
        },
      );

      const pdfAccessCode = await createPdfAccessCode("S4", email, code);

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          pdfAccessCode,
          message: "Tu evidencia de la Sesión 4 fue guardada correctamente. El registro incluye criterios, análisis, retroalimentación y decisión docente.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    return Response.json(
      { error: "La actividad indicada no corresponde a la Sesión 4. Regresa a la sección anterior e inténtalo nuevamente." },
      { status: 400 },
    );
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
