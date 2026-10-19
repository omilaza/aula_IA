import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

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

  getFormulas() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.formulaAt(this.row + rowOffset, this.column + columnOffset),
      ),
    );
  }

  getValue() {
    return this.getValues()[0][0];
  }

  setValues(values) {
    assert.equal(values.length, this.rowCount);
    for (let rowOffset = 0; rowOffset < this.rowCount; rowOffset += 1) {
      assert.equal(values[rowOffset].length, this.columnCount);
      for (let columnOffset = 0; columnOffset < this.columnCount; columnOffset += 1) {
        this.sheet.assertValidValue(
          this.row + rowOffset,
          this.column + columnOffset,
          values[rowOffset][columnOffset],
        );
        this.sheet.setValueAt(
          this.row + rowOffset,
          this.column + columnOffset,
          values[rowOffset][columnOffset],
        );
      }
    }
    this.sheet.mutations.push({ type: "setValues", row: this.row, column: this.column, rowCount: this.rowCount, columnCount: this.columnCount });
    return this;
  }

  setValue(value) {
    this.sheet.setValueAt(this.row, this.column, value);
    this.sheet.mutations.push({ type: "setValue", row: this.row, column: this.column });
    return this;
  }

  setFontWeight() {
    return this;
  }

  clearDataValidations() {
    this.sheet.clearValidations(
      this.row,
      this.column,
      this.rowCount,
      this.columnCount,
    );
    this.sheet.mutations.push({
      type: "clearDataValidations",
      row: this.row,
      column: this.column,
      rowCount: this.rowCount,
      columnCount: this.columnCount,
    });
    return this;
  }
}

class MockSheet {
  constructor(name, headers = []) {
    this.name = name;
    this.rows = headers.length ? [headers.slice()] : [];
    this.formulas = [];
    this.validations = new Map();
    this.maxColumns = Math.max(26, headers.length);
    this.maxRows = 100;
    this.frozenRows = 0;
    this.mutations = [];
  }

  validationKey(row, column) {
    return `${row}:${column}`;
  }

  setValidationAt(row, column, allowedValues) {
    this.validations.set(
      this.validationKey(row, column),
      new Set(allowedValues),
    );
  }

  validationAt(row, column) {
    return this.validations.get(this.validationKey(row, column)) || null;
  }

  assertValidValue(row, column, value) {
    const validation = this.validationAt(row, column);
    if (validation && !validation.has(value)) {
      throw new Error(`Strict validation rejected ${String(value)} at ${row}:${column}`);
    }
  }

  clearValidations(row, column, rowCount, columnCount) {
    for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < columnCount; columnOffset += 1) {
        this.validations.delete(
          this.validationKey(row + rowOffset, column + columnOffset),
        );
      }
    }
  }

  valueAt(row, column) {
    return this.rows[row - 1]?.[column - 1] ?? "";
  }

  formulaAt(row, column) {
    return this.formulas[row - 1]?.[column - 1] ?? "";
  }

  setValueAt(row, column, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < column) this.rows[row - 1].push("");
    this.rows[row - 1][column - 1] = value;
    this.maxColumns = Math.max(this.maxColumns, column);
  }

  setFormulaAt(row, column, formula) {
    while (this.formulas.length < row) this.formulas.push([]);
    while (this.formulas[row - 1].length < column) this.formulas[row - 1].push("");
    this.formulas[row - 1][column - 1] = formula;
    this.maxColumns = Math.max(this.maxColumns, column);
  }

  getRange(row, column, rowCount = 1, columnCount = 1) {
    return new MockRange(this, row, column, rowCount, columnCount);
  }

  getLastRow() {
    const last = Math.max(this.rows.length, this.formulas.length);
    for (let row = last; row > 0; row -= 1) {
      const values = this.rows[row - 1] || [];
      const formulas = this.formulas[row - 1] || [];
      if (values.some((value) => value !== "") || formulas.some((value) => value !== "")) return row;
    }
    return 0;
  }

  getLastColumn() {
    return Math.max(
      1,
      ...this.rows.map((row) => row.length),
      ...this.formulas.map((row) => row.length),
    );
  }

  getMaxColumns() {
    return this.maxColumns;
  }

  getMaxRows() {
    return this.maxRows;
  }

  insertColumnsAfter(after, count) {
    const inheritedValidations = [];
    for (let row = 1; row <= this.maxRows; row += 1) {
      const validation = this.validationAt(row, after);
      if (validation) inheritedValidations.push([row, [...validation]]);
    }
    this.maxColumns += count;
    for (const [row, allowedValues] of inheritedValidations) {
      for (let column = after + 1; column <= after + count; column += 1) {
        this.setValidationAt(row, column, allowedValues);
      }
    }
    this.mutations.push({ type: "insertColumnsAfter", count });
  }

  setFrozenRows(count) {
    this.frozenRows = count;
  }
}

