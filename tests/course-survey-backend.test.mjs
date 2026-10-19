import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("course survey migration is additive and preserves every prior table definition", async () => {
  const [migration, previousSnapshotText, currentSnapshotText] = await Promise.all([
    read("../drizzle/0006_light_the_call.sql"),
    read("../drizzle/meta/0005_snapshot.json"),
    read("../drizzle/meta/0006_snapshot.json"),
  ]);
  const previousSnapshot = JSON.parse(previousSnapshotText);
  const currentSnapshot = JSON.parse(currentSnapshotText);

  assert.match(migration, /^CREATE TABLE `course_satisfaction_survey_responses`/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX `course_satisfaction_survey_idempotency_unique` ON `course_satisfaction_survey_responses` \(`idempotency_key`\)/,
  );
  assert.doesNotMatch(migration, /\b(?:ALTER|DROP|DELETE|UPDATE|INSERT|REPLACE)\b/i);
  assert.equal((migration.match(/\bCREATE TABLE\b/g) || []).length, 1);

  for (const [tableName, definition] of Object.entries(previousSnapshot.tables)) {
    assert.deepEqual(
      currentSnapshot.tables[tableName],
      definition,
      `the prior table ${tableName} must remain byte-equivalent in the Drizzle snapshot`,
    );
  }
  assert.deepEqual(
    Object.keys(currentSnapshot.tables).sort(),
    [...Object.keys(previousSnapshot.tables), "course_satisfaction_survey_responses"].sort(),
  );
});

test("course survey migration executes independently and enforces one row per idempotency key", async () => {
  const migration = await read("../drizzle/0006_light_the_call.sql");
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE historical_records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
  database.prepare("INSERT INTO historical_records (id, value) VALUES (?, ?)").run(1, "intacto");

  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) database.exec(sql);
  }

  assert.deepEqual(
    database
      .prepare("SELECT * FROM historical_records")
      .all()
      .map((row) => ({ ...row })),
    [{ id: 1, value: "intacto" }],
  );
  const columns = database
    .prepare("PRAGMA table_info(course_satisfaction_survey_responses)")
    .all()
    .map(({ name }) => name);
  assert.deepEqual(columns, [
    "id",
    "idempotency_key",
    "is_anonymous",
    "name",
    "email",
    "general_rating",
    "content_rating",
    "instructor_rating",
    "platform_rating",
    "activities_rating",
    "materials_rating",
    "materials_not_used",
    "recommendation_application",
    "liked_most",
    "improvements",
    "additional_comments",
    "reference_code",
    "created_at",
  ]);

  const insert = database.prepare(`
    INSERT INTO course_satisfaction_survey_responses (
      idempotency_key, general_rating, content_rating,
      instructor_rating, platform_rating, reference_code
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run("test-key-0001", 5, 4, 5, 4, "SURV-TEST-0001");
  const savedRow = database
    .prepare(`
      SELECT is_anonymous, name, email, activities_rating, materials_rating,
             materials_not_used, recommendation_application, liked_most,
             improvements, additional_comments
      FROM course_satisfaction_survey_responses
    `)
    .get();
  const saved = { ...savedRow };
  assert.deepEqual(saved, {
    is_anonymous: 1,
    name: "",
    email: "",
    activities_rating: null,
    materials_rating: null,
    materials_not_used: 0,
    recommendation_application: "",
    liked_most: "",
    improvements: "",
    additional_comments: "",
  });
  assert.throws(
    () => insert.run("test-key-0001", 1, 1, 1, 1, "SURV-TEST-0002"),
    /UNIQUE constraint failed/,
  );
  database.close();
});

test("course survey API exposes only its contract and never a public response listing", async () => {
  const route = await read("../app/api/course-survey/route.ts");
  const getBlock = route.slice(
    route.indexOf("export async function GET()"),
    route.indexOf("export async function POST(request: Request)"),
  );

  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:PUT|PATCH|DELETE)/);
  assert.match(route, /action: "submit"/);
  assert.match(route, /requiredFields: \[\s*"generalRating",\s*"contentRating",\s*"instructorRating",\s*"platformRating",\s*\]/s);
  assert.match(route, /privacy: "Las respuestas pueden ser anónimas y se analizarán de forma agregada\."/);
  assert.match(route, /if \(!sameOrigin\(request\)\)/);
  assert.match(route, /startsWith\("application\/json"\)/);
  assert.doesNotMatch(getBlock, /\.select\(\)|select\(\*|allResponses|exportResponses|downloadResponses/i);
  assert.doesNotMatch(route, /export async function (?:PUT|PATCH|DELETE)/);
});

test("course survey requires only four ratings and validates a supplied email", async () => {
  const route = await read("../app/api/course-survey/route.ts");

  for (const field of [
    "generalRating",
    "contentRating",
    "instructorRating",
    "platformRating",
  ]) {
    assert.match(route, new RegExp(`\\["${field}",`));
  }
  assert.match(route, /const activitiesRating =\s*typeof requestedActivitiesRating === "number"[\s\S]*?: null;/);
  assert.match(route, /const materialsRating =\s*!materialsNotUsed[\s\S]*?: null;/);
  assert.match(route, /const recommendationApplication = recommendationValues\.has\(requestedRecommendation\)[\s\S]*?: "";/);
  assert.match(route, /if \(email && !emailPattern\.test\(email\)\)/);
  assert.match(route, /field: "email",\s*message: "Escribe un correo válido o deja este campo vacío\."/s);
  assert.doesNotMatch(route, /issues\.push\(\{\s*field: "(?:activitiesRating|materialsRating|recommendationApplication)"/s);
});

test("course survey stores once in Sheets and returns the persisted folio on duplicate delivery", async () => {
  const route = await read("../app/api/course-survey/route.ts");

  assert.match(route, /const idempotencyKeyPattern = \/\^\[A-Za-z0-9\._:-\]\{8,160\}\$\//);
  assert.match(route, /await db\.insertIfAbsent\(\s*courseSatisfactionSurveyResponses,/s);
  assert.match(route, /const idempotent = !inserted/);
  assert.match(route, /referenceCode: saved\.referenceCode/);
  assert.match(route, /idempotent \? 200 : 201/);
  assert.match(route, /sheetSync: "synced"/);
  assert.doesNotMatch(route, /onConflictDoUpdate|\.update\(|\.delete\(|courseSatisfactionSurveySync|syncToInstitutionalSheet/);
  assert.match(route, /return `SURV-\$\{stamp\}-\$\{random\}`/);
});
