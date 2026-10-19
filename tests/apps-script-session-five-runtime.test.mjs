import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const schemaSource = await readFile(new URL("../google-apps-script/Schema.gs", import.meta.url), "utf8");
const secret = "s5-private-storage-test-secret-at-least-32-characters";
const plain = (value) => JSON.parse(JSON.stringify(value));

// Exercise the new primary receiver with its real generated schema. Former
// mirror-only header repair is intentionally replaced by legacy-tab isolation.
function harness() {
  const tabs = new Map();
  const calls = { opened: 0, held: false, locks: 0, releases: 0, writes: [], expansions: [] };
  function sheet(name, rows = []) {
    const tab = {
      rows,
      maxColumns: 26,
      maxRows: 1000,
      getMaxColumns() { return this.maxColumns; },
      getMaxRows() { return this.maxRows; },
      insertColumnsAfter(after, count) {
        assert.equal(calls.held, true);
        assert.equal(after, this.maxColumns);
        this.maxColumns += count;
        calls.expansions.push({ name, after, count });
      },
      insertRowsAfter(after, count) {
        assert.equal(calls.held, true);
        assert.equal(after, this.maxRows);
        this.maxRows += count;
      },
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
        assert.equal(calls.held, true, "Read operations must hold the script lock");
        assert.ok(column + columnCount - 1 <= this.maxColumns);
        return { getValues: () => Array.from({ length: rowCount }, (_, offset) =>
          Array.from({ length: columnCount }, (_, cell) => this.rows[row - 1 + offset]?.[column - 1 + cell] ?? "")) };
      },
    };
    tabs.set(name, tab);
    return tab;
  }
  const spreadsheet = {
    getSheetByName: (name) => tabs.get(name) || null,
    insertSheet: (name) => {
      assert.equal(calls.held, true);
      assert.match(name, /^APP_/);
      assert.equal(tabs.has(name), false);
      return sheet(name);
    },
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) =>
      ({ SPREADSHEET_ID: "private-test-sheet", AULA_STORAGE_SECRET: secret })[key] ?? null }) },
    SpreadsheetApp: {
      openById: (id) => {
        assert.equal(id, "private-test-sheet");
        assert.equal(calls.held, true);
        calls.opened++;
        return spreadsheet;
      },
      flush() {},
    },
    LockService: { getScriptLock: () => ({
      tryLock(milliseconds) {
        assert.equal(milliseconds, 20000);
        assert.equal(calls.held, false);
        calls.held = true;
        calls.locks++;
        return true;
      },
      releaseLock() {
        assert.equal(calls.held, true);
        calls.held = false;
        calls.releases++;
      },
    }) },
    Sheets: { Spreadsheets: { Values: { update(resource, id, range, options) {
      assert.equal(calls.held, true, "Writes must hold the script lock");
      assert.equal(id, "private-test-sheet");
      assert.equal(options.valueInputOption, "RAW");
      const match = range.match(/^'([^']+)'!A(\d+):([A-Z]+)(\d+)$/);
      assert.ok(match, `Invalid RAW range: ${range}`);
      assert.equal(match[2], match[4]);
      const target = tabs.get(match[1]);
      assert.ok(target);
      const width = Array.from(match[3]).reduce((count, letter) => count * 26 + letter.charCodeAt(0) - 64, 0);
      assert.equal(width, resource.values[0].length, "A1 end-column must include every value");
      assert.ok(width <= target.maxColumns, "Expand the grid before writing columns beyond Z");
      assert.ok(Number(match[2]) <= target.maxRows);
      target.rows[Number(match[2]) - 1] = Array.from(resource.values[0]);
      calls.writes.push({ tab: match[1], range, values: Array.from(resource.values[0]) });
      return { updatedRows: 1 };
    } } } },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(schemaSource, context);
  vm.runInContext(source, context);
  const schema = plain(context.AULA_SCHEMA);
  function post(payload = {}) {
    const request = { action: "storage", version: 1, secret, requestId: randomUUID(), ...payload };
    return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(request) } }).text);
  }
  return { context, calls, tabs, sheet, schema, post, setup: () => plain(context.setupStorage()) };
}