class MockSpreadsheet {
  constructor(s5Headers = legacyHeaders) {
    this.accesses = [];
    this.insertions = [];
    this.sheets = new Map([
      ["PARTICIPANTES", new MockSheet("PARTICIPANTES", Array.from({ length: 8 }, (_, index) => `P${index + 1}`))],
      ["ASISTENCIA", new MockSheet("ASISTENCIA", Array.from({ length: 12 }, (_, index) => `A${index + 1}`))],
      ["NIVELACION", new MockSheet("NIVELACION", Array.from({ length: 18 }, (_, index) => `N${index + 1}`))],
      ["S4_EVIDENCIAS", new MockSheet("S4_EVIDENCIAS", ["SENTINELA_S4"])],
      ["S5_EVIDENCIAS", new MockSheet("S5_EVIDENCIAS", s5Headers)],
    ]);
  }

  getSheetByName(name) {
    this.accesses.push(name);
    return this.sheets.get(name) || null;
  }

  insertSheet(name) {
    this.insertions.push(name);
    const sheet = new MockSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

function payload(confirmationCode = "EV5-TEST-V1") {
  return {
    action: "s5_evidence",
    session: "S5",
    route: "principal",
    activity: "evidencia-principal",
    participantId: "PAR-S5-TEST",
    fullName: "Docente de prueba S5",
    email: "prueba.controlada.s5@example.invalid",
    product: "Instrumento y análisis S5",
    purpose: "Analizar evidencia agregada sin identificar estudiantes.",
    context: "Grupo hipotético y datos sintéticos para una práctica controlada.",
    sources: "Caso simulado AULA-IA",
    prompt: "Diseña un instrumento alineado y marca todo supuesto como propuesta.",
    result: "Borrador inicial del instrumento y de su lectura agregada.",
    teacherReview: "La persona docente contrasta los hallazgos y conserva la decisión final.",
    detectedRisk: "La muestra sintética no permite generalizar resultados.",
    adjustment: "Se agregó una limitación y una alternativa accesible.",
    status: "Recibida",
    confirmationCode,
    sequenceKey: "secuencia-s5-prueba",
    sequenceTitle: "Evaluación formativa con datos agregados",
    educationalLevel: "Media superior",
    subject: "Ciencias sociales",
    difficultyLevel: "intermedio",
    instrumentType: "Lista de cotejo",
    learningPurpose: "Interpretar evidencia agregada para decidir un siguiente paso docente.",
    pedagogicalContext: "Grupo hipotético de práctica sin datos personales.",
    sourceCase: "Caso sintético integrado en AULA-IA.",
    instrumentDesign: "Cinco criterios observables con opciones cumple, en proceso y requiere apoyo.",
    criteriaDescriptors: "Cada criterio describe una conducta observable y evita etiquetas personales.",
    aiDraft: "Borrador generado para revisión; no constituye una valoración definitiva.",
    datasetSummary: "12 respuestas sintéticas agregadas en tres categorías.",
    findings: "La categoría de argumentación requiere un apoyo adicional.",
    groupComparison: "Se comparan tendencias agregadas, no personas ni grupos reales.",
    teacherDecision: "Realizar una práctica guiada y volver a observar el mismo criterio.",
    limitations: "Datos sintéticos, muestra pequeña y ausencia de aplicación real.",
    adaptation: "Versión legible en móvil y alternativa oral sin IA.",
    checklistJson: { alineacion: true, privacidad: true, decision_docente: true },
    checklistAchieved: 3,
    checklistTotal: 3,
  };
}

async function harness(spreadsheet = new MockSpreadsheet()) {
  const script = await read("../google-apps-script/Code.gs");
  const secret = script.match(/const WEBHOOK_SECRET = '([^']+)'/)?.[1];
  assert.ok(secret);
  let uuid = 0;
  let acquired = 0;
  let released = 0;
  const context = {
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text) {
        return { text, setMimeType() { return this; } };
      },
    },
    LockService: {
      getScriptLock() {
        return {
          tryLock(milliseconds) {
            assert.equal(milliseconds, 30000);
            acquired += 1;
            return true;
          },
          releaseLock() { released += 1; },
        };
      },
    },
    SpreadsheetApp: { openById: () => spreadsheet, flush() {} },
    Utilities: { getUuid: () => `00000000-0000-0000-0000-${String(++uuid).padStart(12, "0")}` },
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return {
    spreadsheet,
    post(body) {
      const output = context.doPost({ postData: { contents: JSON.stringify({ ...body, secret }) } });
      return JSON.parse(output.text);
    },
    locks() { return { acquired, released }; },
  };
}

