import { getDb, increment, currentTimestamp } from "../../../db";
import { attendance, levelingRecords, sessionFiveEvidence } from "../../../db/schema";
import { difficultyEvidenceChecklist, sequences } from "../../session-five-data";
import { missingWrittenFields } from "../../session-five-validation";
import { createPdfAccessCode } from "../../evidence-pdf-server";

const SESSION = "S5";
const PREPARATORY_ROUTE = "preparatoria";
const MAIN_ROUTE = "principal";
const LEVELING_ATTENDANCE_ACTIVITY = "registro-entrada";
const LEVELING_FINAL_ACTIVITY = "nivelacion-instrumentos";
const MAIN_EVIDENCE_ACTIVITY = "evidencia-principal";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sequenceKeyPattern = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const educationalLevels = new Set([
  "Educación básica",
  "Secundaria",
  "Educación media superior",
  "Educación superior",
]);
const instrumentTypes = new Set([
  "rubrica_analitica",
  "lista_cotejo",
  "escala_valoracion",
  "guia_observacion",
  "portafolio_evidencias",
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

function checklistInput(payload: JsonRecord) {
  const value = payload.checklist ?? payload.checklistJson;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeChecklist(value: unknown) {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value)
    .slice(0, 30)
    .map(([key, item]) => [clean(key, 240), item] as const)
    .filter(([key]) => Boolean(key));
  // La cantidad válida depende de la ruta: Básica 3, Intermedia 6 y Avanzada 10.
  // Rechazar aquí listas menores a 6 hacía imposible guardar la ruta Básica.
  if (entries.length === 0) return null;
  const checklist = Object.fromEntries(
    entries.map(([key, item]) => {
      const normalized =
        item === true ||
        ["si", "sí", "yes", "true"].includes(clean(item, 12).toLowerCase());
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
    return "La Sesión 5 todavía está en preparación. Tus datos no se enviaron; conserva esta página abierta e inténtalo después de aplicar la migración.";
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
    actions: [
      "leveling_attendance",
      "leveling_activity",
      "s5_main_attendance",
      "s5_evidence",
    ],
    educationalLevels: [...educationalLevels],
    instrumentTypes: [...instrumentTypes],
    difficultyLevels: [...difficultyLevels],
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

      const [existing] = await db.find(levelingRecords, { email, session: SESSION, route: PREPARATORY_ROUTE, activity: LEVELING_ATTENDANCE_ACTIVITY }, { columns: ["participantId"], limit: 1 });
      const participantId = existing?.participantId || (await participantIdFor(email));
      const code = confirmationCode("NP5");
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
          folio: code,
          message:
            "Tu entrada a la preparación de la Sesión 5 fue registrada. El comprobante de preparación se habilita al guardar la nivelación final.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "leveling_activity") {
      const email = normalizeEmail(payload.email);
      const activity = clean(payload.activity, 60).toLowerCase();
      const evidenceType = clean(payload.evidenceType, 60) || "nivelacion-instrumentos";
      const responseJson = boundedJson(payload.response);
      const result = clean(payload.result, 800);
      const completed = payload.completed !== false;
      if (!emailPattern.test(email) || activity !== LEVELING_FINAL_ACTIVITY || !responseJson) {
        return Response.json(
          {
            error:
              "Escribe tu correo y completa la nivelación de instrumentos antes de guardarla. Tus respuestas visibles permanecen en el formulario.",
          },
          { status: 400 },
        );
      }

      const [registration] = await db.find(levelingRecords, { email, session: SESSION, route: PREPARATORY_ROUTE, activity: LEVELING_ATTENDANCE_ACTIVITY }, { columns: ["participantId", "fullName", "institution", "role"], limit: 1 });
      if (!registration) {
        return Response.json(
          {
            error:
              "Primero registra tu entrada a la preparación con este mismo correo. Después podrás guardar la nivelación.",
          },
          { status: 400 },
        );
      }

      const [existing] = await db.find(levelingRecords, { email, session: SESSION, route: PREPARATORY_ROUTE, activity: LEVELING_FINAL_ACTIVITY }, { columns: ["id"], limit: 1 });
      const code = confirmationCode("ACT5");
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
          activity: LEVELING_FINAL_ACTIVITY,
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

      const pdfAccessCode = await createPdfAccessCode("S5P", email, code);

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          folio: code,
          pdfAccessCode,
          status,
          message: completed
            ? "Nivelación completada. Tu preparación fue registrada y ya puedes recuperar su comprobante PDF."
            : "Tu avance fue guardado y cuenta con un folio técnico separado de la evidencia principal.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "s5_main_attendance") {
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

      const [existing] = await db.find(attendance, { email, session: SESSION }, { columns: ["id"], limit: 1 });
      const code = confirmationCode("AS5");

      await db.upsert(
        attendance,
        {
          email,
          fullName,
          institution,
          role,
          session: SESSION,
          consent,
          confirmationCode: code,
        },
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
          folio: code,
          message: "Tu asistencia a la Sesión 5 principal fue registrada correctamente.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (action === "s5_evidence") {
      const email = normalizeEmail(payload.email);
      const sequenceKey = clean(payload.sequenceKey, 60).toLowerCase();
      const sequenceTitle = clean(payload.sequenceTitle, 300);
      const educationalLevel = clean(payload.educationalLevel, 80);
      const subject = clean(payload.subject, 120);
      const difficultyLevel = clean(payload.difficultyLevel, 30).toLowerCase();
      const instrumentType = clean(payload.instrumentType, 50).toLowerCase();
      const learningPurpose = clean(payload.learningPurpose, 3_000);
      const pedagogicalContext = clean(payload.pedagogicalContext, 5_000);
      const sourceCase = clean(payload.sourceCase, 7_000);
      const instrumentDesign = clean(payload.instrumentDesign, 12_000);
      const criteriaDescriptors = clean(payload.criteriaDescriptors, 10_000);
      const prompt = clean(payload.prompt, 18_000);
      const aiDraft = clean(payload.aiDraft, 18_000);
      const datasetSummary = clean(payload.datasetSummary, 10_000);
      const findings = clean(payload.findings, 10_000);
      const groupComparison = clean(payload.groupComparison, 9_000);
      const teacherDecision = clean(payload.teacherDecision, 9_000);
      const limitations = clean(payload.limitations, 6_000);
      const adaptation = clean(payload.adaptation, 6_000);
      const checklistResult = normalizeChecklist(checklistInput(payload));

      if (!emailPattern.test(email)) {
        return Response.json(
          { error: "Escribe el mismo correo que utilizaste para registrar tu asistencia principal." },
          { status: 400 },
        );
      }
      if (!sequenceKeyPattern.test(sequenceKey)) {
        return Response.json(
          { error: "Selecciona nuevamente la secuencia de trabajo antes de guardar la evidencia." },
          { status: 400 },
        );
      }
      if (!educationalLevels.has(educationalLevel)) {
        return Response.json(
          {
            error:
              "Selecciona uno de los cuatro niveles aprobados: Educación básica, Secundaria, Educación media superior o Educación superior.",
          },
          { status: 400 },
        );
      }
      const selectedSequence = sequences.find((item) => item.key === sequenceKey);
      if (
        sequenceKey !== "propia" &&
        (
          !selectedSequence ||
          selectedSequence.level !== educationalLevel ||
          selectedSequence.subject !== subject
        )
      ) {
        return Response.json(
          {
            error:
              "Selecciona nuevamente la secuencia. La clave, el nivel educativo y la asignatura deben corresponder al mismo caso.",
          },
          { status: 400 },
        );
      }
      if (!instrumentTypes.has(instrumentType)) {
        return Response.json(
          {
            error:
              "Selecciona uno de los cinco instrumentos aprobados para la Sesión 5.",
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
      const criticalFields: Array<readonly [string, string]> = [
        ...(sequenceKey === "propia"
          ? [
              ["Título de la secuencia propia", sequenceTitle],
              ["Asignatura de la secuencia propia", subject],
              ["Propósito de aprendizaje de la secuencia propia", learningPurpose],
              ["Contexto, producto y momentos de la secuencia propia", pedagogicalContext],
            ] as const
          : []),
        ["Instrumento final revisado", instrumentDesign],
        ["Criterios, niveles o valores observables", criteriaDescriptors],
        ["Prompt del instrumento", prompt],
        ["Borrador de IA o contingencia", aiDraft],
        ["Resumen de datos y denominadores", datasetSummary],
        ["Hallazgos y pregunta pendiente", findings],
        ["Comparación de G1, G2 y G3", groupComparison],
        ["Decisión docente y evidencia de seguimiento", teacherDecision],
        ["Datos faltantes y límites", limitations],
        ["Adaptación o apoyo", adaptation],
      ];
      const missingCriticalFields = missingWrittenFields(criticalFields);
      if (missingCriticalFields.length) {
        return Response.json(
          {
            error: `Faltan campos obligatorios sin texto: ${missingCriticalFields.join("; ")}.`,
            fields: missingCriticalFields,
          },
          { status: 400 },
        );
      }

      const selectedDifficultyChecklist = difficultyEvidenceChecklist[
        difficultyLevel as keyof typeof difficultyEvidenceChecklist
      ];
      const missingChecklistItems = selectedDifficultyChecklist.filter(
        (item) => checklistResult?.checklist[item] !== true,
      );
      if (!checklistResult || checklistResult.total !== selectedDifficultyChecklist.length || missingChecklistItems.length) {
        const difficultyLabel =
          difficultyLevel === "basico"
            ? "Básica"
            : difficultyLevel === "intermedio"
              ? "Intermedia"
              : "Avanzada";
        return Response.json(
          {
            error: `Faltan casillas de la ruta ${difficultyLabel}. Completa las ${selectedDifficultyChecklist.length} correspondientes a esta ruta. Pendientes: ${missingChecklistItems.length ? missingChecklistItems.join("; ") : "la lista enviada no corresponde a esta ruta"}.`,
            fields: missingChecklistItems,
          },
          { status: 400 },
        );
      }

      const [mainAttendance] = await db.find(attendance, { email, session: SESSION }, { columns: ["fullName"], limit: 1 });
      if (!mainAttendance) {
        return Response.json(
          {
            error:
              "Primero registra tu asistencia a la Sesión 5 principal con este mismo correo. Después podrás enviar la evidencia acreditable.",
          },
          { status: 400 },
        );
      }

      const [existing] = await db.find(sessionFiveEvidence, { email, session: SESSION, route: MAIN_ROUTE, activity: MAIN_EVIDENCE_ACTIVITY }, { columns: ["participantId"], limit: 1 });
      const participantId = existing?.participantId || (await participantIdFor(email));
      const code = confirmationCode("EV5");
      const checklistJson = JSON.stringify(checklistResult.checklist);

      await db.upsert(
        sessionFiveEvidence,
        {
          participantId,
          fullName: mainAttendance.fullName,
          email,
          session: SESSION,
          route: MAIN_ROUTE,
          activity: MAIN_EVIDENCE_ACTIVITY,
          sequenceKey,
          sequenceTitle,
          educationalLevel,
          subject,
          difficultyLevel,
          instrumentType,
          learningPurpose,
          pedagogicalContext,
          sourceCase,
          instrumentDesign,
          criteriaDescriptors,
          prompt,
          aiDraft,
          datasetSummary,
          findings,
          groupComparison,
          teacherDecision,
          limitations,
          adaptation,
          checklistJson,
          status: "recibida",
          confirmationCode: code,
        },
        {
          fullName: mainAttendance.fullName,
          sequenceKey,
          sequenceTitle,
          educationalLevel,
          subject,
          difficultyLevel,
          instrumentType,
          learningPurpose,
          pedagogicalContext,
          sourceCase,
          instrumentDesign,
          criteriaDescriptors,
          prompt,
          aiDraft,
          datasetSummary,
          findings,
          groupComparison,
          teacherDecision,
          limitations,
          adaptation,
          checklistJson,
          attempt: increment(1),
          responseVersion: increment(1),
          status: "recibida",
          confirmationCode: code,
          updatedAt: currentTimestamp,
        },
      );

      const pdfAccessCode = await createPdfAccessCode("S5", email, code);

      return Response.json(
        {
          ok: true,
          confirmationCode: code,
          folio: code,
          pdfAccessCode,
          message:
            "Tu evidencia de la Sesión 5 fue guardada correctamente. El registro incluye instrumento, conjunto de datos, hallazgos, comparación y decisión docente.",
          updatedPreviousResponse: Boolean(existing),
          sheetSync: "synced",
        },
        { status: existing ? 200 : 201 },
      );
    }

    return Response.json(
      {
        error:
          "La actividad indicada no corresponde a la Sesión 5. Regresa a la sección anterior e inténtalo nuevamente.",
      },
      { status: 400 },
    );
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
