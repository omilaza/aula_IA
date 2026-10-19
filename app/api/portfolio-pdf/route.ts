import {
  buildEvidencePdf,
  buildEvidencePortfolioPdf,
  type EvidencePdfDocument,
} from "../../evidence-pdf-server";
import {
  loadEvidenceDocument,
  primaryEvidenceSessions,
} from "../evidence-pdf/route";

type JsonRecord = Record<string, unknown>;
type PrimaryEvidenceSession = (typeof primaryEvidenceSessions)[number];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genericError = "No fue posible recuperar las evidencias con los datos proporcionados.";
const sessionLabels: Record<PrimaryEvidenceSession, string> = {
  S1: "Sesión 1",
  S2: "Sesión 2",
  S3: "Sesión 3",
  S4: "Sesión 4",
  S5: "Sesión 5",
};

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: unknown) {
  return clean(value, 180).toLowerCase();
}

function privateHeaders(extra?: Record<string, string>) {
  return {
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    Vary: "Origin",
    ...extra,
  };
}

function jsonResponse(payload: JsonRecord, status = 200) {
  return Response.json(payload, { status, headers: privateHeaders() });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readPayload(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 4_096) return null;
  const raw = await request.text();
  if (!raw || raw.length > 4_096) return null;
  try {
    return JSON.parse(raw) as JsonRecord;
  } catch {
    return null;
  }
}

async function loadPrimaryDocuments(email: string) {
  const loaded = await Promise.all(
    primaryEvidenceSessions.map(async (session) => ({
      session,
      document: await loadEvidenceDocument(session, email),
    })),
  );
  return loaded as Array<{ session: PrimaryEvidenceSession; document: EvidencePdfDocument | null }>;
}

function pdfResponse(pdf: Uint8Array, filename: string) {
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: privateHeaders({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    }),
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: genericError }, 403);

  const payload = await readPayload(request);
  if (!payload) return jsonResponse({ error: genericError }, 400);

  const email = normalizeEmail(payload.email);
  const action = clean(payload.action, 16).toLowerCase();
  if (!emailPattern.test(email) || !["search", "download"].includes(action)) {
    return jsonResponse({ error: genericError }, 400);
  }

  try {
    const records = await loadPrimaryDocuments(email);

    if (action === "search") {
      const sessions = records.map(({ session, document }) => ({
        session,
        label: sessionLabels[session],
        available: Boolean(document),
      }));
      return jsonResponse({
        ok: true,
        sessions,
        availableCount: sessions.filter((session) => session.available).length,
      });
    }

    const target = clean(payload.target, 8).toUpperCase();
    if (target === "ALL") {
      const documents = records.flatMap(({ document }) => document ? [document] : []);
      if (!documents.length) return jsonResponse({ error: genericError }, 404);
      return pdfResponse(
        buildEvidencePortfolioPdf({ email, documents }),
        "AULA-IA_Portafolio_S1-S5.pdf",
      );
    }

    if (!primaryEvidenceSessions.includes(target as PrimaryEvidenceSession)) {
      return jsonResponse({ error: genericError }, 400);
    }
    const record = records.find(({ session }) => session === target);
    if (!record?.document) return jsonResponse({ error: genericError }, 404);
    return pdfResponse(
      buildEvidencePdf(record.document),
      `AULA-IA_${target}_Evidencia.pdf`,
    );
  } catch {
    return jsonResponse({ error: genericError }, 500);
  }
}