test("S5 expands only S5_EVIDENCIAS, preserves A:P and updates one idempotent row", async () => {
  const { spreadsheet, post, locks } = await harness();
  const s5 = spreadsheet.sheets.get("S5_EVIDENCIAS");
  const s4Before = structuredClone(spreadsheet.sheets.get("S4_EVIDENCIAS").rows);
  const participantsBefore = structuredClone(spreadsheet.sheets.get("PARTICIPANTES").rows);
  const attendanceBefore = structuredClone(spreadsheet.sheets.get("ASISTENCIA").rows);
  const levelingBefore = structuredClone(spreadsheet.sheets.get("NIVELACION").rows);

  assert.equal(post(payload()).ok, true);
  assert.deepEqual(s5.rows[0].slice(0, 16), legacyHeaders);
  assert.deepEqual(s5.rows[0].slice(16, 43), additionalHeaders);
  assert.equal(s5.getLastRow(), 2);
  assert.match(s5.valueAt(2, 1), /^S5E-/);
  assert.equal(s5.valueAt(2, 3), "prueba.controlada.s5@example.invalid");
  assert.equal(s5.valueAt(2, 17), "S5");
  assert.equal(s5.valueAt(2, 21), "secuencia-s5-prueba");
  assert.equal(s5.valueAt(2, 26), "Lista de cotejo");
  assert.equal(s5.valueAt(2, 39), JSON.stringify(payload().checklistJson));
  assert.equal(s5.valueAt(2, 42), 1);
  assert.equal(s5.valueAt(2, 43), 1);
  const originalId = s5.valueAt(2, 1);

  assert.equal(post(payload()).ok, true);
  assert.equal(s5.getLastRow(), 2);
  assert.equal(s5.valueAt(2, 42), 1);
  assert.equal(s5.valueAt(2, 43), 1);

  const revised = payload("EV5-TEST-V2");
  revised.findings = "La versión dos documenta un hallazgo revisado.";
  assert.equal(post(revised).ok, true);
  assert.equal(s5.getLastRow(), 2);
  assert.equal(s5.valueAt(2, 1), originalId);
  assert.equal(s5.valueAt(2, 15), "EV5-TEST-V2");
  assert.equal(s5.valueAt(2, 34), revised.findings);
  assert.equal(s5.valueAt(2, 42), 2);
  assert.equal(s5.valueAt(2, 43), 2);

  assert.deepEqual(spreadsheet.sheets.get("S4_EVIDENCIAS").rows, s4Before);
  assert.deepEqual(spreadsheet.sheets.get("PARTICIPANTES").rows, participantsBefore);
  assert.deepEqual(spreadsheet.sheets.get("ASISTENCIA").rows, attendanceBefore);
  assert.deepEqual(spreadsheet.sheets.get("NIVELACION").rows, levelingBefore);
  assert.deepEqual(spreadsheet.insertions, []);
  assert.deepEqual([...new Set(spreadsheet.accesses)], ["S5_EVIDENCIAS"]);
  assert.deepEqual(locks(), { acquired: 3, released: 3 });
});

test("S5 clears only validations inherited from ORIGEN in Q:AQ before writing", async () => {
  const spreadsheet = new MockSpreadsheet();
  const s5 = spreadsheet.sheets.get("S5_EVIDENCIAS");
  s5.maxColumns = 16;
  for (let row = 2; row <= s5.getMaxRows(); row += 1) {
    s5.setValidationAt(row, 16, ["Página"]);
  }

  const { post } = await harness(spreadsheet);
  assert.equal(post(payload()).ok, true);
  assert.equal(s5.getLastRow(), 2);
  assert.equal(s5.valueAt(2, 16), "Página");
  assert.equal(s5.valueAt(2, 17), "S5");
  assert.ok(s5.validationAt(2, 16)?.has("Página"));
  for (let column = 17; column <= 43; column += 1) {
    assert.equal(s5.validationAt(2, column), null);
  }
  assert.deepEqual(
    s5.mutations.filter(({ type }) => type === "clearDataValidations"),
    [{
      type: "clearDataValidations",
      row: 1,
      column: 17,
      rowCount: s5.getMaxRows(),
      columnCount: 27,
    }],
  );
});

