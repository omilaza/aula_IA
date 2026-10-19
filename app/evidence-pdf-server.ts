import { env } from "cloudflare:workers";

export type EvidenceSession = "S1" | "S2" | "S3" | "S4" | "S5P" | "S5" | "S6";

export type EvidencePdfSection = {
  title: string;
  fields: Array<{ label: string; value: unknown }>;
};

export type EvidencePdfDocument = {
  session: EvidenceSession;
  title: string;
  savedAt?: string;
  confirmationCode: string;
  participant: Array<{ label: string; value: unknown }>;
  sections: EvidencePdfSection[];
};

export type EvidencePortfolioPdfDocument = {
  email: string;
  documents: EvidencePdfDocument[];
  generatedAt?: string;
};

type PdfEnvironment = Cloudflare.Env & {
  PDF_EXPORT_SECRET?: string;
};

type PdfLine = {
  text: string;
  bold?: boolean;
  size?: number;
  gapBefore?: number;
};

type PdfPage = {
  lines: PdfLine[];
  header: string;
  footer: string;
};

const encoder = new TextEncoder();
const cp1252: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function pdfSecret() {
  const value = (env as PdfEnvironment).PDF_EXPORT_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signAccessCode(secret: string, session: EvidenceSession, email: string, confirmationCode: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${session}\u0000${email.trim().toLowerCase()}\u0000${confirmationCode}`),
  );
  return `PDF${session.slice(1)}-${base64Url(new Uint8Array(signature))}`;
}

export async function createPdfAccessCode(
  session: EvidenceSession,
  email: string,
  confirmationCode: string,
) {
  const secret = pdfSecret();
  if (!secret) return null;
  try {
    return await signAccessCode(secret, session, email, confirmationCode);
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string) {
  const max = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < max; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export async function verifyPdfAccessCode(
  session: EvidenceSession,
  email: string,
  confirmationCode: string,
  candidate: string,
) {
  const secret = pdfSecret();
  if (!secret || !candidate.startsWith(`PDF${session.slice(1)}-`)) return false;
  try {
    return constantTimeEqual(
      await signAccessCode(secret, session, email, confirmationCode),
      candidate.trim(),
    );
  } catch {
    return false;
  }
}

function cleanText(value: unknown) {
  if (value === null || value === undefined || value === "") return "No registrado";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\u0000", "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replaceAll("→", "->")
    .slice(0, 30_000)
    .trim() || "No registrado";
}

export function readableJson(value: unknown) {
  const text = cleanText(value);
  if (!text.startsWith("{") && !text.startsWith("[")) return text;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => `- ${cleanText(item)}`).join("\n") || "Sin elementos";
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed as Record<string, unknown>)
        .map(([key, item]) => `${key}: ${cleanText(item)}`)
        .join("\n") || "Sin elementos";
    }
  } catch {
    return text;
  }
  return text;
}

function wrapParagraph(text: string, maxChars = 92) {
  const output: string[] = [];
  for (const rawLine of cleanText(text).split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      output.push("");
      continue;
    }
    const words = line.split(/\s+/);
    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (`${current} ${word}`.length <= maxChars) {
        current += ` ${word}`;
      } else {
        output.push(current);
        current = word;
      }
    }
    if (current) output.push(current);
  }
  return output;
}

function byteForCharacter(character: string) {
  const code = character.codePointAt(0) || 0x3f;
  if (code <= 0xff) return code;
  return cp1252[code] ?? 0x3f;
}

function hexText(text: string) {
  let output = "";
  for (const character of cleanText(text)) {
    output += byteForCharacter(character).toString(16).padStart(2, "0");
  }
  return `<${output}>`;
}

function documentLines(document: EvidencePdfDocument, generatedAt = new Date().toISOString()) {
  const lines: PdfLine[] = [];
  lines.push({ text: document.title, bold: true, size: 15 });
  lines.push({ text: "Comprobante generado desde el registro guardado en AULA-IA.", size: 9 });
  lines.push({ text: "No sustituye la evaluación ni la validación institucional.", size: 9 });
  lines.push({ text: `Fecha de generación: ${generatedAt}`, size: 9, gapBefore: 4 });
  lines.push({ text: `Fecha del registro: ${cleanText(document.savedAt)}`, size: 9 });
  lines.push({ text: `Código de evidencia: ${document.confirmationCode}`, size: 9 });
  lines.push({ text: "Datos de referencia del participante", bold: true, size: 12, gapBefore: 10 });
  for (const field of document.participant) {
    for (const [index, wrapped] of wrapParagraph(`${field.label}: ${readableJson(field.value)}` ).entries()) {
      lines.push({ text: wrapped, bold: index === 0 && field.label.length < 24, size: 9.5 });
    }
  }
  for (const section of document.sections) {
    lines.push({ text: section.title, bold: true, size: 12, gapBefore: 10 });
    for (const field of section.fields) {
      lines.push({ text: field.label, bold: true, size: 9.5, gapBefore: 4 });
      for (const wrapped of wrapParagraph(readableJson(field.value))) {
        lines.push({ text: wrapped || " ", size: 9.2 });
      }
    }
  }
  lines.push({ text: "Privacidad", bold: true, size: 12, gapBefore: 10 });
  lines.push({ text: "Este comprobante no debe contener nombres, matrículas, diagnósticos ni otros datos personales del alumnado.", size: 9.2 });
  return lines;
}

function paginate(lines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let y = 702;
  for (const line of lines) {
    const size = line.size ?? 9.2;
    const needed = (line.gapBefore ?? 0) + size + 4;
    if (page.length && y - needed < 54) {
      pages.push(page);
      page = [];
      y = 702;
    }
    page.push(line);
    y -= needed;
  }
  if (page.length) pages.push(page);
  return pages;
}

function pageStream(page: PdfPage, pageNumber: number, pageCount: number) {
  const commands = [
    "q",
    "0.216 0.188 0.420 rg",
    "48 742 516 2 re f",
    "BT /F2 10 Tf 0.216 0.188 0.420 rg 48 755 Td " + hexText(page.header) + " Tj ET",
  ];
  let y = 702;
  for (const line of page.lines) {
    const size = line.size ?? 9.2;
    y -= line.gapBefore ?? 0;
    const font = line.bold ? "F2" : "F1";
    const color = line.bold ? "0.216 0.188 0.420" : "0.149 0.137 0.231";
    commands.push(`BT /${font} ${size.toFixed(1)} Tf ${color} rg 48 ${y.toFixed(1)} Td ${hexText(line.text)} Tj ET`);
    y -= size + 4;
  }
  commands.push(
    "0.847 0.812 0.906 RG 48 42 m 564 42 l S",
    `BT /F1 8 Tf 0.408 0.388 0.478 rg 48 26 Td ${hexText(`${page.footer} · Página ${pageNumber} de ${pageCount}`)} Tj ET`,
    "Q",
  );
  return commands.join("\n");
}

function latin1Bytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}

function concatBytes(parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function buildPdf(pages: PdfPage[]) {
  const objects: string[] = [];
  const pageRefs = pages.map((_, index) => `${5 + index * 2} 0 R`);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((page, index) => {
    const pageObject = 5 + index * 2;
    const contentObject = pageObject + 1;
    const stream = pageStream(page, index + 1, pages.length);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const chunks: Uint8Array[] = [latin1Bytes("%PDF-1.4\n%âãÏÓ\n")];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const bytes = latin1Bytes(`${index + 1} 0 obj\n${object}\nendobj\n`);
    chunks.push(bytes);
    offset += bytes.length;
  });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(latin1Bytes(xref));
  return concatBytes(chunks);
}

export function buildEvidencePdf(document: EvidencePdfDocument) {
  const pages = paginate(documentLines(document)).map((lines) => ({
    lines,
    header: `AULA-IA · ${document.session} · Red de Docentes Transdisciplinares`,
    footer: `AULA-IA ${document.session}`,
  }));
  return buildPdf(pages);
}

export function buildEvidencePortfolioPdf(portfolio: EvidencePortfolioPdfDocument) {
  if (!portfolio.documents.length) throw new Error("El portafolio no contiene evidencias.");

  const generatedAt = portfolio.generatedAt ?? new Date().toISOString();
  const participantName = portfolio.documents[0]?.participant.find((field) => field.label === "Nombre")?.value;
  const sessionGroups = portfolio.documents.map((document) => ({
    document,
    pages: paginate(documentLines(document, generatedAt)),
  }));
  const indexPageCount = 1;
  let nextPage = indexPageCount + 2;
  const indexEntries = sessionGroups.map(({ document, pages }) => {
    const entry = { document, page: nextPage };
    nextPage += pages.length;
    return entry;
  });

  const coverLines: PdfLine[] = [
    { text: "PORTAFOLIO INSTITUCIONAL DE EVIDENCIAS", bold: true, size: 21, gapBefore: 58 },
    { text: "AULA-IA - Sesiones 1 a 5", bold: true, size: 15, gapBefore: 8 },
    { text: "Red de Docentes Transdisciplinares", size: 11, gapBefore: 4 },
    { text: "Documento de recuperación construido desde los registros guardados.", size: 10, gapBefore: 28 },
    { text: `Participante: ${cleanText(participantName)}`, size: 10, gapBefore: 14 },
    { text: `Correo de referencia: ${cleanText(portfolio.email)}`, size: 10 },
    { text: `Fecha de generación: ${generatedAt}`, size: 10 },
    { text: `Evidencias incluidas: ${portfolio.documents.length} de 5`, size: 10 },
    { text: "Alcance del documento", bold: true, size: 12, gapBefore: 32 },
    { text: "Integra únicamente las evidencias principales disponibles de las sesiones 1 a 5.", size: 10 },
    { text: "No incluye borradores locales ni la preparación de la Sesión 5.", size: 10 },
    { text: "No sustituye la evaluación ni la validación institucional.", bold: true, size: 10, gapBefore: 8 },
  ];

  const indexLines: PdfLine[] = [
    { text: "ÍNDICE DE EVIDENCIAS", bold: true, size: 17 },
    { text: "Cada apartado inicia en una página nueva y conserva el folio de su registro.", size: 9.5, gapBefore: 5 },
  ];
  for (const [index, entry] of indexEntries.entries()) {
    indexLines.push(
      { text: `${index + 1}. ${entry.document.title}`, bold: true, size: 10.5, gapBefore: 12 },
      { text: `Sesión: ${entry.document.session} · Página inicial: ${entry.page}`, size: 9.2 },
      { text: `Fecha del registro: ${cleanText(entry.document.savedAt)}`, size: 9.2 },
      { text: `Folio: ${entry.document.confirmationCode}`, size: 9.2 },
    );
  }

  const pages: PdfPage[] = [
    {
      lines: coverLines,
      header: "AULA-IA · Portafolio de evidencias",
      footer: "AULA-IA · Portafolio S1-S5",
    },
    {
      lines: indexLines,
      header: "AULA-IA · Índice del portafolio",
      footer: "AULA-IA · Portafolio S1-S5",
    },
  ];
  for (const { document, pages: documentPages } of sessionGroups) {
    pages.push(...documentPages.map((lines) => ({
      lines,
      header: `AULA-IA · ${document.session} · Evidencia principal`,
      footer: `AULA-IA · Portafolio ${document.session}`,
    })));
  }
  return buildPdf(pages);
}