function evidence(confirmationCode = "EV5-TEST-V1") {
  return {
    participantId: "PAR-S5-TEST", fullName: "Docente sintético", email: "s5@example.test",
    session: "S5", route: "principal", activity: "evidencia-principal",
    sequenceKey: "secuencia-s5-prueba", sequenceTitle: "Evaluación con evidencia agregada",
    educationalLevel: "Educación media superior", subject: "Ciencias sociales",
    difficultyLevel: "intermedio", instrumentType: "lista_cotejo",
    learningPurpose: "Interpretar evidencia para decidir un siguiente paso docente.",
    pedagogicalContext: "Grupo hipotético sin información personal.", sourceCase: "Caso sintético AULA-IA.",
    instrumentDesign: "Criterios observables con opciones de seguimiento.",
    criteriaDescriptors: "Descriptores de conductas observables sin etiquetas personales.",
    prompt: "Diseña un instrumento y marca cada supuesto como propuesta.",
    aiDraft: "Borrador que necesita revisión docente.", datasetSummary: "Doce respuestas sintéticas.",
    findings: "La argumentación requiere apoyo.", groupComparison: "Comparación agregada de G1, G2 y G3.",
    teacherDecision: "Realizar una práctica guiada y observar de nuevo.",
    limitations: "La muestra sintética no permite generalizar.", adaptation: "Alternativa oral accesible.",
    checklistJson: JSON.stringify({ alineacion: true, privacidad: true }), confirmationCode,
  };
}

const saveS5 = (values, extra = {}) => ({ operation: "upsert", table: "session_five_evidence", values, ...extra });

test("S5 setup expands its primary tab beyond Z and preserves every legacy sheet", () => {
  const h = harness();
  const legacy = ["PARTICIPANTES", "ASISTENCIA", "NIVELACION", "S4_EVIDENCIAS", "S5_EVIDENCIAS"];
  for (const name of legacy) h.sheet(name, [["ENCABEZADO_LEGADO"], [`Registro ${name}`, "=ROW()"]]);
  const before = Object.fromEntries(legacy.map((name) => [name, structuredClone(h.tabs.get(name).rows)]));
  assert.equal(h.setup().ok, true);
  const definition = h.schema.session_five_evidence;
  const tab = h.tabs.get(definition.tab);
  assert.ok(definition.columns.length + 1 > 26);
  assert.deepEqual(tab.rows[0], [...definition.columns, "_requestId"]);
  assert.equal(tab.maxColumns, definition.columns.length + 1);
  assert.ok(h.calls.expansions.some(({ name, after }) => name === definition.tab && after === 26));
  for (const name of legacy) assert.deepEqual(h.tabs.get(name).rows, before[name]);
  assert.ok(h.calls.writes.every(({ tab: name }) => name.startsWith("APP_")));
  const writes = h.calls.writes.length;
  h.setup();
  assert.equal(h.calls.writes.length, writes, "A second setup must preserve existing headers");
});

test("S5 primary write retains every evidence field and leaves earlier course tabs unchanged", () => {
  const h = harness(); h.setup();
  const definition = h.schema.session_five_evidence;
  const prior = new Map([...h.tabs].filter(([name]) => name !== definition.tab).map(([name, tab]) => [name, structuredClone(tab.rows)]));
  const values = evidence();
  values.prompt = '=HYPERLINK("https://example.test", "texto literal")';
  const response = h.post(saveS5(values));
  assert.equal(response.ok, true);
  for (const [field, value] of Object.entries(values)) assert.equal(response.result[field], value, field);
  assert.equal(response.result.attempt, 1);
  assert.equal(response.result.responseVersion, 1);
  const tab = h.tabs.get(definition.tab);
  assert.equal(tab.rows.length, 2);
  for (const [field, value] of Object.entries(values)) assert.equal(tab.rows[1][definition.columns.indexOf(field)], value, field);
  assert.match(h.calls.writes.at(-1).range, /!A2:AH2$/);
  for (const [name, rows] of prior) assert.deepEqual(h.tabs.get(name).rows, rows, name);
  assert.equal(h.calls.locks, h.calls.releases);
});

