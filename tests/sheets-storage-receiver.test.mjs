import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const generatedSchemaSource = await readFile(new URL("../google-apps-script/Schema.gs", import.meta.url), "utf8");
const generatedSchemaContext = vm.createContext({});
vm.runInContext(generatedSchemaSource, generatedSchemaContext);
const generatedSchema = JSON.parse(JSON.stringify(generatedSchemaContext.AULA_SCHEMA));
const secret = "storage-secret-for-tests-with-at-least-32-characters";
const schema = {
  attendance: {
    tab: "APP_ASISTENCIA",
    columns: ["id", "email", "session", "fullName", "confirmationCode", "attempt", "createdAt", "updatedAt"],
    types: { id: "number", email: "string", session: "string", fullName: "string", confirmationCode: "string", attempt: "number", createdAt: "string", updatedAt: "string" },
    defaults: { session: "S1", attempt: 1, createdAt: { op: "timestamp" }, updatedAt: { op: "timestamp" } },
    required: ["id", "email", "session", "fullName", "confirmationCode", "attempt", "createdAt", "updatedAt"],
    unique: ["session", "email"],
  },
  session_six_evidence: {
    tab: "APP_EVIDENCIA_S6",
    columns: ["id", "email", "session", "activity", "route", "prompt", "attempt", "confirmationCode"],
    types: { id: "number", email: "string", session: "string", activity: "string", route: "string", prompt: "string", attempt: "number", confirmationCode: "string" },
    defaults: { session: "S6", activity: "evidencia-principal", attempt: 1 },
    required: ["email", "session", "activity", "route", "prompt", "confirmationCode"],
    unique: [["email", "session", "activity"]],
  },
  course_satisfaction_survey_responses: {
    tab: "APP_ENCUESTA",
    columns: ["id", "idempotencyKey", "referenceCode", "generalRating"],
    types: { id: "number", idempotencyKey: "string", referenceCode: "string", generalRating: "number" },
    defaults: {},
    required: ["idempotencyKey", "referenceCode", "generalRating"],
    unique: ["idempotencyKey"],
  },
};

function harness({ properties, definitions = schema } = {}) {
  const tabs = new Map();
  const calls = { open: 0, writes: [], locks: 0, releases: 0, held: false, failWrite: "", busy: false };
  function sheet(name, rows = []) {
    const value = {
      rows,
      maxRows: 1000,
      maxColumns: 26,
      getMaxRows() { return this.maxRows; },
      getMaxColumns() { return this.maxColumns; },
      insertRowsAfter(after, count) { assert.equal(calls.held, true); assert.equal(after, this.maxRows); this.maxRows += count; },
      insertColumnsAfter(after, count) { assert.equal(calls.held, true); assert.equal(after, this.maxColumns); this.maxColumns += count; },
      getLastRow() {
        let length = this.rows.length;
        while (length && this.rows[length - 1].every((cell) => cell === "")) length--;
        return length;
      },
      getLastColumn() {
        return Math.max(0, ...this.rows.map((row) => {
          let length = row.length;
          while (length && row[length - 1] === "") length--;
          return length;
        }));
      },
      getRange(row, column, rowCount, columnCount) {
        assert.equal(calls.held, true, "sheet reads must hold the script lock");
        return {
          getValues: () => Array.from({ length: rowCount }, (_, offset) =>
            Array.from({ length: columnCount }, (_, cell) => value.rows[row - 1 + offset]?.[column - 1 + cell] ?? "")),
        };
      },
    };
    tabs.set(name, value);
    return value;
  }
  const spreadsheet = {
    getSheetByName: (name) => tabs.get(name) || null,
    insertSheet: (name) => {
      assert.match(name, /^APP_/);
      assert.equal(tabs.has(name), false);
      return sheet(name);
    },
  };
  const context = vm.createContext({
    AULA_SCHEMA: structuredClone(definitions),
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) =>
      (properties ?? { SPREADSHEET_ID: "test-spreadsheet", AULA_STORAGE_SECRET: secret })[key] ?? null }) },
    SpreadsheetApp: {
      openById: (id) => { assert.equal(id, "test-spreadsheet"); assert.equal(calls.held, true); calls.open++; return spreadsheet; },
      flush: () => {},
    },
    LockService: { getScriptLock: () => ({
      tryLock: () => { if (calls.busy) return false; assert.equal(calls.held, false); calls.held = true; calls.locks++; return true; },
      releaseLock: () => { assert.equal(calls.held, true); calls.held = false; calls.releases++; },
    }) },
    Sheets: { Spreadsheets: { Values: { update: (resource, id, range, options) => {
      assert.equal(calls.held, true, "writes must hold the script lock");
      assert.equal(id, "test-spreadsheet");
      assert.equal(options.valueInputOption, "RAW", "user strings must never be interpreted as formulas or dates");
      const match = range.match(/^'([^']+)'!A(\d+):[A-Z]+\d+$/);
      assert.ok(match, range);
      assert.ok(Number(match[2]) <= tabs.get(match[1]).maxRows, "RAW range must fit the current row grid");
      assert.ok(resource.values[0].length <= tabs.get(match[1]).maxColumns, "RAW range must fit the current column grid");
      const failure = calls.failWrite;
      calls.failWrite = "";
      if (failure === "before") throw new Error("private spreadsheet ID and response must never be disclosed");
      tabs.get(match[1]).rows[Number(match[2]) - 1] = Array.from(resource.values[0]);
      calls.writes.push({ range, values: Array.from(resource.values[0]) });
      if (failure === "after") throw new Error("connection lost after successful write");
      return { updatedRows: 1 };
    } } } },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(source, context);
  const plain = (value) => JSON.parse(JSON.stringify(value));
  function post(payload = {}) {
    const request = { action: "storage", version: 1, secret, requestId: randomUUID(), ...payload };
    return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(request) } }).text);
  }
  function setup() { return plain(context.setupStorage()); }
  return { context, post, setup, calls, tabs, sheet };
}

