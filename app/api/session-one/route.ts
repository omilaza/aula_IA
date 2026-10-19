import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  attendance,
  diagnostics,
  exitTickets,
  icebreakerResponses,
  labEvidence,
} from "../../../db/schema";
import { syncToInstitutionalSheet } from "../../sheets-sync";
import { createPdfAccessCode } from "../../evidence-pdf-server";

const categories = new Set([
  "planeacion",
  "adaptacion",
  "evaluacion",
  "retroalimentacion",
  "administracion",
  "otra",
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const knowledgeKey: Record<string, string> = {
  D7: "B",
  D8: "C",
  D9: "B",
  D10: "A",
  D11: "C",
  D12: "D",
};
const labChecklistItems = [
  "La necesidad docente está formulada con claridad.",
  "Se indican nivel, asignatura o campo formativo.",
  "Se describen destinatarios sin datos identificables.",
  "Se precisan tiempo y recursos disponibles.",
  "Se pide un producto y un formato concretos.",
  "Se incluyen restricciones o necesidades de inclusión.",
  "Se protegen datos personales y sensibles.",
  "Se establecen fuentes, límites o asuntos por verificar.",
  "Se revisan aplicabilidad, exactitud y posibles sesgos.",
  "El prompt se ajusta después de leer la respuesta.",
] as const;

function clean(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: unknown) {
  return clean(value, 180).toLowerCase();
}

function code(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  if (message.includes("no such table")) {
    return "La base de datos todavía no está preparada. Intenta de nuevo después de la publicación.";
  }
  return "No fue posible guardar la respuesta. Intenta de nuevo en un momento.";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("view") !== "icebreaker") {
    return Response.json({ error: "Consulta no disponible" }, { status: 400 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        category: icebreakerResponses.category,
        count: sql<number>`count(*)`,
      })
      .from(icebreakerResponses)
      .where(eq(icebreakerResponses.session, "S1"))
      .groupBy(icebreakerResponses.category);

    const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
    return Response.json({
      total,
      counts: Object.fromEntries(rows.map((row) => [row.category, Number(row.count)])),
    });
  } catch (error) {
    return Response.json({ error: routeError(error), total: 0, counts: {} }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const action = clean(payload.action, 40);

  try {
    const db = getDb();

    if (action === "icebreaker") {
      const category = clean(payload.category, 40);
      const task = clean(payload.task, 160);
      if (!categories.has(category) || task.length < 4) {
        return Response.json({ error: "Completa la tarea y selecciona una categoría." }, { status: 400 });
      }
      await db.insert(icebreakerResponses).values({ category, task });
      const sheetSync = await syncToInstitutionalSheet({ action, category, task });
      return Response.json({ ok: true, sheetSync: sheetSync.status }, { status: 201 });
    }

    if (action === "attendance") {
      const email = normalizeEmail(payload.email);
      const fullName = clean(payload.fullName, 160);
      const institution = clean(payload.institution, 180);
      const role = clean(payload.role, 80);
      const consent = payload.consent === true;
      if (!emailPattern.test(email) || !fullName || !institution || !role || !consent) {
        return Response.json({ error: "Revisa los campos obligatorios y el aviso de privacidad." }, { status: 400 });
      }
      const confirmationCode = code("AS1");
      await db
        .insert(attendance)
        .values({ email, fullName, institution, role, consent, confirmationCode })
        .onConflictDoUpdate({
          target: [attendance.session, attendance.email],
          set: { fullName, institution, role, consent, confirmationCode, createdAt: sql`CURRENT_TIMESTAMP` },
        });
      const sheetSync = await syncToInstitutionalSheet({
        action,
        session: "S1",
        email,
        fullName,
        institution,
        role,
        consent,
        confirmationCode,
      });
      return Response.json({ ok: true, confirmationCode, sheetSync: sheetSync.status }, { status: 201 });
    }

    if (action === "diagnostic") {
      const email = normalizeEmail(payload.email);
      const answers = payload.answers as Record<string, unknown> | undefined;
      const phase = clean(payload.phase, 10) === "post" ? "post" : "pre";
      if (!emailPattern.test(email) || !answers) {
        return Response.json({ error: "Escribe tu correo y responde los 12 reactivos." }, { status: 400 });
      }
      const likert = ["D1", "D2", "D3", "D4", "D5", "D6"].map((key) => Number(answers[key]));
      const knowledge = ["D7", "D8", "D9", "D10", "D11", "D12"].map((key) => clean(answers[key], 1));
      if (likert.some((value) => !Number.isInteger(value) || value < 1 || value > 5) || knowledge.some((value) => !/^[A-D]$/.test(value))) {
        return Response.json({ error: "Falta al menos un reactivo por responder." }, { status: 400 });
      }
      const likertAverage = Math.round((likert.reduce((sum, value) => sum + value, 0) / 6) * 100);
      const knowledgeScore = knowledge.reduce((score, value, index) => {
        const key = `D${index + 7}`;
        return score + (knowledgeKey[key] === value ? 1 : 0);
      }, 0);
      const confirmationCode = code("DS1");
      await db
        .insert(diagnostics)
        .values({
          email,
          phase,
          answersJson: JSON.stringify(answers),
          likertAverage,
          knowledgeScore,
          confirmationCode,
        })
        .onConflictDoUpdate({
          target: [diagnostics.phase, diagnostics.email],
          set: {
            answersJson: JSON.stringify(answers),
            likertAverage,
            knowledgeScore,
            confirmationCode,
            createdAt: sql`CURRENT_TIMESTAMP`,
          },
        });
      const sheetSync = await syncToInstitutionalSheet({
        action,
        phase,
        email,
        answers,
        likertAverage: likertAverage / 100,
        knowledgeScore,
        confirmationCode,
      });
      return Response.json({ ok: true, confirmationCode, knowledgeScore, likertAverage: likertAverage / 100, sheetSync: sheetSync.status }, { status: 201 });
    }

    if (action === "lab") {
      const email = normalizeEmail(payload.email);
      const route = clean(payload.route, 30);
      const caseKey = clean(payload.caseKey, 30) || "propio";
      const context = payload.context as Record<string, unknown> | undefined;
      const promptV1 = clean(payload.promptV1, 4000);
      const promptV2 = clean(payload.promptV2, 8000);
      const responseV1 = clean(payload.responseV1, 10000);
      const responseV2 = clean(payload.responseV2, 10000);
      const review = clean(payload.review, 4000);
      const checklist = payload.checklist && typeof payload.checklist === "object" && !Array.isArray(payload.checklist)
        ? Object.fromEntries(
            Object.entries(payload.checklist as Record<string, unknown>)
              .slice(0, 10)
              .map(([item, value]) => [clean(item, 240), clean(value, 12)]),
          )
        : {};
      const yesCount = Object.values(checklist).filter((value) => value === "si").length;
      if (!emailPattern.test(email)) return Response.json({ error: "Escribe el mismo correo que utilizaste para registrar tu asistencia.", fields: ["Correo para vincular la evidencia"] }, { status: 400 });
      if (!["basica", "intermedia", "avanzada"].includes(route)) return Response.json({ error: "Selecciona una ruta válida: Básica, Intermedia o Avanzada.", fields: ["Ruta"] }, { status: 400 });
      const contextFields: Array<readonly [string, string, number]> = [
        ["Tema o necesidad", clean(context?.topic, 1200), 3], ["Nivel y grado/semestre", clean(context?.level, 1200), 3], ["Asignatura o campo", clean(context?.subject, 1200), 3], ["Características relevantes del grupo", clean(context?.group, 1200), 3], ["Propósito de aprendizaje", clean(context?.purpose, 1200), 3], ["Tiempo disponible", clean(context?.time, 1200), 3], ["Recursos disponibles", clean(context?.resources, 1200), 3], ["Producto o evidencia", clean(context?.product, 1200), 3], ["Restricciones y privacidad", clean(context?.constraints, 1200), 3], ["Inclusión y accesibilidad", clean(context?.inclusion, 1200), 3], ["Qué deberá verificarse", clean(context?.verification, 1200), 3], ["Formato de salida esperado", clean(context?.outputFormat, 1200), 3],
      ];
      const criticalFields: Array<readonly [string, string, number]> = [["Petición V1", promptV1, 5], ["Petición V2 contextualizada", promptV2, 30], ["Comparación crítica", review, 20]];
      const missingCriticalFields = [...contextFields, ...criticalFields].filter(([, value, minimum]) => value.length < minimum).map(([label]) => label);
      if (missingCriticalFields.length) {
        return Response.json({ error: `No podemos completar el laboratorio todavía. Revisa: ${missingCriticalFields.join("; ")}.`, fields: missingCriticalFields }, { status: 400 });
      }
      const missingChecklistItems = labChecklistItems.filter((item) => !checklist[item]);
      if (missingChecklistItems.length || yesCount < 6) {
        return Response.json({ error: `${missingChecklistItems.length ? `Valora los diez indicadores. Pendientes: ${missingChecklistItems.join("; ")}. ` : ""}Se requieren al menos 6 respuestas Sí; actualmente hay ${yesCount}.`, fields: missingChecklistItems.length ? missingChecklistItems : ["Al menos seis respuestas Sí"] }, { status: 400 });
      }
      const [registeredAttendance] = await db.select({ id: attendance.id }).from(attendance).where(and(eq(attendance.email, email), eq(attendance.session, "S1"))).limit(1);
      if (!registeredAttendance) return Response.json({ error: "Primero registra tu asistencia a la Sesión 1 con este mismo correo.", fields: ["Correo para vincular la evidencia"] }, { status: 400 });
      const evidenceCode = code("LAB1");
      await db
        .insert(labEvidence)
        .values({
          email,
          route,
          caseKey,
          contextJson: JSON.stringify(context),
          promptV1,
          promptV2,
          responseV1,
          responseV2,
          review,
          checklistJson: JSON.stringify(checklist),
          evidenceCode,
        })
        .onConflictDoUpdate({
          target: [labEvidence.session, labEvidence.email],
          set: {
            route,
            caseKey,
            contextJson: JSON.stringify(context),
            promptV1,
            promptV2,
            responseV1,
            responseV2,
            review,
            checklistJson: JSON.stringify(checklist),
            evidenceCode,
            createdAt: sql`CURRENT_TIMESTAMP`,
          },
        });
      const sheetSync = await syncToInstitutionalSheet({
        action,
        session: "S1",
        email,
        route,
        caseKey,
        context,
        promptV1,
        promptV2,
        responseV1,
        responseV2,
        review,
        checklist,
        yesCount,
        evidenceCode,
      });
      return Response.json({ ok: true, evidenceCode, sheetSync: sheetSync.status }, { status: 201 });
    }

    if (action === "exit") {
      const email = normalizeEmail(payload.email);
      const caseChosen = clean(payload.caseChosen, 80);
      const principalContext = clean(payload.principalContext, 800);
      const risk = clean(payload.risk, 800);
      const responseChangedBecause = clean(payload.responseChangedBecause, 800);
      const preserve = clean(payload.preserve, 600);
      const correct = clean(payload.correct, 600);
      const verify = clean(payload.verify, 600);
      const confidence = Number(payload.confidence);
      const criticalExitFields: Array<readonly [string, string, number]> = [["Caso elegido", caseChosen, 1], ["Principal contexto agregado", principalContext, 5], ["Riesgo o supuesto detectado", risk, 5], ["La respuesta cambió porque", responseChangedBecause, 5], ["Conservaría", preserve, 3], ["Corregiría", correct, 3], ["Verificaría", verify, 3]];
      const missingExitFields = criticalExitFields.filter(([, value, minimum]) => value.length < minimum).map(([label]) => label);
      if (!emailPattern.test(email)) missingExitFields.unshift("Correo de registro");
      if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) missingExitFields.push("Confianza de 1 a 5");
      if (missingExitFields.length) {
        return Response.json({ error: `No podemos acreditar todavía. Revisa: ${missingExitFields.join("; ")}.`, fields: missingExitFields }, { status: 400 });
      }
      const [linkedLab] = await db
        .select({ evidenceCode: labEvidence.evidenceCode, caseKey: labEvidence.caseKey })
        .from(labEvidence)
        .where(and(eq(labEvidence.email, email), eq(labEvidence.session, "S1")))
        .limit(1);
      if (!linkedLab) {
        return Response.json({ error: "Primero guarda la ficha y el prompt V2 del laboratorio con este mismo correo." }, { status: 400 });
      }
      const learning = JSON.stringify({ caseChosen, principalContext, responseChangedBecause });
      const application = JSON.stringify({ risk, preserve, correct, verify });
      const remainingQuestion = JSON.stringify({ labEvidenceCode: linkedLab.evidenceCode, labCaseKey: linkedLab.caseKey });
      const evidenceCode = code("SAL1");
      await db
        .insert(exitTickets)
        .values({ email, learning, application, remainingQuestion, confidence, evidenceCode })
        .onConflictDoUpdate({
          target: [exitTickets.session, exitTickets.email],
          set: { learning, application, remainingQuestion, confidence, evidenceCode, createdAt: sql`CURRENT_TIMESTAMP` },
        });
      const sheetSync = await syncToInstitutionalSheet({
        action,
        session: "S1",
        email,
        caseChosen,
        principalContext,
        risk,
        responseChangedBecause,
        preserve,
        correct,
        verify,
        confidence,
        evidenceCode,
        linkedLabEvidenceCode: linkedLab.evidenceCode,
      });
      const pdfAccessCode = await createPdfAccessCode("S1", email, evidenceCode);
      return Response.json({ ok: true, evidenceCode, pdfAccessCode, linkedLabEvidenceCode: linkedLab.evidenceCode, sheetSync: sheetSync.status }, { status: 201 });
    }

    return Response.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