test("S5 retries are idempotent and a new folio updates one row with one version increment", () => {
  const h = harness(); h.setup();
  const initial = saveS5(evidence(), { requestId: randomUUID() });
  const first = h.post(initial);
  assert.equal(first.ok, true);
  const afterFirst = h.calls.writes.length;
  assert.deepEqual(h.post(initial).result, first.result);
  assert.equal(h.calls.writes.length, afterFirst);
  const revised = evidence("EV5-TEST-V2");
  revised.teacherDecision = "Decisión revisada y nuevo seguimiento.";
  const update = saveS5(revised, {
    requestId: randomUUID(),
    updates: {
      teacherDecision: revised.teacherDecision, confirmationCode: revised.confirmationCode,
      attempt: { op: "increment", value: 1 }, responseVersion: { op: "increment", value: 1 },
      updatedAt: { op: "timestamp" },
    },
  });
  const next = h.post(update);
  assert.equal(next.ok, true);
  assert.equal(next.result.id, first.result.id);
  assert.equal(next.result.participantId, first.result.participantId);
  assert.equal(next.result.createdAt, first.result.createdAt);
  assert.equal(next.result.confirmationCode, "EV5-TEST-V2");
  assert.equal(next.result.teacherDecision, revised.teacherDecision);
  assert.equal(next.result.attempt, 2);
  assert.equal(next.result.responseVersion, 2);
  const afterUpdate = h.calls.writes.length;
  assert.deepEqual(h.post(update).result, next.result);
  assert.equal(h.calls.writes.length, afterUpdate);
  assert.equal(h.post(initial).error.code, "RETRY_REPLACED");
  assert.equal(h.calls.writes.length, afterUpdate);
  assert.equal(h.tabs.get(h.schema.session_five_evidence.tab).rows.length, 2);
  assert.equal(h.calls.locks, h.calls.releases);
});

test("S5 attendance remains distinct from S1–S4 for the same participant", () => {
  const h = harness(); h.setup();
  const evidenceBefore = structuredClone(h.tabs.get(h.schema.session_five_evidence.tab).rows);
  for (const session of ["S1", "S2", "S3", "S4", "S5"]) {
    const values = {
      email: "same-teacher@example.test", fullName: "Docente sintético", institution: "Plantel",
      role: "Docente", consent: true, session, confirmationCode: `AS-${session}`,
    };
    assert.equal(h.post({ operation: "upsert", table: "attendance", values }).ok, true);
  }
  for (const session of ["S1", "S2", "S3", "S4", "S5"]) {
    const result = h.post({ operation: "find", table: "attendance", filters: { email: "same-teacher@example.test", session }, options: { columns: ["session", "confirmationCode"] } });
    assert.equal(result.ok, true);
    assert.deepEqual(result.result, [{ session, confirmationCode: `AS-${session}` }]);
  }
  assert.equal(h.tabs.get(h.schema.attendance.tab).rows.length, 6);
  assert.deepEqual(h.tabs.get(h.schema.session_five_evidence.tab).rows, evidenceBefore);
});

test("S5 rejects public access, legacy actions and invalid records without persisting them", () => {
  const h = harness();
  const denied = h.post(saveS5(evidence(), { secret: "incorrect" }));
  assert.equal(denied.error.code, "UNAUTHORIZED");
  assert.equal(JSON.parse(h.context.doGet().text).error.code, "METHOD_NOT_ALLOWED");
  assert.equal(h.post({ action: "s5_evidence", ...evidence() }).error.code, "INVALID_REQUEST");
  assert.equal(h.post({ operation: "find", table: "S5_EVIDENCIAS" }).error.code, "INVALID_REQUEST");
  assert.equal(h.calls.opened, 0);
  assert.equal(h.calls.writes.length, 0);
  h.setup();
  const writes = h.calls.writes.length;
  const missingFolio = evidence();
  delete missingFolio.confirmationCode;
  const invalid = h.post(saveS5(missingFolio));
  assert.equal(invalid.error.code, "INVALID_REQUEST");
  assert.doesNotMatch(JSON.stringify(invalid), /s5@example|private-test-sheet|storage-test-secret/);
  assert.equal(h.post(saveS5({ ...evidence(), unknownField: "unapproved" })).error.code, "INVALID_REQUEST");
  assert.equal(h.calls.writes.length, writes);
  assert.equal(h.tabs.get(h.schema.session_five_evidence.tab).rows.length, 1);
  assert.equal(h.calls.locks, h.calls.releases);
});

test("S5 refuses altered primary headers and never repairs or overwrites legacy content", () => {
  const h = harness();
  const legacy = [["ID_REGISTRO", "OTRA_COLUMNA"], ["LEGACY-S5", "=ROW()"]];
  h.sheet("S5_EVIDENCIAS", structuredClone(legacy));
  h.setup();
  const primary = h.tabs.get(h.schema.session_five_evidence.tab);
  primary.rows[0][0] = "unexpected_header";
  const before = structuredClone(primary.rows);
  const writes = h.calls.writes.length;
  const response = h.post(saveS5(evidence()));
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "HEADER_MISMATCH");
  assert.deepEqual(primary.rows, before);
  assert.deepEqual(h.tabs.get("S5_EVIDENCIAS").rows, legacy);
  assert.equal(h.calls.writes.length, writes);
  assert.equal(h.calls.held, false);
  assert.equal(h.calls.locks, h.calls.releases);
});
