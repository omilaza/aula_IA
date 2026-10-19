import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  attendance,
  levelingRecords,
  sessionThreeEvidence,
} from "../../../db/schema";
import { difficultyEvidenceChecklist } from "../../session-three-data";
import { syncToInstitutionalSheet } from "../../sheets-sync";
import { createPdfAccessCode } from "../../evidence-pdf-server";

const SESSION = "S3";
const PREPARATORY_ROUTE = "preparatoria";
const MAIN_ROUTE = "principal";
const LEVELING_ATTENDANCE_ACTIVITY = "registro-entrada";
const MAIN_EVIDENCE_ACTIVITY = "evidencia-principal";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const activityPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const educationLevels = new Set([
  "Educación básica",
  "Media superior",
  "Educación superior",
]);
const difficultyLevels = new Set(["basico", "intermedio", "avanzado"]);

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
    .slice(0, 30)
    .map(([key, item]) => [clean(key, 220), item] as const)
    .filter(([key]) => Boolean(key));
  if (entries.length < 6) return null;

  const checklist = Object.fromEntries(
    entries.map(([key, item]) => {
      const normalized =
        item === true ||
        ["si", "sí", "yes", "true"].includes(clean(item, 12).toLowerCase());
      return [key, normalized];
    }),
  );
  const achieved = Object.values(checklist).filter(Boolean).length;
  return { checklist, achieved, total: entries.length };
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  if (message.includes("no such table")) {
    return "La Sesión 3 todavía está en preparación. Tus datos no se enviaron; conserva esta página abierta e inténtalo después de la publicación.";
  }
  return "No fue posible guardar tu respuesta. Verifica tu conexión e inténtalo nuevamente. El texto visible permanece en el formulario.";
}

async function participantIdFor(email: string) {
  const db = getDb();
  const [leveling] = await db
    .select({ participantId: levelingRecords.participantId })
    .from(levelingRecords)
    .where(
      and(
        eq(levelingRecords.email, email),
        eq(levelingRecords.session, SESSION),
      ),
    )
    .limit(1);
  return leveling?.participantId || confirmationCode("PAR");
}

export async function GET() {
  return Response.json({
    ok: true,
    session: SESSION,
    actions: [
      "leveling_attendance",
      "leveling_activity",
      "s3_main_attendance",
      "s3_evidence",
    ],
  });
}

