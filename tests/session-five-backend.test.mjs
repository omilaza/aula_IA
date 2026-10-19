import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 5 backend exposes separate preparation, attendance and evidence actions", async () => {
  const route = await read("../app/api/session-five/route.ts");

  for (const action of [
    "leveling_attendance",
    "leveling_activity",
    "s5_main_attendance",
    "s5_evidence",
  ]) {
    assert.match(route, new RegExp(`"${action}"`));
  }
  for (const prefix of ["NP5", "ACT5", "AS5", "EV5"]) {
    assert.match(route, new RegExp(`confirmationCode\\("${prefix}"\\)`));
  }
  assert.match(route, /const SESSION = "S5"/);
  assert.match(route, /const LEVELING_FINAL_ACTIVITY = "nivelacion-instrumentos"/);
  assert.match(route, /activity !== LEVELING_FINAL_ACTIVITY/);
  assert.match(route, /createPdfAccessCode\("S5P", email, code\)/);
  assert.match(route, /createPdfAccessCode\("S5", email, code\)/);
});

test("Session 5 validates the four approved levels, five instruments and three difficulties", async () => {
  const route = await read("../app/api/session-five/route.ts");

  for (const level of [
    "Educación básica",
    "Secundaria",
    "Educación media superior",
    "Educación superior",
  ]) {
    assert.match(route, new RegExp(`"${level}"`));
  }
  for (const instrument of [
    "rubrica_analitica",
    "lista_cotejo",
    "escala_valoracion",
    "guia_observacion",
    "portafolio_evidencias",
  ]) {
    assert.match(route, new RegExp(`"${instrument}"`));
  }
  assert.match(route, /const difficultyLevels = new Set\(\["basico", "intermedio", "avanzado"\]\)/);
  assert.match(route, /educationalLevels\.has\(educationalLevel\)/);
  assert.match(route, /instrumentTypes\.has\(instrumentType\)/);
  assert.match(route, /difficultyLevels\.has\(difficultyLevel\)/);
  assert.match(route, /selectedSequence\.level !== educationalLevel/);
  assert.match(route, /selectedSequence\.subject !== subject/);
  assert.match(route, /sequenceKey !== "propia"/);
});