const attendance = (overrides = {}) => ({ email: "docente@example.test", session: "S1", fullName: "Nombre docente", confirmationCode: "AS1-ORIGINAL", ...overrides });

test("setup creates only declared APP_ tabs and preserves legacy records", () => {
  const h = harness();
  const original = [["CORREO", "NOMBRE"], ["legacy@example.test", "Legado"]];
  h.sheet("ASISTENCIA", structuredClone(original));
  h.setup();
  assert.deepEqual(h.tabs.get("ASISTENCIA").rows, original);
  assert.deepEqual(h.tabs.get("APP_ASISTENCIA").rows[0], [...schema.attendance.columns, "_requestId"]);
  const writes = h.calls.writes.length;
  h.setup();
  assert.equal(h.calls.writes.length, writes, "existing valid headers are not rewritten");
});

test("authorization and validation deny access before opening the spreadsheet", () => {
  const h = harness();
  const denied = h.post({ operation: "find", table: "attendance", secret: "incorrect" });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "UNAUTHORIZED");
  const invalid = h.post({ operation: "find", table: "attendance", filters: { unknownField: "private" } });
  assert.equal(invalid.error.code, "INVALID_REQUEST");
  assert.equal(h.calls.open, 0);
  assert.equal(h.calls.locks, 0);
  const get = JSON.parse(h.context.doGet().text);
  assert.equal(get.ok, false);
  assert.equal(h.calls.open, 0);
});

test("setup fails on unexpected headers without altering that sheet", () => {
  const h = harness();
  const wrong = [["CORREO", "NOMBRE"]];
  h.sheet("APP_ASISTENCIA", structuredClone(wrong));
  assert.throws(() => h.setup(), /HEADER_MISMATCH/);
  assert.deepEqual(h.tabs.get("APP_ASISTENCIA").rows, wrong);
  assert.equal(h.calls.writes.length, 0);
  assert.equal(h.calls.held, false);
});

test("idempotent upsert retry cannot increment an attempt twice", () => {
  const h = harness(); h.setup();
  const firstId = randomUUID();
  const first = h.post({ operation: "upsert", table: "attendance", requestId: firstId, values: attendance(), updates: { attempt: { op: "increment", value: 1 } } });
  assert.equal(first.ok, true);
  assert.equal(first.result.attempt, 1);
  const updateId = randomUUID();
  const request = { operation: "upsert", table: "attendance", requestId: updateId, values: attendance(), updates: { attempt: { op: "increment", value: 1 }, confirmationCode: "AS1-UPDATED", updatedAt: { op: "timestamp" } } };
  const updated = h.post(request);
  assert.equal(updated.result.attempt, 2);
  assert.equal(updated.result.createdAt, first.result.createdAt);
  const writes = h.calls.writes.length;
  assert.deepEqual(h.post(request).result, updated.result);
  assert.equal(h.calls.writes.length, writes);
  const outdated = h.post({ ...request, requestId: firstId });
  assert.equal(outdated.ok, false);
  assert.equal(outdated.error.code, "RETRY_REPLACED");
  assert.equal(h.calls.writes.length, writes);
  assert.equal(h.calls.locks, h.calls.releases);
});

