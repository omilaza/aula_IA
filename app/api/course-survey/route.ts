import { getDb } from "../../../db";
import { courseSatisfactionSurveyResponses } from "../../../db/schema";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,160}$/;
const recommendationOptions = [
  "definitely_yes",
  "probably_yes",
  "unsure",
  "probably_no",
  "definitely_no",
] as const;
const recommendationValues = new Set<string>(recommendationOptions);
const responseHeaders = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  Vary: "Origin",
};

type JsonRecord = Record<string, unknown>;
type FieldIssue = { field: string; message: string };

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: unknown) {
  return clean(value, 180).toLowerCase();
}

function optionalRating(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : undefined;
}

function referenceCode() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-7);
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase();
  return `SURV-${stamp}-${random}`;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: responseHeaders });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function invalidResponse(issues: FieldIssue[]) {
  return json(
    {
      error: "Revisa los campos indicados antes de enviar la encuesta.",
      fields: issues.map(({ field }) => field),
      issues,
    },
    400,
  );
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  if (message.includes("no such table")) {
    return "La encuesta todavía no está disponible para recibir respuestas. No se guardó información.";
  }
  return "No fue posible registrar tu opinión. Conserva esta página abierta e inténtalo nuevamente.";
}

export async function GET() {
  return json({
    ok: true,
    action: "submit",
    ratingScale: { min: 1, max: 5 },
    requiredFields: [
      "generalRating",
      "contentRating",
      "instructorRating",
      "platformRating",
    ],
    optionalFields: [
      "activitiesRating",
      "materialsRating",
      "materialsNotUsed",
      "recommendationApplication",
      "likedMost",
      "improvements",
      "additionalComments",
      "name",
      "email",
    ],
    recommendationOptions,
    privacy: "Las respuestas pueden ser anónimas y se analizarán de forma agregada.",
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return json({ error: "No fue posible procesar el envío desde este sitio." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "La encuesta debe enviarse desde su formulario." }, 415);
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 80_000) {
    return json({ error: "La respuesta supera el tamaño permitido." }, 413);
  }

  let payload: JsonRecord;
  try {
    const parsed = (await request.json()) as unknown;
    if (!isRecord(parsed)) throw new Error("invalid payload");
    payload = parsed;
  } catch {
    return json({ error: "No pudimos leer la encuesta. No se guardó información." }, 400);
  }

  if (clean(payload.action, 30) !== "submit") {
    return json({ error: "La acción indicada no corresponde a esta encuesta." }, 400);
  }

  const idempotencyKey = clean(payload.idempotencyKey, 160);
  const generalRating = optionalRating(payload.generalRating);
  const contentRating = optionalRating(payload.contentRating);
  const instructorRating = optionalRating(payload.instructorRating);
  const platformRating = optionalRating(payload.platformRating);
  const requestedActivitiesRating = optionalRating(payload.activitiesRating);
  const activitiesRating =
    typeof requestedActivitiesRating === "number" ? requestedActivitiesRating : null;
  const materialsNotUsed = payload.materialsNotUsed === true;
  const requestedMaterialsRating = optionalRating(payload.materialsRating);
  const materialsRating =
    !materialsNotUsed && typeof requestedMaterialsRating === "number"
      ? requestedMaterialsRating
      : null;
  const requestedRecommendation = clean(payload.recommendationApplication, 40);
  const recommendationApplication = recommendationValues.has(requestedRecommendation)
    ? requestedRecommendation
    : "";
  const name = clean(payload.name, 160);
  const requestedEmail = normalizeEmail(payload.email);
  const email = requestedEmail;
  const issues: FieldIssue[] = [];

  if (!idempotencyKeyPattern.test(idempotencyKey)) {
    issues.push({
      field: "idempotencyKey",
      message: "No pudimos preparar un envío seguro. Recarga la página e inténtalo nuevamente.",
    });
  }

  for (const [field, label, value] of [
    ["generalRating", "Satisfacción general con el curso", generalRating],
    ["contentRating", "Calidad y pertinencia de los contenidos", contentRating],
    ["instructorRating", "Desempeño y acompañamiento del instructor", instructorRating],
    ["platformRating", "Utilidad y facilidad de uso de la plataforma", platformRating],
  ] as const) {
    if (value === null || value === undefined) {
      issues.push({ field, message: `Selecciona de 1 a 5 estrellas en “${label}”.` });
    }
  }

  if (email && !emailPattern.test(email)) {
    issues.push({
      field: "email",
      message: "Escribe un correo válido o deja este campo vacío.",
    });
  }

  if (issues.length) return invalidResponse(issues);

  const likedMost = clean(payload.likedMost, 6_000);
  const improvements = clean(payload.improvements, 6_000);
  const additionalComments = clean(payload.additionalComments, 6_000);

  try {
    const db = getDb();
    // The bridge checks the idempotency key and writes under one script lock.
    // A retry therefore returns the original row and folio without replacing it.
    const { row: saved, inserted } = await db.insertIfAbsent(
      courseSatisfactionSurveyResponses,
      {
        idempotencyKey,
        isAnonymous: !name && !email,
        name,
        email,
        generalRating: generalRating as number,
        contentRating: contentRating as number,
        instructorRating: instructorRating as number,
        platformRating: platformRating as number,
        activitiesRating,
        materialsRating,
        materialsNotUsed,
        recommendationApplication,
        likedMost,
        improvements,
        additionalComments,
        referenceCode: referenceCode(),
      },
    );
    const idempotent = !inserted;
    return json(
      {
        ok: true,
        referenceCode: saved.referenceCode,
        message: idempotent
          ? "Tu opinión ya había sido registrada. Gracias por compartirla."
          : "Tu opinión fue registrada. Gracias por ayudarnos a mejorar el curso.",
        ...(idempotent ? { idempotent: true } : {}),
        sheetSync: "synced",
      },
      idempotent ? 200 : 201,
    );
  } catch (error) {
    return json({ error: routeError(error) }, 500);
  }
}
