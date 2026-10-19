import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("PDF access uses a separate strong HMAC credential and never the short confirmation code alone", async () => {
  const server = await read("../app/evidence-pdf-server.ts");
  assert.match(server, /PDF_EXPORT_SECRET/);
  assert.match(server, /value\.length >= 32/);
  assert.match(server, /name: "HMAC", hash: "SHA-256"/);
  assert.match(server, /crypto\.subtle\.sign/);
  assert.match(server, /constantTimeEqual/);
  assert.match(server, /`PDF\$\{session\.slice\(1\)\}-/);
});

test("every accreditable evidence save can return a PDF credential without changing earlier schemas", async () => {
  const [one, two, three, four, schema] = await Promise.all([
    read("../app/api/session-one/route.ts"),
    read("../app/api/session-two/route.ts"),
    read("../app/api/session-three/route.ts"),
    read("../app/api/session-four/route.ts"),
    read("../db/schema.ts"),
  ]);
  for (const [source, session] of [[one, "S1"], [two, "S2"], [three, "S3"], [four, "S4"]]) {
    assert.equal((source.match(/createPdfAccessCode\(/g) || []).length, 1);
    assert.match(source, new RegExp(`createPdfAccessCode\\(\"${session}\"`));
    assert.match(source, /pdfAccessCode/);
  }
  assert.doesNotMatch(schema, /pdfAccessCode|pdf_access_code|pdfExport/i);
});

test("PDF recovery reads the authoritative Sheets record, exposes POST only and performs no writes or sheet sync", async () => {
  const route = await read("../app/api/evidence-pdf/route.ts");
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /db\.find\(/);
  assert.match(route, /exitTickets/);
  assert.match(route, /sessionTwoEvidence/);
  assert.match(route, /sessionThreeEvidence/);
  assert.match(route, /sessionFourEvidence/);
  assert.doesNotMatch(route, /syncToInstitutionalSheet|\.insert\(|\.update\(|\.delete\(/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(route, /X-Content-Type-Options": "nosniff"/);
  assert.match(route, /AULA-IA_\$\{session\}_Evidencia\.pdf/);
});

test("all four session interfaces offer the same saved-evidence PDF mechanism", async () => {
  const [component, one, two, three, four] = await Promise.all([
    read("../app/evidence-pdf-download.tsx"),
    read("../app/session-one.tsx"),
    read("../app/session-two.tsx"),
    read("../app/session-three.tsx"),
    read("../app/session-four.tsx"),
  ]);
  assert.match(component, /Descargar mi evidencia en PDF/);
  assert.match(component, /Recuperar mi PDF con correo y código/);
  assert.match(component, /fetch\("\/api\/evidence-pdf"/);
  assert.match(one, /EvidencePdfDownload session="S1"/);
  assert.match(two, /EvidencePdfDownload session="S2"/);
  assert.match(three, /EvidencePdfDownload session="S3"/);
  assert.match(four, /EvidencePdfDownload session="S4"/);
});
