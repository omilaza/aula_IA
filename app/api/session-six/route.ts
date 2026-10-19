import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { attendance, sessionSixEvidence } from "../../../db/schema";
import { createPdfAccessCode } from "../../evidence-pdf-server";

const SESSION = "S6";
const MAIN_ACTIVITY = "evidencia-principal";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const routes = new Set(["basica", "intermedia", "avanzada"]);

const checklistItems = [
  { key: "context_alignment", label: "La necesidad, el contexto y el propósito se corresponden." },
  { key: "source_traceability", label: "Las fuentes están identificadas y se distingue lo que debe verificarse." },
  { key: "sequence_coherence", label: "La secuencia conecta propósito, actividades y condiciones reales." },
  { key: "evidence_alignment", label: "La evidencia esperada permite observar el aprendizaje propuesto." },
  { key: "instrument_alignment", label: "El instrumento y los criterios valoran esa evidencia, no otra." },
  { key: "data_limits", label: "La lectura de datos declara límites, faltantes y lo que no permite afirmar." },
  { key: "teacher_decision", label: "La decisión docente está justificada y puede verificarse con seguimiento." },
  { key: "inclusion_follow_up", label: "La propuesta incluye una adaptación y una nueva evidencia de seguimiento." },
] as const;

type JsonRecord = Record<string, unknown>;

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: unknown) {
  return clean(value, 180).toLowerCase();
}