export async function POST(request: Request) {
  let payload: JsonRecord;
  try {
    payload = (await request.json()) as JsonRecord;
  } catch {
    return Response.json(
      {
        error:
          "No pudimos leer el formulario. Recarga la página e inténtalo nuevamente; conserva antes cualquier texto que hayas escrito.",
      },
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
          {
            error:
              "Completa nombre, correo, institución y función, y acepta el aviso de privacidad para registrar tu entrada a la preparación.",
          },
          { status: 400 },
        );
      }

      const [existing] = await db
        .select({ participantId: levelingRecords.participantId })
        .from(levelingRecords)
        .where(
          and(
            eq(levelingRecords.email, email),
            eq(levelingRecords.session, SESSION),
            eq(levelingRecords.route, PREPARATORY_ROUTE),
            eq(levelingRecords.activity, LEVELING_ATTENDANCE_ACTIVITY),
          ),
        )
        .limit(1);
      const participantId = existing?.participantId || (await participantIdFor(email));
      const code = confirmationCode("NP3");
      const responseJson = JSON.stringify({ consent: true });

      await db
        .insert(levelingRecords)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [
            levelingRecords.email,
            levelingRecords.session,
            levelingRecords.route,
            levelingRecords.activity,
          ],
          set: {
            fullName,
            institution,
            role,
            responseJson,
            result: "Entrada registrada",
            attempt: sql`${levelingRecords.attempt} + 1`,
            responseVersion: sql`${levelingRecords.responseVersion} + 1`,
            status: "completado",
            confirmationCode: code,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });

      const sheetSync = await syncToInstitutionalSheet({
        action,
        participantId,
        fullName,
        email,
        institution,
        role,
        session: SESSION,
        route: PREPARATORY_ROUTE,
        activity: LEVELING_ATTENDANCE_ACTIVITY,
        evidenceType: "Asistencia",
        response: { consent: true },
        result: "Entrada registrada",
        status: "Completado",
        confirmationCode: code,
      });
      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          message:
            "Tu entrada a la preparación de la Sesión 3 fue registrada. Al terminar, recuerda registrarte también en la sesión principal.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: sheetSync.status,
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
      if (
        !emailPattern.test(email) ||
        !activityPattern.test(activity) ||
        activity === LEVELING_ATTENDANCE_ACTIVITY ||
        !responseJson
      ) {
        return Response.json(
          {
            error:
              "Escribe tu correo y completa la actividad antes de guardarla. Tus respuestas visibles permanecen en el formulario para que puedas corregirlas.",
          },
          { status: 400 },
        );
      }

      const [registration] = await db
        .select({
          participantId: levelingRecords.participantId,
          fullName: levelingRecords.fullName,
          institution: levelingRecords.institution,
          role: levelingRecords.role,
        })
        .from(levelingRecords)
        .where(
          and(
            eq(levelingRecords.email, email),
            eq(levelingRecords.session, SESSION),
            eq(levelingRecords.route, PREPARATORY_ROUTE),
            eq(levelingRecords.activity, LEVELING_ATTENDANCE_ACTIVITY),
          ),
        )
        .limit(1);
      if (!registration) {
        return Response.json(
          {
            error:
              "Primero registra tu entrada a la preparación con este mismo correo. Después podrás guardar la actividad.",
          },
          { status: 400 },
        );
      }

      const [existing] = await db
        .select({ id: levelingRecords.id })
        .from(levelingRecords)
        .where(
          and(
            eq(levelingRecords.email, email),
            eq(levelingRecords.session, SESSION),
            eq(levelingRecords.route, PREPARATORY_ROUTE),
            eq(levelingRecords.activity, activity),
          ),
        )
        .limit(1);
      const code = confirmationCode("ACT3");
      const status = completed ? "completado" : "en_progreso";

      await db
        .insert(levelingRecords)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [
            levelingRecords.email,
            levelingRecords.session,
            levelingRecords.route,
            levelingRecords.activity,
          ],
          set: {
            evidenceType,
            responseJson,
            result,
            attempt: sql`${levelingRecords.attempt} + 1`,
            responseVersion: sql`${levelingRecords.responseVersion} + 1`,
            status,
            confirmationCode: code,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });

      const sheetSync = await syncToInstitutionalSheet({
        action,
        participantId: registration.participantId,
        fullName: registration.fullName,
        email,
        institution: registration.institution,
        role: registration.role,
        session: SESSION,
        route: PREPARATORY_ROUTE,
        activity,
        evidenceType,
        response: JSON.parse(responseJson),
        result,
        status: completed ? "Completado" : "En progreso",
        confirmationCode: code,
      });

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          status,
          message: completed
            ? "Actividad completada. Tu preparación fue registrada y ya puedes continuar."
            : "Tu avance fue guardado. Puedes completar la actividad cuando estés listo.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: sheetSync.status,
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "s3_main_attendance") {
      const email = normalizeEmail(payload.email);
      const fullName = clean(payload.fullName, 160);
      const institution = clean(payload.institution, 180);
      const role = clean(payload.role, 80);
      const consent = payload.consent === true;
      if (!emailPattern.test(email) || !fullName || !institution || !role || !consent) {
        return Response.json(
          {
            error:
              "Completa los campos obligatorios y acepta el aviso de privacidad para registrar tu asistencia a la sesión principal.",
          },
          { status: 400 },
        );
      }

      const [existing] = await db
        .select({ id: attendance.id })
        .from(attendance)
        .where(and(eq(attendance.email, email), eq(attendance.session, SESSION)))
        .limit(1);
      const code = confirmationCode("AS3");

      await db
        .insert(attendance)
        .values({
          email,
          fullName,
          institution,
          role,
          session: SESSION,
          consent,
          confirmationCode: code,
        })
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

      const sheetSync = await syncToInstitutionalSheet({
        action,
        session: SESSION,
        email,
        fullName,
        institution,
        role,
        consent,
        confirmationCode: code,
      });

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          message: "Tu asistencia a la Sesión 3 principal fue registrada correctamente.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: sheetSync.status,
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "s3_evidence") {
      const email = normalizeEmail(payload.email);
      const sequenceTitle = clean(payload.sequenceTitle, 300);
      const educationalLevel = clean(payload.educationalLevel, 80);
      const subject = clean(payload.subject, 120);
      const difficultyLevel = clean(payload.difficultyLevel, 30).toLowerCase();
      const purpose = clean(payload.purpose, 3_000);
      const pedagogicalContext = clean(payload.pedagogicalContext, 5_000);
      const sources = clean(payload.sources, 5_000);
      const prompt = clean(payload.prompt, 12_000);
      const aiDraft = clean(payload.aiDraft, 18_000);
      const activitySequence = clean(payload.activitySequence, 15_000);
      const assessmentEvidence = clean(payload.assessmentEvidence, 5_000);
      const teacherReview = clean(payload.teacherReview, 7_000);
      const detectedRisk = clean(payload.detectedRisk, 4_000);
      const adaptation = clean(payload.adaptation, 5_000);
      const adjustment = clean(payload.adjustment, 6_000);
      const checklistResult = normalizeChecklist(payload.checklist);

      if (!emailPattern.test(email)) {
        return Response.json(
          {
            error:
              "Escribe el mismo correo que utilizaste para registrar tu asistencia principal.",
          },
          { status: 400 },
        );
      }
      if (!educationLevels.has(educationalLevel)) {
        return Response.json(
          {
            error:
              "Selecciona uno de los tres niveles educativos disponibles: educación básica, media superior o educación superior.",
          },
          { status: 400 },
        );
      }
      if (!difficultyLevels.has(difficultyLevel)) {
        return Response.json(
          {
            error:
              "Selecciona una ruta de dificultad: básica, intermedia o avanzada. No necesitas completar las tres.",
          },
          { status: 400 },
        );
      }
      const criticalFields: Array<readonly [string, string, number]> = [
        ["Asignatura general", subject, 3],
        ["Propósito observable", purpose, 20],
        ["Contexto pedagógico", pedagogicalContext, 20],
        ["Prompt principal", prompt, 60],
        ["Borrador de IA o contingencia", aiDraft, 30],
        ["Secuencia final", activitySequence, 80],
        ["Evidencia y criterio de revisión", assessmentEvidence, 25],
        ["Revisión docente", teacherReview, 30],
        ["Desalineación, vacío o riesgo", detectedRisk, 15],
        ["Apoyo o adaptación", adaptation, 15],
        ["Ajuste final", adjustment, 20],
      ];
      const missingCriticalFields = criticalFields.filter(([, value, minimum]) => value.length < minimum).map(([label]) => label);
      if (missingCriticalFields.length) {
        return Response.json(
          {
            error: `No podemos acreditar todavía. Revisa estos campos críticos: ${missingCriticalFields.join("; ")}.`,
            fields: missingCriticalFields,
          },
          { status: 400 },
        );
      }
      const selectedDifficultyChecklist = difficultyEvidenceChecklist[
        difficultyLevel as keyof typeof difficultyEvidenceChecklist
      ];
      const missingChecklistItems = selectedDifficultyChecklist.filter((item) => checklistResult?.checklist[item] !== true);
      if (
        !checklistResult ||
        checklistResult.total !== selectedDifficultyChecklist.length ||
        missingChecklistItems.length
      ) {
        const difficultyLabel = difficultyLevel === "basico" ? "Básica" : difficultyLevel === "intermedio" ? "Intermedia" : "Avanzada";
        return Response.json(
          {
            error: `Completa todos los criterios de la ruta ${difficultyLabel} de ${educationalLevel}. Pendientes: ${missingChecklistItems.length ? missingChecklistItems.join("; ") : "la lista enviada no corresponde a esta ruta"}.`,
            fields: missingChecklistItems,
          },
          { status: 400 },
        );
      }

      const [mainAttendance] = await db
        .select({ fullName: attendance.fullName })
        .from(attendance)
        .where(and(eq(attendance.email, email), eq(attendance.session, SESSION)))
        .limit(1);
      if (!mainAttendance) {
        return Response.json(
          {
            error:
              "Primero registra tu asistencia a la Sesión 3 principal con este mismo correo. Después podrás enviar la evidencia acreditable.",
          },
          { status: 400 },
        );
      }

      const [existing] = await db
        .select({ participantId: sessionThreeEvidence.participantId })
        .from(sessionThreeEvidence)
        .where(
          and(
            eq(sessionThreeEvidence.email, email),
            eq(sessionThreeEvidence.session, SESSION),
            eq(sessionThreeEvidence.route, MAIN_ROUTE),
            eq(sessionThreeEvidence.activity, MAIN_EVIDENCE_ACTIVITY),
          ),
        )
        .limit(1);
      const participantId = existing?.participantId || (await participantIdFor(email));
      const code = confirmationCode("EV3");
      const checklistJson = JSON.stringify(checklistResult.checklist);

      await db
        .insert(sessionThreeEvidence)
        .values({
          participantId,
          fullName: mainAttendance.fullName,
          email,
          session: SESSION,
          route: MAIN_ROUTE,
          activity: MAIN_EVIDENCE_ACTIVITY,
          sequenceTitle,
          educationalLevel,
          subject,
          difficultyLevel,
          purpose,
          pedagogicalContext,
          sources,
          prompt,
          aiDraft,
          activitySequence,
          assessmentEvidence,
          teacherReview,
          detectedRisk,
          adaptation,
          adjustment,
          checklistJson,
          status: "recibida",
          confirmationCode: code,
        })
        .onConflictDoUpdate({
          target: [
            sessionThreeEvidence.email,
            sessionThreeEvidence.session,
            sessionThreeEvidence.route,
            sessionThreeEvidence.activity,
          ],
          set: {
            fullName: mainAttendance.fullName,
            sequenceTitle,
            educationalLevel,
            subject,
            difficultyLevel,
            purpose,
            pedagogicalContext,
            sources,
            prompt,
            aiDraft,
            activitySequence,
            assessmentEvidence,
            teacherReview,
            detectedRisk,
            adaptation,
            adjustment,
            checklistJson,
            attempt: sql`${sessionThreeEvidence.attempt} + 1`,
            responseVersion: sql`${sessionThreeEvidence.responseVersion} + 1`,
            status: "recibida",
            confirmationCode: code,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });

      const sheetSync = await syncToInstitutionalSheet({
        action,
        participantId,
        fullName: mainAttendance.fullName,
        email,
        session: SESSION,
        route: MAIN_ROUTE,
        activity: MAIN_EVIDENCE_ACTIVITY,
        sequenceTitle,
        educationalLevel,
        subject,
        difficultyLevel,
        purpose,
        pedagogicalContext,
        sources,
        prompt,
        aiDraft,
        activitySequence,
        assessmentEvidence,
        teacherReview,
        detectedRisk,
        adaptation,
        adjustment,
        checklist: checklistResult.checklist,
        checklistAchieved: checklistResult.achieved,
        checklistTotal: checklistResult.total,
        status: "Recibida",
        confirmationCode: code,
      });
      const pdfAccessCode = await createPdfAccessCode("S3", email, code);

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          pdfAccessCode,
          message:
            "Tu evidencia de la Sesión 3 fue guardada correctamente. El registro incluye tu secuencia, revisión y ajuste.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: sheetSync.status,
        },
        { status: existing ? 200 : 201 },
      );
    }

    return Response.json(
      {
        error:
          "La actividad indicada no corresponde a la Sesión 3. Regresa a la sección anterior e inténtalo nuevamente.",
      },
      { status: 400 },
    );
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
