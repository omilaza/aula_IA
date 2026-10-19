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
    /eq\(attendance\.email, email\), eq\(attendance\.session, SESSION\)/,
  );
  assert.match(route, /if \(!mainAttendance\)/);
  assert.match(route, /educationLevels\.has\(educationalLevel\)/);
  assert.match(route, /difficultyLevels\.has\(difficultyLevel\)/);
  assert.match(route, /checklistResult\.total !== selectedDifficultyChecklist\.length/);
  assert.match(route, /activity === LEVELING_ATTENDANCE_ACTIVITY/);
  assert.ok(
    [...route.matchAll(/\.onConflictDoUpdate\(/g)].length >= 4,
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

test("Apps Script serializes sheet writes and preserves S1, S2 and S3 actions", async () => {
  const script = await read("../google-apps-script/Code.gs");

  assert.match(script, /LockService\.getScriptLock\(\)/);
  assert.match(script, /lock\.tryLock\(30000\)/);
  assert.match(script, /finally\s*\{\s*lock\.releaseLock\(\);/s);
  assert.match(script, /case 's3_main_attendance':/);
  assert.match(script, /case 's3_evidence':/);
  assert.match(script, /function saveSessionThreeEvidence_/);
  assert.match(script, /requiredSheet_\(spreadsheet, 'S3_EVIDENCIAS'\)/);
  assert.match(
    script,
    /const existing = row \? sheet\.getRange\(row, 1, 1, 8\)\.getValues\(\)\[0\] : \[\]/,
  );
  assert.match(script, /existing\[1\] \|\| new Date\(\)/);
  assert.match(
    script,
    /clean_\(payload\.fullName\) \|\| clean_\(existing\[3\]\)/,
  );
  assert.match(
    script,
    /clean_\(payload\.educationalLevel\) \|\| clean_\(existing\[5\]\)/,
  );
  assert.match(
    script,
    /const evidenceType = normalizeLevelingEvidenceType_\(payload\.evidenceType\)/,
  );
  assert.match(script, /function normalizeLevelingEvidenceType_/);
  assert.match(script, /'practica-guiada': 'practica-guiada'/);
  assert.ok(
    [...script.matchAll(/const sameSubmission = row/g)].length >= 3,
    "Retries must not increase attempt/version for the same confirmation code",
  );

  for (const previousAction of [
    "attendance",
    "diagnostic",
    "lab",
    "exit",
    "digital_diagnostic",
    "s2_main_attendance",
    "s2_evidence",
  ]) {
    assert.match(script, new RegExp(`case '${previousAction}':`));
  }
});

test("Sheet synchronization retries immediately but reports a final failure honestly", async () => {
  const sync = await read("../app/sheets-sync.ts");

  assert.match(sync, /const retryDelays = \[0, 400, 1_200\]/);
  assert.match(sync, /for \(let index = 0; index < retryDelays\.length; index \+= 1\)/);
  assert.match(sync, /status: "synced", attempts: index \+ 1/);
  assert.match(sync, /status: "failed"/);
  assert.match(sync, /attempts: retryDelays\.length/);
  assert.doesNotMatch(sync, /sincronizar[áa].*autom[aá]tic/i);
});
