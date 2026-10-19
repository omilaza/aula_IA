import { writeFile, mkdir } from "node:fs/promises";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import * as tables from "../db/schema.ts";

const tabs = {
  attendance: "APP_ASISTENCIA", diagnostics: "APP_CUESTIONARIOS",
  icebreakerResponses: "APP_ROMPEHIELO", labEvidence: "APP_LABORATORIO_S1",
  exitTickets: "APP_SALIDA_S1", digitalSkillDiagnostics: "APP_DIAGNOSTICO_DIGITAL",
  levelingRecords: "APP_NIVELACION", sessionTwoEvidence: "APP_EVIDENCIAS_S2",
  sessionThreeEvidence: "APP_EVIDENCIAS_S3", sessionFourEvidence: "APP_EVIDENCIAS_S4",
  sessionFiveEvidence: "APP_EVIDENCIAS_S5", sessionSixEvidence: "APP_EVIDENCIAS_S6",
  courseSatisfactionSurveyResponses: "APP_SATISFACCION",
};
const manifest = {};
const dialect = new SQLiteSyncDialect();
for (const [key, tab] of Object.entries(tabs)) {
  const table = tables[key];
  const columns = getTableColumns(table);
  const names = new Map(Object.entries(columns).map(([key, value]) => [value.name, key]));
  const defaults = {};
  for (const [key, column] of Object.entries(columns)) {
    if (column.default !== undefined) {
      if (column.default instanceof SQL) {
        if (dialect.sqlToQuery(column.default).sql !== "CURRENT_TIMESTAMP") throw new Error("Unsupported default");
        defaults[key] = { op: "timestamp" };
      } else defaults[key] = column.default;
    } else if (!column.notNull) defaults[key] = null;
  }
  manifest[getTableName(table)] = {
    tab, columns: Object.keys(columns),
    types: Object.fromEntries(Object.entries(columns).map(([key, value]) => [key, value.dataType])),
    defaults,
    required: Object.entries(columns).filter(([key, value]) => value.notNull && key !== "id").map(([key]) => key),
    unique: getTableConfig(table).indexes.find((index) => index.config.unique)?.config.columns.map((column) => names.get(column.name)) || [],
  };
}
const root = new URL("../google-apps-script/", import.meta.url);
await mkdir(root, { recursive: true });
await writeFile(new URL("schema.json", root), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(new URL("Schema.gs", root), `// Generated from db/schema.ts. Run npm run sheets:schema after schema changes.\nvar AULA_SCHEMA = ${JSON.stringify(manifest, null, 2)};\n`);
console.log(`Generated ${Object.keys(manifest).length} Sheets tables.`);
