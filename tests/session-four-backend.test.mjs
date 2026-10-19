import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 4 backend separates preparation, attendance and accreditable evidence", async () => {
  const [route, schema] = await Promise.all([
    read("../app/api/session-four/route.ts"),
    read("../db/schema.ts"),
  ]);
  for (const action of ["leveling_attendance", "leveling_activity", "s4_main_attendance", "s4_evidence"]) {
    assert.match(route, new RegExp(`"${action}"`));
  }
  for (const prefix of ["NP4", "ACT4", "AS4", "EV4"]) {
    assert.match(route, new RegExp(`confirmationCode\\("${prefix}"\\)`));
  }
  assert.match(route, /const SESSION = "S4"/);
  assert.match(route, /sessionFourEvidence/);
  assert.match(schema, /export const sessionFourEvidence/);
  assert.match(schema, /session_four_evidence_control_unique/);
});

test("Session 4 evidence requires attendance and validates the exact selected route", async () => {
  const route = await read("../app/api/session-four/route.ts");
  assert.match(route, /eq\(attendance\.email, email\), eq\(attendance\.session, SESSION\)/);
  assert.match(route, /if \(!mainAttendance\)/);
  assert.match(route, /selectedCase\.level !== educationalLevel/);
  assert.match(route, /selectedCase\.subject !== subject/);
  assert.match(route, /difficultyLevels\.has\(difficultyLevel\)/);
  assert.match(route, /evaluationMoments\.has\(evaluationMoment\)/);
  assert.match(route, /checklistResult\.total !== selectedDifficultyChecklist\.length/);
  assert.match(route, /selectedDifficultyChecklist\.filter/);
  assert.match(route, /exactamente \$\{selectedDifficultyChecklist\.length\} casillas/);
  assert.match(route, /missingCriticalFields/);
  assert.match(route, /fields: missingCriticalFields/);
  assert.match(route, /fields: missingChecklistItems/);
  assert.ok([...route.matchAll(/\.onConflictDoUpdate\(/g)].length >= 4);
});

test("Session 4 reports every critical field while complementary metadata remains warning-only", async () => {
  const [route, client] = await Promise.all([
    read("../app/api/session-four/route.ts"),
    read("../app/session-four.tsx"),
  ]);
  for (const label of [
    "Criterios e indicadores",
    "Prompt principal",
    "Borrador de IA o contingencia",
    "Análisis de evidencia e inferencias",
    "Retroalimentación final",
    "Revisión docente del borrador",
    "Riesgo, sesgo o afirmación no sustentada",
    "Adaptación o apoyo",
    "Decisión final y ajuste realizado",
  ]) {
    assert.match(route, new RegExp(label));
    assert.match(client, new RegExp(label));
  }
  const criticalBlock = route.match(/const criticalFields[\s\S]*?\n      \];/)?.[0] || "";
  for (const complementary of ["evaluationTitle", "learningPurpose", "pedagogicalContext", "sourceCase"]) assert.doesNotMatch(criticalBlock, new RegExp(complementary));
  assert.match(client, /"warning"\);/);
  assert.match(client, /Guardar evidencia con advertencias/);
});

test("Session 4 saves local progress without accreditation and guides the participant to exact issues", async () => {
  const client = await read("../app/session-four.tsx");
  assert.match(client, /const PROGRESS_KEY = "aula-ia-s4-progress"/);
  assert.match(client, /const CHECKS_KEY = "aula-ia-s4-route-checks"/);
  assert.match(client, /status: "avance-local"/);
  assert.match(client, /No genera folio ni acredita la sesión/);
  assert.match(client, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(client, /<form[^>]+noValidate/);
  assert.match(client, /Guardar avance sin acreditar/);
  assert.match(client, /aria-invalid=/);
});

test("Session 4 changes difficulty without erasing shared answers or route-compatible checks", async () => {
  const client = await read("../app/session-four.tsx");
  const chooseDifficulty = client.match(/function chooseDifficulty[\s\S]*?\n  }\n\n  function chooseMoment/)?.[0] || "";
  assert.match(chooseDifficulty, /difficultyLevel: difficulty\.key/);
  assert.match(chooseDifficulty, /prompt: buildEvaluationPrompt/);
  assert.match(chooseDifficulty, /Se conservaron tus respuestas y las casillas compartidas/);
  assert.doesNotMatch(chooseDifficulty, /setChecks\(\{\}\)/);
  assert.doesNotMatch(chooseDifficulty, /resetCaseBoundEvidence/);
});

test("Session 4 mirrors only after D1 persistence and reports sheet state honestly", async () => {
  const route = await read("../app/api/session-four/route.ts");
  const evidenceInsert = route.indexOf(".insert(sessionFourEvidence)");
  const evidenceSync = route.lastIndexOf("syncToInstitutionalSheet");
  assert.ok(evidenceInsert > 0);
  assert.ok(evidenceSync > evidenceInsert);
  assert.match(route, /sheetSync: sheetSync\.status/);
  assert.doesNotMatch(route, /sincronizar[\s\S]{0,20}autom[aá]tic/i);
});

test("Session 4 migration is additive and leaves prior tables untouched", async () => {
  const drizzleDirectory = new URL("../drizzle/", import.meta.url);
  const files = (await readdir(drizzleDirectory)).filter((name) => name.endsWith(".sql"));
  let migration = "";
  for (const file of files) {
    const contents = await read(`../drizzle/${file}`);
    if (contents.includes("session_four_evidence")) migration = contents;
  }
  assert.match(migration, /CREATE TABLE `session_four_evidence`/);
  assert.match(migration, /CREATE UNIQUE INDEX `session_four_evidence_control_unique`/);
  assert.doesNotMatch(migration, /\b(?:DROP|ALTER|DELETE|UPDATE)\b/i);
  assert.doesNotMatch(migration, /session_three_evidence|session_two_evidence|leveling_records|attendance/);
});
