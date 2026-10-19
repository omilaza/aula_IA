import { getDb, increment, currentTimestamp } from "../../../db";
import {
  attendance,
  digitalSkillDiagnostics,
  levelingRecords,
  sessionTwoEvidence,
} from "../../../db/schema";

import { createPdfAccessCode } from "../../evidence-pdf-server";
import { evidenceChecklist } from "../../session-two-data";

const SESSION = "S2";
const PREPARATORY_ROUTE = "preparatoria";
const MAIN_ROUTE = "principal";
const DIGITAL_ROUTE = "orientacion";
const DIGITAL_ACTIVITY = "diagnostico-digital";
const LEVELING_ATTENDANCE_ACTIVITY = "registro-entrada";
const MAIN_EVIDENCE_ACTIVITY = "evidencia-principal";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const activityPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

function boundedJson(value: unknown, max = 12_000) {
  if (!isRecord(value) || Object.keys(value).length === 0) return null;
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 0 && serialized.length <= max ? serialized : null;
  } catch {
    return null;
  }
}

function textList(value: unknown, max = 4_000) {
  if (Array.isArray(value)) {
    return value
      .slice(0, 12)
      .map((item) => clean(item, 500))
      .filter(Boolean)
      .join("\n")
      .slice(0, max);
  }
  return clean(value, max);
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  if (message.includes("no such table")) {
    return "La Sesión 2 todavía está en preparación. Tus datos no se enviaron; conserva esta página abierta e inténtalo después de la publicación.";
  }
  return "No fue posible guardar tu respuesta. Verifica tu conexión e inténtalo nuevamente. El texto que ves en el formulario puede volver a enviarse.";
}

function normalizeCapabilityAnswer(value: unknown) {
  const answer = clean(value, 30).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["si", "sí", "yes", "true", "puedo"].includes(answer)) return "si";
  if (["con_ayuda", "a_veces", "sometimes", "parcial"].includes(answer)) return "con_ayuda";
  if (["todavia_no", "todavía_no", "aun_no", "aún_no", "no", "false"].includes(answer)) return "todavia_no";
  return "";
}

function normalizeSupportAnswer(value: unknown) {
  const answer = clean(value, 30).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["si", "sí", "yes", "true"].includes(answer)) return "si";
  if (["a_veces", "con_ayuda", "sometimes", "parcial"].includes(answer)) return "a_veces";
  if (["no", "false", "todavia_no", "todavía_no"].includes(answer)) return "no";
  return "";
}

function evaluateDigitalDiagnostic(rawAnswers: unknown) {
  if (!isRecord(rawAnswers)) return null;

  const answers: Record<string, string> = {};
  let digitalScore = 0;

  for (let index = 1; index <= 13; index += 1) {
    const value = rawAnswers[`H${index}`] ?? rawAnswers[`HD${index}`] ?? rawAnswers[`Q${index}`];
    const normalized = index === 13 ? normalizeSupportAnswer(value) : normalizeCapabilityAnswer(value);
    if (!normalized) return null;
    answers[`H${index}`] = normalized;

    if (index === 13) {
      digitalScore += normalized === "no" ? 2 : normalized === "a_veces" ? 1 : 0;
    } else {
      digitalScore += normalized === "si" ? 2 : normalized === "con_ayuda" ? 1 : 0;
    }
  }

  if (digitalScore <= 13) {
    return {
      answers,
      digitalScore,
      identifiedLevel: "inicial",
      recommendedRoute: PREPARATORY_ROUTE,
      recommendationMessage:
        "Te recomendamos comenzar por la preparación de 60 minutos. Allí encontrarás instrucciones breves y acompañamiento paso a paso antes de la sesión principal.",
    };
  }

  if (digitalScore <= 20) {
    return {
      answers,
      digitalScore,
      identifiedLevel: "basico-intermedio",
      recommendedRoute: "eleccion",
      recommendationMessage:
        "Puedes elegir la preparación de 60 minutos para practicar con acompañamiento o ingresar directamente a la sesión principal.",
    };
  }

  return {
    answers,
    digitalScore,
    identifiedLevel: "suficiente",
    recommendedRoute: MAIN_ROUTE,
    recommendationMessage:
      "Cuentas con las habilidades necesarias para ingresar directamente a la sesión principal. La preparación seguirá disponible si deseas consultarla.",
  };
}

