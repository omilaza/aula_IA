import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function executeMigration(database, migration) {
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) database.exec(sql);
  }
}

test("the survey outbox migration is additive and preserves existing responses", async () => {
  const [surveyMigration, syncMigration, previousSnapshotText, currentSnapshotText] =
    await Promise.all([
      read("../drizzle/0006_light_the_call.sql"),
      read("../drizzle/0007_graceful_scorpion.sql"),
      read("../drizzle/meta/0006_snapshot.json"),
      read("../drizzle/meta/0007_snapshot.json"),
    ]);
  const previousSnapshot = JSON.parse(previousSnapshotText);
  const currentSnapshot = JSON.parse(currentSnapshotText);

  assert.match(syncMigration, /^CREATE TABLE `course_satisfaction_survey_sync`/);
  assert.match(syncMigration, /course_satisfaction_survey_sync_idempotency_unique/);
  assert.match(syncMigration, /course_satisfaction_survey_sync_status_idx/);
  assert.doesNotMatch(syncMigration, /\b(?:ALTER|DROP|DELETE|UPDATE|INSERT|REPLACE)\b/i);
  for (const [tableName, definition] of Object.entries(previousSnapshot.tables)) {
    assert.deepEqual(currentSnapshot.tables[tableName], definition);
  }

  const database = new DatabaseSync(":memory:");
  executeMigration(database, surveyMigration);
  database.prepare(`
    INSERT INTO course_satisfaction_survey_responses (
      idempotency_key, general_rating, content_rating, instructor_rating,
      platform_rating, reference_code, liked_most
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run("historic-key-001", 5, 4, 5, 4, "SURV-HIST-0001", "Registro histórico");
  const before = { ...database.prepare(
    "SELECT * FROM course_satisfaction_survey_responses WHERE idempotency_key = ?",
  ).get("historic-key-001") };

  executeMigration(database, syncMigration);
  const after = { ...database.prepare(
    "SELECT * FROM course_satisfaction_survey_responses WHERE idempotency_key = ?",
  ).get("historic-key-001") };
  assert.deepEqual(after, before);
  assert.equal(
    database.prepare("SELECT COUNT(*) AS total FROM course_satisfaction_survey_sync").get().total,
    0,
  );
  database.close();
});

test("payload mapping preserves N/A materials and sync state recovers after a failure", async () => {
  const {
    courseSurveySheetPayload,
    courseSurveyStoredSyncUpdate,
  } = await import("../app/course-survey-sheet-sync.ts");
  const row = {
    id: 7,
    idempotencyKey: "survey-key-0007",
    isAnonymous: true,
    name: "",
    email: "",
    generalRating: 5,
    contentRating: 4,
    instructorRating: 5,
    platformRating: 4,
    activitiesRating: 3,
    materialsRating: null,
    materialsNotUsed: true,
    recommendationApplication: "definitely_yes",
    likedMost: "Las prácticas",
    improvements: "Más tiempo",
    additionalComments: "Gracias",
    referenceCode: "SURV-TEST-0007",
    createdAt: "2026-08-19 08:30:00",
  };

  assert.deepEqual(courseSurveySheetPayload(row), {
    action: "course_satisfaction_survey",
    referenceCode: "SURV-TEST-0007",
    submittedAt: "2026-08-19 08:30:00",
    responseMode: "Anónima",
    name: "",
    email: "",
    generalRating: 5,
    contentRating: 4,
    instructorRating: 5,
    platformRating: 4,
    activitiesRating: 3,
    materialsRating: null,
    materialsNotUsed: true,
    recommendationApplication: "definitely_yes",
    likedMost: "Las prácticas",
    improvements: "Más tiempo",
    additionalComments: "Gracias",
    idempotencyKey: "survey-key-0007",
    source: "AULA-IA /encuesta-satisfaccion",
  });

  assert.deepEqual(
    courseSurveyStoredSyncUpdate(
      { status: "failed", attempts: 3, detail: "Sheets temporalmente no disponible" },
      "2026-08-19T08:31:00.000Z",
    ),
    {
      status: "failed",
      attemptsDelta: 3,
      lastAttemptAt: "2026-08-19T08:31:00.000Z",
      lastError: "Sheets temporalmente no disponible",
      syncedAt: null,
    },
  );
  assert.deepEqual(
    courseSurveyStoredSyncUpdate(
      { status: "synced", attempts: 1 },
      "2026-08-19T08:35:00.000Z",
    ),
    {
      status: "synced",
      attemptsDelta: 1,
      lastAttemptAt: "2026-08-19T08:35:00.000Z",
      lastError: "",
      syncedAt: "2026-08-19T08:35:00.000Z",
    },
  );
  assert.equal(
    courseSurveyStoredSyncUpdate(
      { status: "not_configured" },
      "2026-08-19T08:40:00.000Z",
    ).status,
    "pending",
  );
});

test("the route accepts a Sheet delivery only when the receiver confirms the same folio", async () => {
  const [route, transport] = await Promise.all([
    read("../app/api/course-survey/route.ts"),
    read("../app/sheets-sync.ts"),
  ]);
  assert.match(
    route,
    /transport\.status === "synced" && transport\.referenceCode !== row\.referenceCode/,
  );
  assert.match(route, /El receptor institucional no confirmó el folio esperado/);
  assert.match(transport, /referenceCode: safeDetail\(result\.referenceCode\)/);
  assert.match(transport, /result\.idempotent === true/);
  assert.match(
    route,
    /stored\.status === "synced"[\s\S]*?ne\(courseSatisfactionSurveySync\.status, "synced"\)/,
  );
  assert.match(route, /const \[finalRecord\] = await db[\s\S]*?return finalRecord\?\.status === "synced"/);
});

test("a late failure cannot overwrite an already synchronized outbox row", async () => {
  const migration = await read("../drizzle/0007_graceful_scorpion.sql");
  const database = new DatabaseSync(":memory:");
  executeMigration(database, migration);
  database.prepare(`
    INSERT INTO course_satisfaction_survey_sync
      (idempotency_key, reference_code, status, attempts)
    VALUES (?, ?, 'pending', 0)
  `).run("survey-key-race", "SURV-RACE-0001");

  database.prepare(`
    UPDATE course_satisfaction_survey_sync
       SET status = 'synced', attempts = attempts + 1,
           synced_at = '2026-08-19T10:00:00.000Z', last_error = ''
     WHERE idempotency_key = ?
  `).run("survey-key-race");
  const lateFailure = database.prepare(`
    UPDATE course_satisfaction_survey_sync
       SET status = 'failed', attempts = attempts + 3,
           synced_at = NULL, last_error = 'late timeout'
     WHERE idempotency_key = ? AND status <> 'synced'
  `).run("survey-key-race");

  assert.equal(lateFailure.changes, 0);
  assert.deepEqual(
    { ...database.prepare(`
      SELECT status, attempts, synced_at, last_error
        FROM course_satisfaction_survey_sync
       WHERE idempotency_key = ?
    `).get("survey-key-race") },
    {
      status: "synced",
      attempts: 1,
      synced_at: "2026-08-19T10:00:00.000Z",
      last_error: "",
    },
  );
  database.close();
});

test("the same outbox folio recovers from a temporary failure without duplication", async () => {
  const migration = await read("../drizzle/0007_graceful_scorpion.sql");
  const database = new DatabaseSync(":memory:");
  executeMigration(database, migration);
  database.prepare(`
    INSERT INTO course_satisfaction_survey_sync
      (idempotency_key, reference_code, status, attempts)
    VALUES (?, ?, 'pending', 0)
  `).run("survey-key-recovery", "SURV-RECOVERY-0001");

  database.prepare(`
    UPDATE course_satisfaction_survey_sync
       SET status = 'failed', attempts = attempts + 3,
           last_attempt_at = '2026-08-19T11:00:00.000Z',
           last_error = 'temporary outage', synced_at = NULL
     WHERE idempotency_key = ? AND status <> 'synced'
  `).run("survey-key-recovery");
  assert.deepEqual(
    { ...database.prepare(`
      SELECT reference_code, status, attempts, last_error, synced_at
        FROM course_satisfaction_survey_sync WHERE idempotency_key = ?
    `).get("survey-key-recovery") },
    {
      reference_code: "SURV-RECOVERY-0001",
      status: "failed",
      attempts: 3,
      last_error: "temporary outage",
      synced_at: null,
    },
  );

  database.prepare(`
    UPDATE course_satisfaction_survey_sync
       SET status = 'synced', attempts = attempts + 1,
           last_attempt_at = '2026-08-19T11:05:00.000Z',
           last_error = '', synced_at = '2026-08-19T11:05:00.000Z'
     WHERE idempotency_key = ?
  `).run("survey-key-recovery");
  assert.deepEqual(
    { ...database.prepare(`
      SELECT reference_code, status, attempts, last_error, synced_at
        FROM course_satisfaction_survey_sync WHERE idempotency_key = ?
    `).get("survey-key-recovery") },
    {
      reference_code: "SURV-RECOVERY-0001",
      status: "synced",
      attempts: 4,
      last_error: "",
      synced_at: "2026-08-19T11:05:00.000Z",
    },
  );
  assert.equal(
    database.prepare("SELECT COUNT(*) AS total FROM course_satisfaction_survey_sync").get().total,
    1,
  );
  database.close();
});

class MockRange {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset),
      ),
    );
  }

  getValue() {
    return this.sheet.valueAt(this.row, this.column);
  }

  getFormulas() {
    return Array.from({ length: this.rowCount }, () =>
      Array.from({ length: this.columnCount }, () => ""),
    );
  }

  setValues(rows) {
    for (let rowOffset = 0; rowOffset < rows.length; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < rows[rowOffset].length; columnOffset += 1) {
        this.sheet.setValueAt(
          this.row + rowOffset,
          this.column + columnOffset,
          rows[rowOffset][columnOffset],
        );
      }
    }
    return this;
  }

  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setNumberFormat() { return this; }
  setWrap() { return this; }
  setVerticalAlignment() { return this; }
  createFilter() { this.sheet.filterCreated = true; return this; }
}

class MockSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = structuredClone(rows);
    this.maxColumns = 26;
    this.maxRows = 200;
    this.frozenRows = 0;
    this.filterCreated = false;
    this.widths = new Map();
  }

  valueAt(row, column) {
    return this.rows[row - 1]?.[column - 1] ?? "";
  }

  setValueAt(row, column, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < column) this.rows[row - 1].push("");
    this.rows[row - 1][column - 1] = value;
  }

  getRange(row, column, rowCount = 1, columnCount = 1) {
    return new MockRange(this, row, column, rowCount, columnCount);
  }

  getMaxColumns() { return this.maxColumns; }
  getMaxRows() { return this.maxRows; }
  getLastRow() {
    for (let row = this.rows.length - 1; row >= 0; row -= 1) {
      if (this.rows[row].some((value) => value !== "")) return row + 1;
    }
    return 0;
  }
  getLastColumn() {
    return this.rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  }
  insertColumnsAfter(_after, count) { this.maxColumns += count; }
  insertRowsAfter(_after, count) { this.maxRows += count; }
  setFrozenRows(count) { this.frozenRows = count; }
  setColumnWidth(column, width) { this.widths.set(column, width); }
  setColumnWidths(start, count, width) {
    for (let column = start; column < start + count; column += 1) {
      this.widths.set(column, width);
    }
  }
}

class MockSpreadsheet {
  constructor() {
    this.insertions = [];
    this.sheets = new Map([
      ["SATISFACCION", new MockSheet("SATISFACCION", [["SENTINELA_HISTORICA"]])],
      ["ASISTENCIA", new MockSheet("ASISTENCIA", [["SENTINELA_ASISTENCIA"]])],
    ]);
  }

  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) {
    const sheet = new MockSheet(name);
    this.sheets.set(name, sheet);
    this.insertions.push(name);
    return sheet;
  }
}

test("Apps Script creates only ENCUESTA_SATISFACCION and ignores duplicate folios", async () => {
  const script = await read("../google-apps-script/Code.gs");
  assert.match(script, /surveyVersion: 'SURVEY-2026-08-19'/);
  const secret = script.match(/const WEBHOOK_SECRET = '([^']+)'/)[1];
  const spreadsheet = new MockSpreadsheet();
  const attendanceBefore = structuredClone(spreadsheet.sheets.get("ASISTENCIA").rows);
  const legacySatisfactionBefore = structuredClone(spreadsheet.sheets.get("SATISFACCION").rows);
  const lock = { tryLock: () => true, releaseLock() {} };
  const context = vm.createContext({
    console,
    SpreadsheetApp: { openById: () => spreadsheet, flush() {} },
    LockService: { getScriptLock: () => lock },
    Utilities: { getUuid: () => "00000000-0000-0000-0000-000000000001" },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text) {
        return { text, setMimeType() { return this; } };
      },
    },
  });
  vm.runInContext(script, context);
  assert.deepEqual(
    [
      "definitely_yes",
      "probably_yes",
      "unsure",
      "probably_no",
      "definitely_no",
    ].map((value) => context.courseSurveyRecommendation_(value)),
    [
      "Sí, definitivamente",
      "Probablemente sí",
      "Aún no estoy seguro/a",
      "Probablemente no",
      "No por ahora",
    ],
  );
  const payload = {
    secret,
    action: "course_satisfaction_survey",
    referenceCode: "SURV-TEST-0008",
    submittedAt: "2026-08-19T08:30:00.000Z",
    responseMode: "Anónima",
    generalRating: 5,
    contentRating: 4,
    instructorRating: 5,
    platformRating: 4,
    activitiesRating: 3,
    materialsRating: null,
    materialsNotUsed: true,
    recommendationApplication: "definitely_yes",
    likedMost: "Las prácticas",
    improvements: "Más tiempo",
    additionalComments: "Gracias",
    idempotencyKey: "survey-key-0008",
    source: "AULA-IA /encuesta-satisfaccion",
  };
  const post = (body) => JSON.parse(
    context.doPost({ postData: { contents: JSON.stringify(body) } }).text,
  );

  const first = post(payload);
  assert.equal(first.ok, true);
  assert.equal(first.idempotent, false);
  assert.deepEqual(spreadsheet.insertions, ["ENCUESTA_SATISFACCION"]);
  const survey = spreadsheet.sheets.get("ENCUESTA_SATISFACCION");
  assert.equal(survey.getLastRow(), 2);
  assert.deepEqual(survey.rows[0], [
    "FOLIO_RESPUESTA", "FECHA_HORA", "TIPO_RESPUESTA", "NOMBRE_OPCIONAL",
    "CORREO_OPCIONAL", "SATISFACCION_GENERAL", "CONTENIDOS", "INSTRUCTOR",
    "PLATAFORMA", "ACTIVIDADES", "MATERIALES", "MATERIALES_NO_APLICA",
    "RECOMENDAR_APLICAR", "MAS_GUSTO_Y_POR_QUE", "MEJORARIA_Y_POR_QUE",
    "COMENTARIOS_ADICIONALES", "TECH_IDEMPOTENCY_KEY", "TECH_SYNC_UPDATED_AT",
    "ORIGEN",
  ]);
  assert.equal(survey.valueAt(2, 1), "SURV-TEST-0008");
  assert.equal(survey.valueAt(2, 11), "");
  assert.equal(survey.valueAt(2, 12), "Sí");
  assert.equal(survey.valueAt(2, 17), "survey-key-0008");
  assert.equal(survey.valueAt(2, 2).toISOString(), "2026-08-19T08:30:00.000Z");
  assert.equal(survey.frozenRows, 1);
  assert.equal(survey.filterCreated, true);

  const duplicate = post(payload);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.idempotent, true);
  assert.equal(survey.getLastRow(), 2);

  survey.maxRows = 2;
  const next = post({
    ...payload,
    referenceCode: "SURV-TEST-0010",
    idempotencyKey: "survey-key-0010",
    submittedAt: "2026-08-19 14:45:00",
  });
  assert.equal(next.ok, true);
  assert.equal(survey.getLastRow(), 3);
  assert.equal(survey.valueAt(3, 2).toISOString(), "2026-08-19T14:45:00.000Z");
  assert.equal(survey.maxRows, 102);
  assert.deepEqual(spreadsheet.sheets.get("ASISTENCIA").rows, attendanceBefore);
  assert.deepEqual(spreadsheet.sheets.get("SATISFACCION").rows, legacySatisfactionBefore);
});

test("Apps Script preserves survey text without allowing Sheet formulas", async () => {
  const script = await read("../google-apps-script/Code.gs");
  const secret = script.match(/const WEBHOOK_SECRET = '([^']+)'/)[1];
  const spreadsheet = new MockSpreadsheet();
  const context = vm.createContext({
    console,
    SpreadsheetApp: { openById: () => spreadsheet, flush() {} },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }),
    },
    Utilities: { getUuid: () => "00000000-0000-0000-0000-000000000001" },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text) {
        return { text, setMimeType() { return this; } };
      },
    },
  });
  vm.runInContext(script, context);

  const result = JSON.parse(context.doPost({ postData: { contents: JSON.stringify({
    secret,
    action: "course_satisfaction_survey",
    referenceCode: "SURV-TEST-0009",
    submittedAt: "2026-08-19T08:30:00.000Z",
    responseMode: "Con seguimiento",
    name: "=IMPORTDATA(\"https://example.invalid\")",
    email: "safe@example.edu",
    generalRating: 5,
    contentRating: 5,
    instructorRating: 5,
    platformRating: 5,
    activitiesRating: 5,
    materialsRating: 5,
    materialsNotUsed: false,
    recommendationApplication: "definitely_yes",
    likedMost: "+SUM(1,1)",
    improvements: "-1+2",
    additionalComments: "@malicious",
    idempotencyKey: "survey-key-0009",
    source: "=UNTRUSTED",
  }) } }).text);

  assert.equal(result.ok, true);
  const row = spreadsheet.sheets.get("ENCUESTA_SATISFACCION").rows[1];
  for (const column of [3, 13, 14, 15, 18]) {
    assert.match(row[column], /^'/, `column ${column + 1} must be literal text`);
  }
  assert.equal(row[4], "safe@example.edu");
  assert.equal(spreadsheet.sheets.get("SATISFACCION").rows[0][0], "SENTINELA_HISTORICA");
});
