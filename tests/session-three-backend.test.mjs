import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 3 backend separates preparation, attendance and accreditable evidence", async () => {
  const [route, schema] = await Promise.all([
    read("../app/api/session-three/route.ts"),
    read("../db/schema.ts"),
  ]);

  for (const action of [
    "leveling_attendance",
    "leveling_activity",
    "s3_main_attendance",
    "s3_evidence",
  ]) {
    assert.match(route, new RegExp(`"${action}"`));
  }

  for (const prefix of ["NP3", "ACT3", "AS3", "EV3"]) {
    assert.match(route, new RegExp(`confirmationCode\\("${prefix}"\\)`));
  }

  assert.match(route, /const SESSION = "S3"/);
  assert.match(route, /sessionThreeEvidence/);
  assert.match(schema, /export const sessionThreeEvidence/);
  assert.match(schema, /session_three_evidence_control_unique/);
  assert.match(
    schema,
    /table\.email,\s*table\.session,\s*table\.route,\s*table\.activity/s,
  );
});

test("Session 3 evidence requires S3 attendance and validates level, difficulty and checklist", async () => {
  const route = await read("../app/api/session-three/route.ts");

  assert.match(
    route,
    /db\.find\(attendance, \{ email, session: SESSION \}/,
  );
  assert.match(route, /if \(!mainAttendance\)/);
  assert.match(route, /educationLevels\.has\(educationalLevel\)/);
  assert.match(route, /difficultyLevels\.has\(difficultyLevel\)/);
  assert.match(route, /checklistResult\.total !== selectedDifficultyChecklist\.length/);
  assert.match(route, /activity === LEVELING_ATTENDANCE_ACTIVITY/);
  assert.ok(
    [...route.matchAll(/db\.upsert\(/g)].length >= 4,
    "Each S3 record type must update its controlled prior response",
  );
});

test("Every educational level requires every criterion of the selected cumulative difficulty", async () => {
  const route = await read("../app/api/session-three/route.ts");

  assert.match(route, /difficultyEvidenceChecklist/);
  assert.match(route, /\.slice\(0, 30\)/);
  assert.match(route, /entries\.length < 6/);
  assert.match(route, /checklistResult\.total !== selectedDifficultyChecklist\.length/);
  assert.match(
    route,
    /selectedDifficultyChecklist\.filter\(\(item\) => checklistResult\?\.checklist\[item\] !== true\)/,
  );
  assert.match(route, /de \$\{educationalLevel\}/);
  assert.doesNotMatch(route, /mediaSuperior|educationalLevel === "Media superior"/);
  assert.doesNotMatch(route, /checklistResult\.total < 8/);
  assert.match(route, /fields: missingCriticalFields/);
  assert.match(route, /fields: missingChecklistItems/);
});

test("Session 3 migration is additive and leaves prior tables untouched", async () => {
  const migration = await read("../drizzle/0002_lethal_salo.sql");

  assert.match(migration, /CREATE TABLE `session_three_evidence`/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX `session_three_evidence_control_unique`/,
  );
  assert.doesNotMatch(migration, /\b(?:DROP|ALTER|DELETE|UPDATE)\b/i);
  assert.doesNotMatch(migration, /session_two_evidence|leveling_records|attendance/);
});

test("The private Sheets endpoint serializes writes and allows all course record tables", async () => {
  const [script, schemaText] = await Promise.all([
    read("../google-apps-script/Code.gs"),
    read("../google-apps-script/schema.json"),
  ]);
  const schema = JSON.parse(schemaText);
  assert.match(script, /LockService\.getScriptLock\(\)/);
  assert.match(script, /lock\.tryLock\(20000\)/);
  assert.match(script, /finally\s*\{\s*lock\.releaseLock\(\);/s);
  for (const table of [
    "attendance", "diagnostics", "lab_evidence", "exit_tickets",
    "digital_skill_diagnostics", "leveling_records", "session_two_evidence", "session_three_evidence",
  ]) {
    assert.ok(schema[table], `Missing permitted table ${table}`);
  }
  assert.deepEqual(schema.session_three_evidence.unique, ["email", "session", "route", "activity"]);
  assert.ok(schema.session_three_evidence.columns.includes("educationalLevel"));
  assert.ok(schema.session_three_evidence.columns.includes("fullName"));
});

test("The Sheets repository retries requests with one identifier and rejects unconfirmed writes", async () => {
  const client = await read("../db/sheets-client.ts");
  assert.match(client, /attempt < 3/);
  assert.ok(client.indexOf("const requestId =") < client.indexOf("attempt < 3"));
  assert.match(client, /data\.ok !== true/);
  assert.match(client, /data\.requestId !== requestId/);
  assert.match(client, /No se pudo confirmar el guardado/);
  assert.doesNotMatch(client, /sincronizar[áa].*autom[aá]tic/i);
});