test("S5 repairs inherited validations when AQ already exists without changing partial rows", async () => {
  const spreadsheet = new MockSpreadsheet([...legacyHeaders, ...additionalHeaders]);
  const s5 = spreadsheet.sheets.get("S5_EVIDENCIAS");
  const partialRows = Array.from({ length: 3 }, (_, index) => {
    const row = Array(16).fill("");
    row[0] = `S5E-PARTIAL-${index + 1}`;
    row[1] = `2026-08-11T10:0${index}:00.000Z`;
    row[2] = "prueba.controlada.s5@example.invalid";
    row[3] = "Docente de prueba S5";
    row[14] = "EV5-TEST-V1";
    row[15] = "Página";
    return row;
  });
  for (const row of partialRows) s5.rows.push(row.slice());
  for (let row = 2; row <= s5.getMaxRows(); row += 1) {
    s5.setValidationAt(row, 16, ["Página"]);
    for (let column = 17; column <= 43; column += 1) {
      s5.setValidationAt(row, column, ["Página"]);
    }
  }
  const partialRowsBefore = structuredClone(s5.rows.slice(1, 4));

  const { post } = await harness(spreadsheet);
  assert.equal(post(payload()).ok, true);
  assert.deepEqual(s5.rows.slice(1, 4), partialRowsBefore);
  assert.equal(s5.getLastRow(), 5);
  assert.equal(s5.valueAt(5, 16), "Página");
  assert.equal(s5.valueAt(5, 17), "S5");
  assert.ok(s5.validationAt(5, 16)?.has("Página"));
  for (let column = 17; column <= 43; column += 1) {
    assert.equal(s5.validationAt(5, column), null);
  }
  assert.deepEqual(
    s5.mutations.filter(({ type }) => type === "clearDataValidations"),
    [{
      type: "clearDataValidations",
      row: 1,
      column: 17,
      rowCount: s5.getMaxRows(),
      columnCount: 27,
    }],
  );
});

test("S5 rejects invalid control data before expanding the legacy sheet", async () => {
  const { spreadsheet, post, locks } = await harness();
  const s5 = spreadsheet.sheets.get("S5_EVIDENCIAS");
  const invalid = payload();
  delete invalid.confirmationCode;

  assert.equal(post(invalid).ok, false);
  assert.deepEqual(s5.rows, [legacyHeaders]);
  assert.deepEqual(s5.mutations, []);
  assert.deepEqual(spreadsheet.accesses, []);
  assert.deepEqual(locks(), { acquired: 1, released: 1 });
});

test("S5 stops on a changed legacy header or a formula in the append-only area", async () => {
  const changedPrefix = legacyHeaders.slice();
  changedPrefix[4] = "PRODUCTO_CAMBIADO";
  const changedHarness = await harness(new MockSpreadsheet(changedPrefix));
  const changedSheet = changedHarness.spreadsheet.sheets.get("S5_EVIDENCIAS");
  assert.equal(changedHarness.post(payload()).ok, false);
  assert.deepEqual(changedSheet.mutations, []);
  assert.equal(changedSheet.getLastRow(), 1);

  const formulaHarness = await harness();
  const formulaSheet = formulaHarness.spreadsheet.sheets.get("S5_EVIDENCIAS");
  formulaSheet.setFormulaAt(2, 17, "=ROW()", "");
  assert.equal(formulaHarness.post(payload()).ok, false);
  assert.deepEqual(formulaSheet.rows, [legacyHeaders]);
  assert.deepEqual(formulaSheet.mutations, []);
  assert.equal(formulaSheet.formulaAt(2, 17), "=ROW()");
});

test("S5 main attendance reuses only participant and attendance contracts", async () => {
  const { spreadsheet, post } = await harness();
  const s5Before = structuredClone(spreadsheet.sheets.get("S5_EVIDENCIAS").rows);
  const response = post({
    action: "s5_main_attendance",
    session: "S5",
    email: "asistencia.s5@example.invalid",
    fullName: "Asistencia sintética S5",
    institution: "Institución de prueba",
    role: "Docente",
    consent: true,
    confirmationCode: "AS5-TEST-V1",
  });

  assert.equal(response.ok, true);
  assert.equal(spreadsheet.sheets.get("PARTICIPANTES").getLastRow(), 2);
  assert.equal(spreadsheet.sheets.get("ASISTENCIA").getLastRow(), 2);
  assert.equal(spreadsheet.sheets.get("ASISTENCIA").valueAt(2, 3), "S5");
  assert.deepEqual(spreadsheet.sheets.get("S5_EVIDENCIAS").rows, s5Before);
  assert.deepEqual([...new Set(spreadsheet.accesses)], ["PARTICIPANTES", "ASISTENCIA"]);
});
