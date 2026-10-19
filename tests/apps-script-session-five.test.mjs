import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const legacyHeaders = [
  "ID_REGISTRO",
  "FECHA_HORA",
  "CORREO",
  "NOMBRE_COMPLETO",
  "PRODUCTO",
  "PROPOSITO",
  "CONTEXTO",
  "FUENTES_UTILIZADAS",
  "PROMPT_PRINCIPAL",
  "RESULTADO",
  "REVISION_DOCENTE",
  "RIESGO_DETECTADO",
  "AJUSTE_REALIZADO",
  "ESTATUS",
  "CODIGO_EVIDENCIA",
  "ORIGEN",
];

const additionalHeaders = [
  "SESION",
  "RUTA",
  "ACTIVIDAD",
  "ID_PARTICIPANTE",
  "CLAVE_SECUENCIA",
  "TITULO_SECUENCIA",
  "NIVEL_EDUCATIVO",
  "ASIGNATURA",
  "DIFICULTAD",
  "TIPO_INSTRUMENTO",
  "PROPOSITO_APRENDIZAJE",
  "CONTEXTO_PEDAGOGICO",
  "FUENTE_O_CASO",
  "DISENO_INSTRUMENTO",
  "CRITERIOS_Y_DESCRIPTORES",
  "BORRADOR_IA",
  "RESUMEN_DATOS",
  "HALLAZGOS",
  "COMPARACION_GRUPAL",
  "DECISION_DOCENTE",
  "LIMITACIONES",
  "ADAPTACION",
  "CHECKLIST_JSON",
  "CRITERIOS_LOGRADOS",
  "CRITERIOS_TOTALES",
  "INTENTO",
  "VERSION",
];

function quotedValues(script, constantName) {
  const block = script.match(new RegExp(`const ${constantName} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(block, `${constantName} must exist`);
  return [...block[1].matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

test("S5 addition preserves every pre-S5 sheet handler byte for byte", async () => {
  const script = await read("../google-apps-script/Code.gs");
  const start = script.indexOf("function saveParticipant_");
  const end = script.indexOf("/**\n * S5_EVIDENCIAS", start);
  assert.ok(start >= 0 && end > start);

  const protectedHash = createHash("sha256").update(script.slice(start, end)).digest("hex");
  assert.equal(
    protectedHash,
    "1741bcea985b86e6acf9d1e2358feec27765d18333d6ff8e10d3952dda9905a4",
    "S1-S4 handlers must remain unchanged while S5 is appended",
  );
});

test("Apps Script keeps prior actions and adds only S5 attendance and evidence actions", async () => {
  const script = await read("../google-apps-script/Code.gs");
  assert.match(script, /version:\s*'S5-2026-08-11'/);

  for (const action of [
    "attendance",
    "diagnostic",
    "lab",
    "exit",
    "digital_diagnostic",
    "leveling_attendance",
    "leveling_activity",
    "s2_main_attendance",
    "s2_evidence",
    "s3_main_attendance",
    "s3_evidence",
    "s4_main_attendance",
    "s4_evidence",
    "s5_main_attendance",
    "s5_evidence",
  ]) {
    assert.match(script, new RegExp(`case '${action}':`));
  }

  assert.match(
    script,
    /case 's5_main_attendance':[\s\S]*?clean_\(payload\.session\) !== 'S5' \|\| !normalizeEmail_\(payload\.email\)[\s\S]*?saveParticipant_\(spreadsheet, payload\);\s*saveAttendance_\(spreadsheet, payload\);/,
  );
  assert.match(script, /case 's5_evidence':\s*saveSessionFiveEvidence_\(spreadsheet, payload\);/);
  assert.doesNotMatch(script, /case 's5_leveling_/);
});

test("S5 writes remain inside the existing 30-second script lock", async () => {
  const script = await read("../google-apps-script/Code.gs");
  const lock = script.indexOf("const lock = LockService.getScriptLock()");
  const switchStart = script.indexOf("switch (action)", lock);
  const s5Evidence = script.indexOf("case 's5_evidence':", switchStart);
  const release = script.indexOf("lock.releaseLock()", s5Evidence);
  assert.ok(lock >= 0 && switchStart > lock && s5Evidence > switchStart && release > s5Evidence);
  assert.match(script, /lock\.tryLock\(30000\)/);
  assert.match(script, /finally\s*\{\s*lock\.releaseLock\(\);/s);
});

test("S5 preserves the institutional 16-column prefix and appends its contract at Q", async () => {
  const script = await read("../google-apps-script/Code.gs");
  assert.deepEqual(quotedValues(script, "SESSION_FIVE_LEGACY_HEADERS_"), legacyHeaders);
  assert.deepEqual(quotedValues(script, "SESSION_FIVE_ADDITIONAL_HEADERS_"), additionalHeaders);
  assert.equal(legacyHeaders.length, 16);
  assert.equal(additionalHeaders.length, 27);

  assert.match(
    script,
    /const SESSION_FIVE_EVIDENCE_HEADERS_ = SESSION_FIVE_LEGACY_HEADERS_\s*\.concat\(SESSION_FIVE_ADDITIONAL_HEADERS_\);/,
  );
  assert.match(script, /const firstAdditionalColumn = SESSION_FIVE_LEGACY_HEADERS_\.length \+ 1;/);
  assert.match(script, /getSheetByName\('S5_EVIDENCIAS'\)/);
  assert.match(script, /insertSheet\('S5_EVIDENCIAS'\)/);
  assert.match(script, /rangeHasContentOrFormula_\(availableRange\)/);
  assert.match(
    script,
    /function clearSessionFiveInheritedValidations_\(sheet\)[\s\S]*?getRange\([\s\S]*?SESSION_FIVE_LEGACY_HEADERS_\.length \+ 1,[\s\S]*?sheet\.getMaxRows\(\),[\s\S]*?SESSION_FIVE_ADDITIONAL_HEADERS_\.length[\s\S]*?\.clearDataValidations\(\);/,
  );
  assert.doesNotMatch(script, /requiredSheet_\(spreadsheet, 'S5_EVIDENCIAS'\)/);
});

test("S5 evidence validates controls and uses confirmation-code idempotency", async () => {
  const script = await read("../google-apps-script/Code.gs");
  const start = script.indexOf("function saveSessionFiveEvidence_");
  const end = script.indexOf("function requiredSheet_", start);
  const handler = script.slice(start, end);

  assert.match(
    handler,
    /session !== 'S5'[\s\S]*?route !== 'principal'[\s\S]*?activity !== 'evidencia-principal'[\s\S]*?!email[\s\S]*?!confirmationCode/,
  );
  assert.match(handler, /normalizeEmail_\(values\[2\]\) === email/);
  assert.match(handler, /clean_\(values\[16\]\) === session/);
  assert.match(handler, /clean_\(values\[17\]\) === route/);
  assert.match(handler, /clean_\(values\[18\]\) === activity/);
  assert.match(handler, /clean_\(existing\[14\]\) === confirmationCode/);
  assert.match(handler, /Number\(existing\[41\]\)/);
  assert.match(handler, /Number\(existing\[42\]\)/);
  assert.match(handler, /makeId_\('S5E'\)/);
  assert.match(handler, /rangeHasContentOrFormula_\(targetRange\)/);

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
    "aiDraft",
    "datasetSummary",
    "findings",
    "groupComparison",
    "teacherDecision",
    "limitations",
    "adaptation",
    "checklistJson",
  ]) {
    assert.match(handler, new RegExp(`payload\\.${field}`));
  }
});