test("omitted defaults participate in unique keys for real S1 requests", () => {
  const h = harness({ definitions: generatedSchema }); h.setup();
  const values = { email: "docente@example.test", fullName: "Docente", institution: "Plantel", role: "Docente", consent: true, confirmationCode: "AS1-FIRST" };
  const first = h.post({ operation: "upsert", table: "attendance", values, updates: { fullName: "Docente", confirmationCode: "AS1-FIRST" } });
  const next = h.post({ operation: "upsert", table: "attendance", values: { ...values, fullName: "Docente actualizado", confirmationCode: "AS1-NEXT" }, updates: { fullName: "Docente actualizado", confirmationCode: "AS1-NEXT" } });
  assert.equal(first.ok, true);
  assert.equal(first.result.session, "S1");
  assert.equal(next.result.id, first.result.id);
  assert.equal(next.result.confirmationCode, "AS1-NEXT");
  assert.equal(h.tabs.get(generatedSchema.attendance.tab).rows.length, 2);
  const diagnostic = { email: "docente@example.test", answersJson: "{}", likertAverage: 400, knowledgeScore: 5, confirmationCode: "DS1-FIRST" };
  const pre = h.post({ operation: "upsert", table: "diagnostics", values: diagnostic, updates: { knowledgeScore: 5 } });
  const repeated = h.post({ operation: "upsert", table: "diagnostics", values: diagnostic, updates: { knowledgeScore: 6 } });
  assert.equal(pre.result.phase, "pre");
  assert.equal(repeated.result.id, pre.result.id);
  assert.equal(repeated.result.knowledgeScore, 6);
  assert.equal(h.tabs.get(generatedSchema.diagnostics.tab).rows.length, 2);
});

test("setup expands real evidence tabs beyond the default 26 columns", () => {
  const h = harness({ definitions: generatedSchema });
  h.setup();
  for (const definition of Object.values(generatedSchema)) {
    const tab = h.tabs.get(definition.tab);
    assert.deepEqual(tab.rows[0], [...definition.columns, "_requestId"]);
    assert.ok(tab.maxColumns >= definition.columns.length + 1);
  }
  assert.ok(Object.values(generatedSchema).some((definition) => definition.columns.length + 1 > 26), "fixture must exercise a wide evidence row");
});

test("append expands a full 1000-row grid before writing the next record", () => {
  const h = harness(); h.setup();
  const tab = h.tabs.get("APP_ASISTENCIA");
  for (let index = 1; index < 1000; index++) tab.rows.push([index, `docente${index}@example.test`, "S1", "Nombre", `AS1-${index}`, 1, "2026-10-19T00:00:00.000Z", "2026-10-19T00:00:00.000Z", "[]"]);
  const response = h.post({ operation: "insert", table: "attendance", values: attendance() });
  assert.equal(response.ok, true);
  assert.equal(response.result.id, 1000);
  assert.equal(tab.maxRows, 1001);
  assert.equal(tab.rows.length, 1001);
});

test("S6 route changes update the same email/session/activity row", () => {
  const h = harness(); h.setup();
  const values = { email: "docente@example.test", session: "S6", activity: "evidencia-principal", route: "basica", prompt: "Primer trabajo", confirmationCode: "EV6-FIRST" };
  const first = h.post({ operation: "upsert", table: "session_six_evidence", values });
  const next = h.post({ operation: "upsert", table: "session_six_evidence", values: { ...values, route: "avanzada" }, updates: { route: "avanzada", prompt: "Trabajo revisado", confirmationCode: "EV6-NEXT", attempt: { op: "increment", value: 1 } } });
  assert.equal(next.result.id, first.result.id);
  assert.equal(next.result.route, "avanzada");
  assert.equal(next.result.attempt, 2);
  assert.equal(h.tabs.get("APP_EVIDENCIA_S6").rows.length, 2);
});

