// The retired mirror/outbox protocol is replaced by the primary Sheets contract.
// API retry/no-false-success coverage lives in sheets-api.test.mjs; receiver RAW
// formula safety, legacy-tab isolation and idempotency live in sheets-storage-receiver.test.mjs.
// Historical migrations remain checked because existing exports may contain them.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function executeMigration(database, migration) {
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) database.exec(sql);
  }
}

test("the historical survey outbox migration is additive and preserves existing responses", async () => {
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

test("primary Sheets survey schema preserves optional answers, anonymity and one row per submission", async () => {
  const schema = JSON.parse(await read("../google-apps-script/schema.json"));
  const survey = schema.course_satisfaction_survey_responses;
  assert.equal(survey.tab, "APP_SATISFACCION");
  assert.deepEqual(survey.unique, ["idempotencyKey"]);
  assert.equal(survey.defaults.isAnonymous, true);
  assert.equal(survey.defaults.name, "");
  assert.equal(survey.defaults.email, "");
  assert.equal(survey.defaults.activitiesRating, null);
  assert.equal(survey.defaults.materialsRating, null);
  assert.equal(survey.defaults.materialsNotUsed, false);
  for (const field of ["generalRating", "contentRating", "instructorRating", "platformRating", "referenceCode", "idempotencyKey"]) {
    assert.ok(survey.required.includes(field));
  }
  for (const field of ["likedMost", "improvements", "additionalComments", "recommendationApplication"]) {
    assert.equal(survey.types[field], "string");
    assert.equal(survey.defaults[field], "");
  }
  assert.equal(Object.hasOwn(schema, "course_satisfaction_survey_sync"), false);
});
