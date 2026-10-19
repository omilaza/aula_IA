import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 6 adds one independent evidence table without altering prior storage", async () => {
  const [schema, migration] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0005_clumsy_red_skull.sql"),
  ]);

  assert.match(schema, /export const sessionSixEvidence = sqliteTable\(/);
  assert.match(schema, /"session_six_evidence"/);
  assert.match(
    schema,
    /uniqueIndex\("session_six_evidence_control_unique"\)\.on\(\s*table\.email,\s*table\.session,\s*table\.activity,/s,
  );
  assert.match(migration, /^CREATE TABLE `session_six_evidence`/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX `session_six_evidence_control_unique` ON `session_six_evidence` \(`email`,`session`,`activity`\)/,
  );
  assert.doesNotMatch(
    migration,
    /session_six_evidence_control_unique[^\n]*`route`/,
  );
  assert.doesNotMatch(migration, /\b(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/i);
  for (const priorTable of [
    "session_two_evidence",
    "session_three_evidence",
    "session_four_evidence",
    "session_five_evidence",
  ]) {
    assert.doesNotMatch(migration, new RegExp("(?:CREATE|ALTER|DROP) TABLE `" + priorTable + "`"));
  }
});

test("Session 6 exposes the agreed attendance and evidence contract", async () => {
  const route = await read("../app/api/session-six/route.ts");
  assert.match(route, /actions: \["attendance", "evidence"\]/);
  assert.match(route, /const routes = new Set\(\["basica", "intermedia", "avanzada"\]\)/);
  for (const key of [
    "context_alignment",
    "source_traceability",
    "sequence_coherence",
    "evidence_alignment",
    "instrument_alignment",
    "data_limits",
    "teacher_decision",
    "inclusion_follow_up",
  ]) {
    assert.match(route, new RegExp(`key: "${key}"`));
  }
});

test("Session 6 treats written content as complete without arbitrary minimum lengths", async () => {
  const route = await read("../app/api/session-six/route.ts");
  assert.match(route, /function missingWrittenFields\([\s\S]*?!value\.trim\(\)/);
  assert.doesNotMatch(route, /missingWrittenFields\([\s\S]*?minimum/);
  assert.doesNotMatch(route, /value\.length\s*[<>=]/);
  assert.match(route, /Faltan campos obligatorios sin texto/);
});

test("Session 6 keeps one final product when the support route changes", async () => {
  const route = await read("../app/api/session-six/route.ts");
  assert.match(
    route,
    /eq\(attendance\.email, email\), eq\(attendance\.session, SESSION\)/,
  );
  assert.match(route, /Primero registra tu asistencia a la Sesión 6 con este mismo correo/);
  assert.match(
    route,
    /target: \[\s*sessionSixEvidence\.email,\s*sessionSixEvidence\.session,\s*sessionSixEvidence\.activity,\s*\]/s,
  );
  assert.doesNotMatch(
    route,
    /target: \[[\s\S]*?sessionSixEvidence\.route[\s\S]*?\]/,
  );
  assert.match(route, /set: \{\s*fullName: registeredAttendance\.fullName,\s*route,/s);
  assert.match(route, /attempt: sql`\$\{sessionSixEvidence\.attempt\} \+ 1`/);
  assert.match(route, /responseVersion: sql`\$\{sessionSixEvidence\.responseVersion\} \+ 1`/);
  assert.match(route, /updatedPreviousResponse: Boolean\(existing\)/);
});

test("Session 6 persists every agreed product field and returns recoverable identifiers", async () => {
  const [schema, route] = await Promise.all([
    read("../db/schema.ts"),
    read("../app/api/session-six/route.ts"),
  ]);
  const fields = [
    "projectTitle",
    "teachingNeed",
    "educationalLevel",
    "subject",
    "pedagogicalContext",
    "learningPurpose",
    "sourceTraceability",
    "prompt",
    "activitySequence",
    "assessmentEvidence",
    "instrumentCriteria",
    "analysisLimits",
    "teacherDecision",
    "followUpEvidence",
    "adaptation",
    "aiContribution",
    "teacherReview",
    "implementationStep",
    "checklistJson",
  ];
  for (const field of fields) {
    assert.match(schema, new RegExp(`\\b${field}:`));
    assert.match(route, new RegExp(`\\b${field},`));
  }
  assert.match(route, /const code = confirmationCode\("EV6"\)/);
  assert.match(route, /createPdfAccessCode\("S6", email, code\)/);
  assert.match(route, /confirmationCode: code,[\s\S]*?folio: code,[\s\S]*?pdfAccessCode,/);
});

test("Session 6 backend does not write to Sheets or Apps Script", async () => {
  const route = await read("../app/api/session-six/route.ts");
  assert.doesNotMatch(route, /syncToInstitutionalSheet|SHEETS_WEBAPP|google-apps-script/i);
  assert.doesNotMatch(route, /fetch\(/);
});