function confirmationCode(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function checklistInput(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeChecklist(value: unknown) {
  const parsed = checklistInput(value);
  if (!isRecord(parsed)) return null;

  const checklist = Object.fromEntries(
    checklistItems.map(({ key }) => {
      const item = parsed[key];
      const checked =
        item === true ||
        ["si", "sí", "yes", "true"].includes(clean(item, 12).toLowerCase());
      return [key, checked];
    }),
  ) as Record<(typeof checklistItems)[number]["key"], boolean>;

  const missing = checklistItems.filter(({ key }) => !checklist[key]);
  return { checklist, missing };
}

function missingWrittenFields(fields: ReadonlyArray<readonly [string, string]>) {
  return fields.filter(([, value]) => !value.trim()).map(([label]) => label);
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  if (message.includes("no such table")) {
    return "La Sesión 6 todavía no está preparada para recibir evidencias. Tus datos no se guardaron.";
  }
  return "No fue posible guardar tu respuesta. El contenido visible permanece en el formulario; inténtalo nuevamente.";
}

async function participantIdFor(email: string) {
  const db = getDb();
  const [evidence] = await db
    .select({ participantId: sessionSixEvidence.participantId })
    .from(sessionSixEvidence)
    .where(and(eq(sessionSixEvidence.email, email), eq(sessionSixEvidence.session, SESSION)))
    .limit(1);
  return evidence?.participantId || confirmationCode("PAR");
}

export async function GET() {
  return Response.json({
    ok: true,
    session: SESSION,
    actions: ["attendance", "evidence"],
    routes: [...routes],
    checklistItems,
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 160_000) {
    return Response.json({ error: "El formulario supera el tamaño permitido." }, { status: 413 });
  }

  let payload: JsonRecord;
  try {
    payload = (await request.json()) as JsonRecord;
  } catch {
    return Response.json({ error: "No pudimos leer el formulario. Tus datos no se guardaron." }, { status: 400 });
  }

  const action = clean(payload.action, 40);

  try {
    const db = getDb();

    if (action === "attendance") {
      const fullName = clean(payload.fullName, 160);
      const email = normalizeEmail(payload.email);
      const institution = clean(payload.institution, 180);
      const role = clean(payload.role, 80);
      const consent = payload.consent === true;
      const missing = missingWrittenFields([
        ["Nombre completo", fullName],
        ["Institución", institution],
        ["Función", role],
      ]);
      if (!emailPattern.test(email)) missing.unshift("Correo electrónico válido");
      if (!consent) missing.push("Aviso de privacidad");
      if (missing.length) {
        return Response.json(
          { error: `Faltan datos para registrar la asistencia: ${missing.join("; ")}.`, fields: missing },
          { status: 400 },
        );
      }

      const [existing] = await db
        .select({ id: attendance.id })
        .from(attendance)
        .where(and(eq(attendance.email, email), eq(attendance.session, SESSION)))
        .limit(1);
      const code = confirmationCode("AS6");

      await db
        .insert(attendance)
        .values({ email, fullName, institution, role, session: SESSION, consent, confirmationCode: code })
        .onConflictDoUpdate({
          target: [attendance.session, attendance.email],
          set: {
            fullName,
            institution,
            role,
            consent,
            confirmationCode: code,
            createdAt: sql`CURRENT_TIMESTAMP`,
          },
        });

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          folio: code,
          message: "Tu asistencia a la Sesión 6 fue registrada correctamente.",
          updatedPreviousResponse: Boolean(existing),
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "evidence") {
      const fullName = clean(payload.fullName, 160);
      const email = normalizeEmail(payload.email);
      const route = clean(payload.route, 30).toLowerCase();
      const projectTitle = clean(payload.projectTitle, 500);
      const teachingNeed = clean(payload.teachingNeed, 4_000);
      const educationalLevel = clean(payload.educationalLevel, 120);
      const subject = clean(payload.subject, 240);
      const pedagogicalContext = clean(payload.pedagogicalContext, 8_000);
      const learningPurpose = clean(payload.learningPurpose, 4_000);
      const sourceTraceability = clean(payload.sourceTraceability, 8_000);
      const prompt = clean(payload.prompt, 20_000);
      const activitySequence = clean(payload.activitySequence, 20_000);
      const assessmentEvidence = clean(payload.assessmentEvidence, 8_000);
      const instrumentCriteria = clean(payload.instrumentCriteria, 15_000);
      const analysisLimits = clean(payload.analysisLimits, 10_000);
      const teacherDecision = clean(payload.teacherDecision, 10_000);
      const followUpEvidence = clean(payload.followUpEvidence, 8_000);
      const adaptation = clean(payload.adaptation, 8_000);
      const aiContribution = clean(payload.aiContribution, 8_000);
      const teacherReview = clean(payload.teacherReview, 10_000);
      const implementationStep = clean(payload.implementationStep, 8_000);
      const checklistResult = normalizeChecklist(payload.checklist);

      const missing = missingWrittenFields([
        ["Nombre completo", fullName],
        ["Título del proyecto", projectTitle],
        ["Necesidad docente", teachingNeed],
        ["Nivel educativo", educationalLevel],
        ["Asignatura o campo", subject],
        ["Contexto pedagógico", pedagogicalContext],
        ["Propósito de aprendizaje", learningPurpose],
        ["Fuentes y trazabilidad", sourceTraceability],
        ["Prompt contextualizado y revisado", prompt],
        ["Secuencia de actividades", activitySequence],
        ["Evidencia esperada", assessmentEvidence],
        ["Instrumento y criterios", instrumentCriteria],
        ["Análisis, datos faltantes y límites", analysisLimits],
        ["Decisión docente", teacherDecision],
        ["Nueva evidencia de seguimiento", followUpEvidence],
        ["Adaptación o apoyo", adaptation],
        ["Aporte de la IA", aiContribution],
        ["Revisión y cambios docentes", teacherReview],
        ["Primer paso de implementación", implementationStep],
      ]);
      if (!emailPattern.test(email)) missing.unshift("Correo electrónico válido");
      if (!routes.has(route)) missing.unshift("Ruta Básica, Intermedia o Avanzada");
      if (missing.length) {
        return Response.json(
          { error: `Faltan campos obligatorios sin texto: ${missing.join("; ")}.`, fields: missing },
          { status: 400 },
        );
      }

      const missingChecklist = checklistResult
        ? checklistResult.missing.map(({ label }) => label)
        : checklistItems.map(({ label }) => label);
      if (!checklistResult || missingChecklist.length) {
        return Response.json(
          {
            error: `Faltan verificaciones de integración: ${missingChecklist.join("; ")}.`,
            fields: missingChecklist,
          },
          { status: 400 },
        );
      }

      const [registeredAttendance] = await db
        .select({ fullName: attendance.fullName })
        .from(attendance)
        .where(and(eq(attendance.email, email), eq(attendance.session, SESSION)))
        .limit(1);
      if (!registeredAttendance) {
        return Response.json(
          {
            error: "Primero registra tu asistencia a la Sesión 6 con este mismo correo.",
            fields: ["Correo electrónico"],
          },
          { status: 400 },
        );
      }

      const [existing] = await db
        .select({ participantId: sessionSixEvidence.participantId })
        .from(sessionSixEvidence)
        .where(and(
          eq(sessionSixEvidence.email, email),
          eq(sessionSixEvidence.session, SESSION),
          eq(sessionSixEvidence.activity, MAIN_ACTIVITY),
        ))
        .limit(1);
      const participantId = existing?.participantId || (await participantIdFor(email));
      const code = confirmationCode("EV6");
      const checklistJson = JSON.stringify(checklistResult.checklist);

      await db
        .insert(sessionSixEvidence)
        .values({
          participantId,
          fullName: registeredAttendance.fullName,
          email,
          session: SESSION,
          route,
          activity: MAIN_ACTIVITY,
          projectTitle,
          teachingNeed,
          educationalLevel,
          subject,
          pedagogicalContext,
          learningPurpose,
          sourceTraceability,
          prompt,
          activitySequence,
          assessmentEvidence,
          instrumentCriteria,
          analysisLimits,
          teacherDecision,
          followUpEvidence,
          adaptation,
          aiContribution,
          teacherReview,
          implementationStep,
          checklistJson,
          status: "recibida",
          confirmationCode: code,
        })
        .onConflictDoUpdate({
          target: [
            sessionSixEvidence.email,
            sessionSixEvidence.session,
            sessionSixEvidence.activity,
          ],
          set: {
            fullName: registeredAttendance.fullName,
            route,
            projectTitle,
            teachingNeed,
            educationalLevel,
            subject,
            pedagogicalContext,
            learningPurpose,
            sourceTraceability,
            prompt,
            activitySequence,
            assessmentEvidence,
            instrumentCriteria,
            analysisLimits,
            teacherDecision,
            followUpEvidence,
            adaptation,
            aiContribution,
            teacherReview,
            implementationStep,
            checklistJson,
            attempt: sql`${sessionSixEvidence.attempt} + 1`,
            responseVersion: sql`${sessionSixEvidence.responseVersion} + 1`,
            status: "recibida",
            confirmationCode: code,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });

      const pdfAccessCode = await createPdfAccessCode("S6", email, code);
      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          folio: code,
          pdfAccessCode,
          message: "Tu producto final integrado de la Sesión 6 fue guardado correctamente.",
          updatedPreviousResponse: Boolean(existing),
        },
        { status: existing ? 200 : 201 },
      );
    }

    return Response.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