test("Session 5 difficulty checklists are cumulative and enforced exactly at 3, 6 and 10", async () => {
  const [route, data] = await Promise.all([
    read("../app/api/session-five/route.ts"),
    read("../app/session-five-data.ts"),
  ]);
  const directEntries = (name) => {
    const block = data.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\] as const;`))?.[1] || "";
    return [...block.matchAll(/^\s*"/gm)].length;
  };

  assert.equal(directEntries("basicChecklist"), 3);
  assert.equal(directEntries("intermediateChecklist"), 3);
  assert.equal(directEntries("advancedChecklist"), 4);
  assert.match(data, /\.\.\.basicChecklist/);
  assert.match(data, /\.\.\.intermediateChecklist/);
  assert.match(route, /difficultyEvidenceChecklist/);
  assert.match(route, /entries\.length === 0/);
  assert.doesNotMatch(route, /entries\.length < 6/);
  assert.match(route, /checklistResult\.total !== selectedDifficultyChecklist\.length/);
  assert.match(route, /selectedDifficultyChecklist\.filter/);
  assert.match(route, /checklistResult\?\.checklist\[item\] !== true/);
});

test("Session 5 sends the visible route, instrument and sequence as authoritative controls", async () => {
  const main = await read("../app/session-five.tsx");
  const handler = main.slice(main.indexOf("function authoritativeDraft"), main.indexOf("async function copyText"));

  assert.match(handler, /email: evidenceEmail/);
  assert.match(handler, /sequenceKey: useOwnSequence \? "propia" : currentSequence\.key/);
  assert.match(handler, /educationalLevel: useOwnSequence \? evidence\.educationalLevel : currentSequence\.level/);
  assert.match(handler, /subject: useOwnSequence \? evidence\.subject : currentSequence\.subject/);
  assert.match(handler, /difficultyLevel: selectedDifficulty/);
  assert.match(handler, /instrumentType: selectedInstrument/);
  assert.match(handler, /checklist: Object\.fromEntries\(currentChecklist/);
  assert.match(handler, /registeredAttendanceEmail && email !== registeredAttendanceEmail/);
});

test("Session 5 reports every incomplete evidence field instead of a generic missing-evidence error", async () => {
  const route = await read("../app/api/session-five/route.ts");
  for (const label of [
    "borrador de IA o contingencia",
    "instrumento final revisado",
    "criterios, niveles o valores observables",
    "resumen de datos y denominadores",
    "hallazgos y pregunta pendiente",
    "comparación de G1, G2 y G3",
    "datos faltantes y límites",
    "decisión docente y evidencia de seguimiento",
    "adaptación o apoyo",
  ]) {
    assert.match(route, new RegExp(label, "i"));
  }
  assert.match(route, /missingCriticalFields/);
  assert.match(route, /fields: missingCriticalFields/);
  assert.match(route, /Faltan campos obligatorios sin texto/);
});

test("Session 5 treats complementary empty context as non-blocking information", async () => {
  const [main, route] = await Promise.all([
    read("../app/session-five.tsx"),
    read("../app/api/session-five/route.ts"),
  ]);
  assert.match(main, /Información complementaria/);
  assert.match(main, /"warning"/);
  assert.match(main, /Estos campos no bloquean el guardado/);
  const attemptEvidence = main.slice(main.indexOf("async function attemptEvidence"), main.indexOf("async function copyText"));
  assert.doesNotMatch(attemptEvidence, /warnings\.length &&/);
  const criticalBlock = route.slice(route.indexOf("const criticalFields"), route.indexOf("const missingCriticalFields"));
  assert.doesNotMatch(criticalBlock, /Fuente o caso de referencia/);
  assert.match(criticalBlock, /sequenceKey === "propia"/);
});

test("Session 5 preserves progress separately from accredited evidence and exposes actionable errors", async () => {
  const main = await read("../app/session-five.tsx");
  assert.match(main, /const PROGRESS_KEY/);
  assert.match(main, /status: "avance-local"/);
  assert.match(main, /No genera folio ni acredita/);
  assert.match(main, /Guardar avance sin acreditar/);
  assert.match(main, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(main, /validationIssues\.map/);
  assert.match(main, /aria-invalid/);
  assert.match(main, /noValidate/);
});

test("Session 5 selection changes preserve work without configuration alarms", async () => {
  const client = await read("../app/session-five.tsx");
  assert.match(client, /const LEGACY_IMPACT_KEY = "aula-ia-s5-configuration-impacts"/);
  assert.match(client, /localStorage\.removeItem\(LEGACY_IMPACT_KEY\)/);
  assert.doesNotMatch(client, /configurationReviewIssues/);
  assert.doesNotMatch(client, /setConfigurationImpacts/);
  assert.match(client, /window\.confirm/);
  const chooseInstrument = client.match(/function chooseInstrument[\s\S]*?\n  }\n\n  function chooseDifficulty/)?.[0] || "";
  assert.doesNotMatch(chooseInstrument, /instrumentDesign: ""/);
  assert.doesNotMatch(chooseInstrument, /aiDraft: ""/);
  assert.doesNotMatch(chooseInstrument, /setChecks/);
  assert.doesNotMatch(chooseInstrument, /window\.confirm/);
  assert.match(chooseInstrument, /Tus textos y casillas se conservaron/);
  const chooseSequence = client.match(/function chooseSequence[\s\S]*?\n  }\n\n  function chooseInstrument/)?.[0] || "";
  assert.doesNotMatch(chooseSequence, /setChecks/);
  assert.doesNotMatch(chooseSequence, /campos dependientes/);
  const chooseDifficulty = client.match(/function chooseDifficulty[\s\S]*?\n  }\n\n  function startOwnSequence/)?.[0] || "";
  assert.doesNotMatch(chooseDifficulty, /setChecks\(\{\}\)/);
  assert.match(chooseDifficulty, /current\.filter\(\(issue\) => issue\.key !== "checklist"\)/);
});

test("Session 5 accepts every written text regardless of length and reports only empty fields", async () => {
  const validation = await import(new URL("../app/session-five-validation.ts", import.meta.url));
  const client = await read("../app/session-five.tsx");
  const route = await read("../app/api/session-five/route.ts");
  const criticalBlock = route.slice(route.indexOf("const criticalFields"), route.indexOf("const missingCriticalFields"));

  assert.equal(validation.hasWrittenContent("x"), true);
  assert.equal(validation.hasWrittenContent("   "), false);
  assert.deepEqual(validation.missingWrittenFields([["Con texto", "x"], ["Vacío", ""], ["Espacios", "   "]]), ["Vacío", "Espacios"]);
  assert.match(client, /if \(hasWrittenContent\(value\)\) return/);
  assert.match(client, /este campo está vacío/);
  assert.doesNotMatch(client, /escribe al menos/);
  assert.match(route, /missingWrittenFields\(criticalFields\)/);
  assert.doesNotMatch(criticalBlock, /,\s*\d+\]/);
  assert.doesNotMatch(route, /value\.length < minimum/);
});

test("Session 5 removes every obsolete configuration warning without touching draft or checks", async () => {
  const client = await read("../app/session-five.tsx");

  assert.match(client, /localStorage\.removeItem\(LEGACY_IMPACT_KEY\)/);
  assert.match(client, /localStorage\.getItem\(DRAFT_KEY\)/);
  assert.match(client, /localStorage\.getItem\(CHECKS_KEY\)/);
  assert.doesNotMatch(client, /savedImpacts/);
  assert.doesNotMatch(client, /compatibleImpacts/);
});

test("Session 5 evidence requires principal attendance and persists every agreed field", async () => {
  const route = await read("../app/api/session-five/route.ts");

  assert.match(route, /db\.find\(attendance, \{ email, session: SESSION \}/);
  assert.match(route, /if \(!mainAttendance\)/);
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
    assert.match(route, new RegExp(`\\b${field}\\b`));
  }
  assert.match(route, /db\.upsert\(\s*sessionFiveEvidence,/);
  assert.match(route, /db\.upsert\(/);
  assert.match(route, /attempt: increment\(1\)/);
  assert.match(route, /responseVersion: increment\(1\)/);
  assert.match(route, /const prompt = clean\(payload\.prompt, 18_000\)/);
  assert.match(route, /\["Prompt del instrumento", prompt\]/);
  assert.match(route, /criteriaDescriptors,\s+prompt,\s+aiDraft,/);
  const evidenceStart = route.indexOf('action === "s5_evidence"');
  const writeStart = route.indexOf("await db.upsert(", evidenceStart);
  const writeEnd = route.indexOf("const pdfAccessCode", writeStart);
  assert.ok(evidenceStart >= 0 && writeStart > evidenceStart && writeEnd > writeStart);
  assert.match(route.slice(writeStart, writeEnd), /\bprompt,/);
});

test("Session 5 confirms each record only after the primary Sheets write", async () => {
  const route = await read("../app/api/session-five/route.ts");
  const branches = [
    ["leveling_attendance", "leveling_activity"],
    ["leveling_activity", "s5_main_attendance"],
    ["s5_main_attendance", "s5_evidence"],
    ["s5_evidence", "return Response.json"],
  ];
  for (const [startMarker, endMarker] of branches) {
    const start = route.indexOf(`action === "${startMarker}"`);
    const end = endMarker === "return Response.json"
      ? route.lastIndexOf(endMarker)
      : route.indexOf(`action === "${endMarker}"`, start + 1);
    const branch = route.slice(start, end);
    assert.ok(start >= 0 && end > start, `Missing branch ${startMarker}`);
    const write = branch.indexOf("await db.upsert(");
    const confirmation = branch.indexOf('sheetSync: "synced"');
    assert.ok(write >= 0, `${startMarker} must write to Sheets`);
    assert.ok(confirmation > write, `${startMarker} must await persistence before confirmation`);
  }
  assert.doesNotMatch(route, /syncToInstitutionalSheet|drizzle-orm/);
});

test("Session 5 migration is additive and does not rewrite earlier tables", async () => {
  const [schema, migration, snapshot, journal] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0004_hard_amphibian.sql"),
    read("../drizzle/meta/0004_snapshot.json"),
    read("../drizzle/meta/_journal.json"),
  ]);

  assert.match(schema, /export const sessionFiveEvidence/);
  assert.match(schema, /prompt: text\("prompt"\)\.notNull\(\)/);
  assert.match(schema, /session_five_evidence_control_unique/);
  assert.match(migration, /CREATE TABLE `session_five_evidence`/);
  assert.match(migration, /`prompt` text NOT NULL/);
  const s5Snapshot = snapshot.slice(
    snapshot.indexOf('"session_five_evidence"'),
    snapshot.indexOf('"session_four_evidence"'),
  );
  assert.match(s5Snapshot, /"prompt": \{\s+"name": "prompt"/);
  assert.match(migration, /CREATE UNIQUE INDEX `session_five_evidence_control_unique`/);
  assert.doesNotMatch(migration, /\b(?:DROP|ALTER|DELETE|UPDATE)\b/i);
  assert.doesNotMatch(
    migration,
    /session_four_evidence|session_three_evidence|session_two_evidence|leveling_records|attendance/,
  );
  assert.match(journal, /"tag": "0004_hard_amphibian"/);
});