test("survey insertIfAbsent preserves its first folio, including replay", () => {
  const h = harness(); h.setup();
  const request = { operation: "insertIfAbsent", table: "course_satisfaction_survey_responses", requestId: randomUUID(), values: { idempotencyKey: "submission-key-1", referenceCode: "SURV-FIRST", generalRating: 5 } };
  const first = h.post(request);
  assert.equal(first.result.inserted, true);
  assert.deepEqual(h.post(request).result, first.result);
  const duplicate = h.post({ ...request, requestId: randomUUID(), values: { ...request.values, referenceCode: "SURV-SECOND" } });
  assert.equal(duplicate.result.inserted, false);
  assert.equal(duplicate.result.row.referenceCode, "SURV-FIRST");
  assert.equal(h.tabs.get("APP_ENCUESTA").rows.length, 2);
});

test("failed append never acknowledges success; lost response can retry a committed write", () => {
  const h = harness(); h.setup();
  const request = { operation: "insert", table: "attendance", requestId: randomUUID(), values: attendance() };
  h.calls.failWrite = "before";
  const failed = h.post(request);
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, "STORAGE_FAILED");
  assert.doesNotMatch(JSON.stringify(failed), /private spreadsheet|docente@example|AS1-ORIGINAL/);
  assert.equal(h.tabs.get("APP_ASISTENCIA").rows.length, 1);
  h.calls.failWrite = "after";
  assert.equal(h.post(request).ok, false);
  const writes = h.calls.writes.length;
  const retried = h.post(request);
  assert.equal(retried.ok, true);
  assert.equal(retried.result.confirmationCode, "AS1-ORIGINAL");
  assert.equal(h.calls.writes.length, writes);
  assert.equal(h.tabs.get("APP_ASISTENCIA").rows.length, 2);
  assert.equal(h.calls.held, false);
});

test("RAW text remains exact for formula-like and apostrophe-leading responses", () => {
  const h = harness(); h.setup();
  for (const [index, text] of ["=IMPORTXML(\"https://example.test\",\"x\")", "'Literal", "+SUM(A1)", "-1", "@texto", "00123", "1/2/2026"].entries()) {
    const saved = h.post({ operation: "insert", table: "attendance", values: attendance({ email: `docente${index}@example.test`, fullName: text }) });
    assert.equal(saved.ok, true);
    const found = h.post({ operation: "find", table: "attendance", filters: { id: saved.result.id }, options: { columns: ["fullName"] } });
    assert.deepEqual(found.result, [{ fullName: text }]);
  }
});

test("reads honor filters, ordering and projections; counts disclose only requested groups", () => {
  const h = harness(); h.setup();
  h.post({ operation: "insert", table: "attendance", values: attendance({ email: "a@example.test", session: "S1", fullName: "A" }) });
  h.post({ operation: "insert", table: "attendance", values: attendance({ email: "b@example.test", session: "S1", fullName: "B" }) });
  h.post({ operation: "insert", table: "attendance", values: attendance({ email: "c@example.test", session: "S2", fullName: "C" }) });
  assert.deepEqual(h.post({ operation: "find", table: "attendance", filters: { session: "S1" }, options: { orderBy: "id", descending: true, limit: 1, columns: ["fullName"] } }).result, [{ fullName: "B" }]);
  assert.deepEqual(h.post({ operation: "countBy", table: "attendance", field: "session" }).result, [{ category: "S1", count: 2 }, { category: "S2", count: 1 }]);
});

test("oversized fields and a busy lock fail without writing", () => {
  const h = harness(); h.setup();
  const writes = h.calls.writes.length;
  assert.equal(h.post({ operation: "insert", table: "attendance", values: attendance({ fullName: "x".repeat(45001) }) }).error.code, "INVALID_REQUEST");
  h.calls.busy = true;
  assert.equal(h.post({ operation: "insert", table: "attendance", values: attendance() }).error.code, "BUSY");
  assert.equal(h.calls.writes.length, writes);
});

test("manifest declares the RAW Sheets API and only spreadsheet access", async () => {
  const manifest = JSON.parse(await readFile(new URL("../google-apps-script/appsscript.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.oauthScopes, ["https://www.googleapis.com/auth/spreadsheets"]);
  assert.deepEqual(manifest.dependencies.enabledAdvancedServices, [{ userSymbol: "Sheets", serviceId: "sheets", version: "v4" }]);
});