function normalizeChecklist(value: unknown) {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value)
    .slice(0, 12)
    .map(([key, item]) => [clean(key, 160), item] as const)
    .filter(([key]) => Boolean(key));
  if (entries.length < 1) return null;
  const checklist = Object.fromEntries(
    entries.map(([key, item]) => {
      const normalized = item === true || ["si", "sí", "yes", "true"].includes(clean(item, 12).toLowerCase());
      return [key, normalized];
    }),
  );
  const achieved = Object.values(checklist).filter(Boolean).length;
  return { checklist, achieved, total: entries.length };
}

async function participantIdFor(email: string) {
  const db = getDb();
  const [diagnostic] = await db.find(digitalSkillDiagnostics, { email, session: SESSION }, { columns: ["participantId"], limit: 1 });
  if (diagnostic) return diagnostic.participantId;

  const [leveling] = await db.find(levelingRecords, { email, session: SESSION }, { columns: ["participantId"], limit: 1 });
  return leveling?.participantId || confirmationCode("PAR");
}

export async function GET() {
  return Response.json({
    ok: true,
    session: SESSION,
    actions: [
      "digital_diagnostic",
      "leveling_attendance",
      "leveling_activity",
      "s2_main_attendance",
      "s2_evidence",
    ],
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

    if (action === "digital_diagnostic") {
      const email = normalizeEmail(payload.email);
      const fullName = clean(payload.fullName, 160);
      const evaluation = evaluateDigitalDiagnostic(payload.answers);
      if (!emailPattern.test(email) || !fullName || !evaluation) {
        return Response.json(
          { error: "Escribe tu nombre y correo, y responde las 13 preguntas. Puedes elegir ‘Sí’, ‘Con ayuda’ o ‘Todavía no’." },
          { status: 400 },
        );
      }

      const [existing] = await db.find(digitalSkillDiagnostics, { email, session: SESSION, route: DIGITAL_ROUTE, activity: DIGITAL_ACTIVITY }, { columns: ["participantId"], limit: 1 });
      const participantId = existing?.participantId || confirmationCode("PAR");
      const code = confirmationCode("DD2");

      await db.upsert(
        digitalSkillDiagnostics,
        {
          participantId,
          fullName,
          email,
          session: SESSION,
          route: DIGITAL_ROUTE,
          activity: DIGITAL_ACTIVITY,
          answersJson: JSON.stringify(evaluation.answers),
          digitalScore: evaluation.digitalScore,
          identifiedLevel: evaluation.identifiedLevel,
          recommendedRoute: evaluation.recommendedRoute,
          confirmationCode: code,
        },
        {
          fullName,
          answersJson: JSON.stringify(evaluation.answers),
          digitalScore: evaluation.digitalScore,
          identifiedLevel: evaluation.identifiedLevel,
          recommendedRoute: evaluation.recommendedRoute,
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
          identifiedLevel: evaluation.identifiedLevel,
          recommendedRoute: evaluation.recommendedRoute,
          recommendationMessage: evaluation.recommendationMessage,
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

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
      const code = confirmationCode("NP2");
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
          message: "Tu entrada a la preparación fue registrada. Al terminar, recuerda registrarte también en la sesión principal.",
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
      if (!emailPattern.test(email) || !activityPattern.test(activity) || !responseJson) {
        return Response.json(
          { error: "Escribe tu correo y completa la actividad antes de guardarla. Tus respuestas visibles permanecen en el formulario para que puedas corregirlas." },
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
      const code = confirmationCode("ACT2");
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
          message: completed ? "Actividad completada. Tu respuesta fue registrada y ya puedes continuar." : "Tu avance fue guardado. Puedes completar la actividad cuando estés listo.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "s2_main_attendance") {
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
      const code = confirmationCode("AS2");
      await db.upsert(
        attendance,
        { email, fullName, institution, role, session: SESSION, consent, confirmationCode: code },
        {
          fullName,
          institution,
          role,
          consent,
          confirmationCode: code,
          createdAt: currentTimestamp,
        },
      );

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          message: "Tu asistencia a la Sesión 2 principal fue registrada correctamente.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "s2_evidence") {
      const email = normalizeEmail(payload.email);
      const productTitle = clean(payload.productTitle ?? payload.product, 300);
      const purpose = clean(payload.purpose, 2_000);
      const pedagogicalContext = clean(payload.pedagogicalContext ?? payload.context, 4_000);
      const sources = textList(payload.sources, 4_000);
      const prompt = clean(payload.prompt, 10_000);
      const aiResult = clean(payload.aiResult ?? payload.result, 15_000);
      const teacherReview = clean(payload.teacherReview ?? payload.review, 6_000);
      const detectedRisk = clean(payload.detectedRisk ?? payload.risk, 3_000);
      const adjustment = clean(payload.adjustment, 6_000);
      const checklistResult = normalizeChecklist(payload.checklist);

      if (!emailPattern.test(email)) {
        return Response.json({ error: "Escribe el mismo correo que utilizaste para registrar tu asistencia principal." }, { status: 400 });
      }
      const criticalFields: Array<readonly [string, string, number]> = [
        ["Propósito docente", purpose, 10],
        ["Contexto pedagógico", pedagogicalContext, 20],
        ["Fuente o fragmento utilizado", sources, 5],
        ["Prompt principal", prompt, 30],
        ["Resultado de IA o contingencia", aiResult, 30],
        ["Revisión docente", teacherReview, 20],
        ["Riesgo o limitación", detectedRisk, 10],
        ["Ajuste realizado", adjustment, 15],
      ];
      const missingCriticalFields = criticalFields.filter(([, value, minimum]) => value.length < minimum).map(([label]) => label);
      if (missingCriticalFields.length) {
        return Response.json(
          { error: `No podemos acreditar todavía. Revisa estos campos críticos: ${missingCriticalFields.join("; ")}.`, fields: missingCriticalFields },
          { status: 400 },
        );
      }
      const recognizedChecklistAchieved = evidenceChecklist.filter((item) => checklistResult?.checklist[item] === true).length;
      if (!checklistResult || recognizedChecklistAchieved < 4) {
        const missingChecklistItems = evidenceChecklist.filter((item) => checklistResult?.checklist[item] !== true);
        return Response.json(
          { error: `Revisa la lista de cotejo y confirma al menos cuatro criterios antes de guardar. Pendientes disponibles: ${missingChecklistItems.join("; ")}.`, fields: missingChecklistItems },
          { status: 400 },
        );
      }

      const [mainAttendance] = await db.find(attendance, { email, session: SESSION }, { columns: ["fullName"], limit: 1 });
      if (!mainAttendance) {
        return Response.json(
          { error: "Primero registra tu asistencia a la Sesión 2 principal con este mismo correo. Después podrás enviar la evidencia acreditable." },
          { status: 400 },
        );
      }

      const [existing] = await db.find(sessionTwoEvidence, { email, session: SESSION, route: MAIN_ROUTE, activity: MAIN_EVIDENCE_ACTIVITY }, { columns: ["participantId"], limit: 1 });
      const participantId = existing?.participantId || (await participantIdFor(email));
      const code = confirmationCode("EV2");
      const checklistJson = JSON.stringify(checklistResult.checklist);

      await db.upsert(
        sessionTwoEvidence,
        {
          participantId,
          fullName: mainAttendance.fullName,
          email,
          session: SESSION,
          route: MAIN_ROUTE,
          activity: MAIN_EVIDENCE_ACTIVITY,
          productTitle,
          purpose,
          pedagogicalContext,
          sources,
          prompt,
          aiResult,
          teacherReview,
          detectedRisk,
          adjustment,
          checklistJson,
          status: "recibida",
          confirmationCode: code,
        },
        {
          fullName: mainAttendance.fullName,
          productTitle,
          purpose,
          pedagogicalContext,
          sources,
          prompt,
          aiResult,
          teacherReview,
          detectedRisk,
          adjustment,
          checklistJson,
          attempt: increment(1),
          responseVersion: increment(1),
          status: "recibida",
          confirmationCode: code,
          updatedAt: currentTimestamp,
        },
      );

      const pdfAccessCode = await createPdfAccessCode("S2", email, code);

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          pdfAccessCode,
          message: "Tu evidencia principal de la Sesión 2 fue guardada exitosamente. Ya puedes continuar al cierre.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    return Response.json(
      { error: "La actividad indicada no corresponde a la Sesión 2. Regresa a la sección anterior e inténtalo nuevamente." },
      { status: 400 },
    );
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
