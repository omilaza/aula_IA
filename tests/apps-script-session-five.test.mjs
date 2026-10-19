import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const schemaSource = await read("../google-apps-script/Schema.gs");
const script = await read("../google-apps-script/Code.gs");
const context = vm.createContext({});
vm.runInContext(schemaSource, context);
const schema = JSON.parse(JSON.stringify(context.AULA_SCHEMA));
const s5 = schema.session_five_evidence;

// The former action-specific institutional mirror is replaced by primary
// storage. These checks protect the S5 record contract, not legacy handler bytes.
const evidenceFields = [
  "sequenceKey", "sequenceTitle", "educationalLevel", "subject", "difficultyLevel",
  "instrumentType", "learningPurpose", "pedagogicalContext", "sourceCase",
  "instrumentDesign", "criteriaDescriptors", "prompt", "aiDraft", "datasetSummary",
  "findings", "groupComparison", "teacherDecision", "limitations", "adaptation", "checklistJson",
];

test("The generated primary S5 schema preserves every agreed evidence field", () => {
  assert.ok(s5, "S5 storage must be declared");
  for (const field of evidenceFields) {
    assert.ok(s5.columns.includes(field), `Missing S5 field ${field}`);
    assert.equal(s5.types[field], "string", `Wrong type for S5 field ${field}`);
    assert.ok(s5.required.includes(field), `S5 field ${field} must remain required`);
  }
  for (const field of ["participantId", "fullName", "email", "confirmationCode", "createdAt", "updatedAt"]) {
    assert.ok(s5.columns.includes(field), `Missing record control ${field}`);
  }
  assert.equal(new Set(s5.columns).size, s5.columns.length);
});

test("S5 primary storage is separate from legacy tabs and earlier evidence sessions", () => {
  assert.equal(s5.tab, "APP_EVIDENCIAS_S5");
  const earlierTables = [
    "attendance", "diagnostics", "lab_evidence", "exit_tickets", "digital_skill_diagnostics",
    "leveling_records", "session_two_evidence", "session_three_evidence", "session_four_evidence",
  ];
  for (const table of earlierTables) {
    assert.ok(schema[table], `Earlier course storage is still needed: ${table}`);
    assert.notEqual(schema[table].tab, s5.tab, `${table} must not share the S5 evidence tab`);
  }
  for (const definition of Object.values(schema)) assert.match(definition.tab, /^APP_/);
  assert.equal(schema.session_two_evidence.defaults.session, "S2");
  assert.equal(schema.session_three_evidence.defaults.session, "S3");
  assert.equal(schema.session_four_evidence.defaults.session, "S4");
  assert.equal(s5.defaults.session, "S5");
});

test("S5 keeps participant, session, route and activity identity and version counters", () => {
  assert.deepEqual(s5.unique, ["email", "session", "route", "activity"]);
  assert.equal(s5.defaults.route, "principal");
  assert.equal(s5.defaults.activity, "evidencia-principal");
  assert.equal(s5.defaults.attempt, 1);
  assert.equal(s5.defaults.responseVersion, 1);
  assert.equal(s5.types.attempt, "number");
  assert.equal(s5.types.responseVersion, "number");
  assert.deepEqual(s5.defaults.createdAt, { op: "timestamp" });
  assert.deepEqual(s5.defaults.updatedAt, { op: "timestamp" });
});

test("S5 uses configured authorization before any spreadsheet is opened", () => {
  const post = script.slice(script.indexOf("function doPost("), script.indexOf("function setupStorage("));
  const authorization = post.indexOf("storageSecretEqual_(request.secret, settings.secret)");
  const open = post.indexOf("SpreadsheetApp.openById");
  assert.ok(authorization >= 0 && open > authorization);
  assert.match(script, /PropertiesService\.getScriptProperties\(\)/);
  assert.match(script, /getProperty\('AULA_STORAGE_SECRET'\)/);
  assert.doesNotMatch(script, /(?:const|var) WEBHOOK_SECRET\s*=/);
  assert.match(post, /request\.action !== 'storage'/);
});

test("S5 primary rows use the shared lock and literal-value writes beyond column Z", () => {
  assert.ok(s5.columns.length + 1 > 26, "S5 plus request history needs a wide sheet");
  assert.match(script, /LockService\.getScriptLock\(\)/);
  assert.match(script, /finally\s*\{\s*lock\.releaseLock\(\);/s);
  assert.match(script, /storageEnsureGrid_\(sheet, targetRow, cells\.length\)/);
  assert.match(script, /valueInputOption: 'RAW'/);
  assert.match(script, /definition\.columns\.concat\(\['_requestId'\]\)/);
});
