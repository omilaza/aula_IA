import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("PDF contracts distinguish S5 preparation from S5 principal evidence", async () => {
  const [server, component, route] = await Promise.all([
    read("../app/evidence-pdf-server.ts"),
    read("../app/evidence-pdf-download.tsx"),
    read("../app/api/evidence-pdf/route.ts"),
  ]);

  assert.match(server, /"S5P" \| "S5" \| "S6"/);
  assert.match(component, /"S5P" \| "S5"/);
  assert.match(route, /new Set<EvidenceSession>\(\["S1", "S2", "S3", "S4", "S5P", "S5", "S6"\]\)/);
  assert.match(route, /clean\(payload\.session, 3\)/);
  assert.match(route, /\^PDF\(\?:\[1-6\]\|5P\)-/);
  assert.match(route, /if \(session === "S5P"\) return sessionFivePreparationDocument/);
  assert.match(route, /if \(session === "S5"\) return sessionFiveDocument\(email\)/);
  assert.match(route, /verifyPdfAccessCode\(session, email, document\.confirmationCode, code\)/);
});

test("S5P recovery reads only the final preparation activity from leveling records", async () => {
  const route = await read("../app/api/evidence-pdf/route.ts");
  const start = route.indexOf("async function sessionFivePreparationDocument");
  const end = route.indexOf("async function sessionFiveDocument", start);
  const block = route.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(block, /\.from\(levelingRecords\)/);
  assert.match(block, /eq\(levelingRecords\.session, "S5"\)/);
  assert.match(block, /eq\(levelingRecords\.route, "preparatoria"\)/);
  assert.match(block, /eq\(levelingRecords\.activity, "nivelacion-instrumentos"\)/);
  assert.match(block, /session: "S5P"/);
  assert.doesNotMatch(block, /sessionFiveEvidence|attendanceFor/);
});

test("S5 recovery reads only the authoritative principal D1 evidence", async () => {
  const route = await read("../app/api/evidence-pdf/route.ts");
  const start = route.indexOf("async function sessionFiveDocument");
  const end = route.indexOf("export async function loadEvidenceDocument", start);
  const block = route.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(block, /\.from\(sessionFiveEvidence\)/);
  assert.match(block, /eq\(sessionFiveEvidence\.session, "S5"\)/);
  assert.match(block, /eq\(sessionFiveEvidence\.route, "principal"\)/);
  assert.match(block, /eq\(sessionFiveEvidence\.activity, "evidencia-principal"\)/);
  assert.match(block, /session: "S5"/);
  assert.doesNotMatch(block, /\.insert\(|\.update\(|\.delete\(|syncToInstitutionalSheet/);
  assert.match(route, /verifyPdfAccessCode\(session, email, document\.confirmationCode, code\)/);
});

test("S5 PDF documents include every agreed evidence field and private download headers remain intact", async () => {
  const route = await read("../app/api/evidence-pdf/route.ts");
  for (const field of [
    "sequenceKey",
    "sequenceTitle",
    "educationalLevel",
    "subject",
    "difficultyLevel",
    "instrumentType",
    "learningPurpose",
    "pedagogicalContext",
    "sourceCase",
    "instrumentDesign",
    "criteriaDescriptors",
    "prompt",
    "aiDraft",
    "datasetSummary",
    "findings",
    "groupComparison",
    "teacherDecision",
    "limitations",
    "adaptation",
    "checklistJson",
  ]) {
    assert.match(route, new RegExp(`evidence\\.${field}\\b`));
  }
  assert.match(route, /label: "Prompt conservado", value: evidence\.prompt/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /"X-Content-Type-Options": "nosniff"/);
  assert.match(route, /"Referrer-Policy": "no-referrer"/);
});

test("Session 5 interfaces request the matching preparation and principal PDF credentials", async () => {
  const [prep, main] = await Promise.all([
    read("../app/session-five-prep.tsx"),
    read("../app/session-five.tsx"),
  ]);

  assert.match(prep, /fetch\("\/api\/session-five"/);
  assert.match(prep, /action: "leveling_activity"/);
  assert.match(prep, /activity: "nivelacion-instrumentos"/);
  assert.match(prep, /EvidencePdfDownload session="S5P"/);
  assert.match(main, /action: "s5_evidence"/);
  assert.match(main, /EvidencePdfDownload session="S5"/);
});
