import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

async function analyticsModule() {
  const source = await readFile(
    new URL("../app/course-survey-analytics.ts", import.meta.url),
    "utf8",
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

test("course survey analytics has an honest professional empty state", async () => {
  const { computeCourseSurveyAnalytics } = await analyticsModule();
  const result = computeCourseSurveyAnalytics([]);

  assert.equal(result.empty, true);
  assert.equal(result.totalResponses, 0);
  assert.equal(result.overallAverage, null);
  assert.equal(result.overallDenominator, 0);
  assert.equal(result.bestDimension, null);
  assert.equal(result.improvementOpportunity, null);
  assert.deepEqual(
    result.dimensions.map(({ average, denominator }) => ({ average, denominator })),
    Array.from({ length: 6 }, () => ({ average: null, denominator: 0 })),
  );
  assert.deepEqual(result.generalDistribution, {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  });
  assert.deepEqual(result.materialsNotUsed, {
    count: 0,
    denominator: 0,
    proportion: null,
  });
  assert.equal(result.synchronization.state, "empty");
});

test("analytics endpoint selects only non-identifiable D1 fields", async () => {
  const route = await read("../app/api/course-survey-analytics/route.ts");
  const selectStart = route.indexOf(".select({");
  const selectEnd = route.indexOf("})", selectStart);
  const selectedFields = route.slice(selectStart, selectEnd);

  assert.match(route, /export async function GET\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
  assert.match(route, /\.from\(courseSatisfactionSurveyResponses\)/);
  assert.match(route, /\.leftJoin\(\s*courseSatisfactionSurveySync,/s);
  assert.match(route, /computeCourseSurveyAnalytics/);
  assert.match(route, /"Cache-Control": "no-store, private"/);
  assert.match(route, /No se muestran cifras parciales/);
  assert.match(route, /searchParams\.get\("format"\) === "csv"/);
  assert.match(route, /"Content-Type": "text\/csv; charset=utf-8"/);
  for (const field of [
    "generalRating",
    "contentRating",
    "instructorRating",
    "platformRating",
    "activitiesRating",
    "materialsRating",
    "materialsNotUsed",
    "recommendationApplication",
    "sheetSyncStatus",
  ]) {
    assert.match(selectedFields, new RegExp(`\\b${field}\\b`));
  }
  for (const privateField of [
    "name",
    "email",
    "likedMost",
    "improvements",
    "additionalComments",
    "referenceCode",
  ]) {
    assert.doesNotMatch(selectedFields, new RegExp(`\\b${privateField}\\b`));
  }
});

test("CSV contract is stable, empty-safe and contains no response text or identity", async () => {
  const { computeCourseSurveyAnalytics, courseSurveyAnalyticsCsv } =
    await analyticsModule();
  const csv = courseSurveyAnalyticsCsv(computeCourseSurveyAnalytics([]));
  const lines = csv.trim().split("\r\n");

  assert.equal(
    lines[0],
    '"metric","label","value","denominator","proportion","note"',
  );
  for (const metric of [
    "total_responses",
    "survey_state",
    "overall_average",
    "dimension_general",
    "dimension_contents",
    "dimension_instructor",
    "dimension_platform",
    "dimension_activities",
    "dimension_materials",
    "general_rating_1",
    "general_rating_5",
    "recommendation_definitely_yes",
    "recommendation_unanswered",
    "materials_not_used",
    "best_dimension",
    "improvement_opportunity",
    "sync_total",
    "sync_synced",
    "sync_pending",
    "sync_failed",
    "sync_state",
  ]) {
    assert.match(csv, new RegExp(`"${metric}"`));
  }
  assert.match(csv, /"survey_state","Estado de la encuesta","empty","0","","Sin respuestas todavía"/);
  assert.match(csv, /"dimension_materials","Materiales","","0","","Excluye No los utilicé \/ No aplica"/);
  assert.doesNotMatch(
    csv,
    /correo|nombre|comentario|liked_most|additional_comments|reference_code|folio/i,
  );
});

test("course survey analytics excludes materials N-A and calculates every requested metric", async () => {
  const { computeCourseSurveyAnalytics } = await analyticsModule();
  const result = computeCourseSurveyAnalytics([
    {
      generalRating: 5,
      contentRating: 5,
      instructorRating: 4,
      platformRating: 5,
      activitiesRating: 4,
      materialsRating: null,
      materialsNotUsed: true,
      recommendationApplication: "definitely_yes",
      sheetSyncStatus: "synced",
    },
    {
      generalRating: 4,
      contentRating: 4,
      instructorRating: 5,
      platformRating: 4,
      activitiesRating: 3,
      materialsRating: 4,
      materialsNotUsed: false,
      recommendationApplication: "probably_yes",
      sheetSyncStatus: "failed",
    },
    {
      generalRating: 1,
      contentRating: 2,
      instructorRating: 3,
      platformRating: 2,
      activitiesRating: null,
      materialsRating: 2,
      materialsNotUsed: false,
      recommendationApplication: "",
      sheetSyncStatus: "pending",
    },
    {
      generalRating: 4,
      contentRating: 4,
      instructorRating: 4,
      platformRating: 4,
      activitiesRating: 5,
      materialsRating: 3,
      materialsNotUsed: false,
      recommendationApplication: "definitely_yes",
      sheetSyncStatus: "pending",
    },
  ]);

  assert.equal(result.empty, false);
  assert.equal(result.totalResponses, 4);
  assert.equal(result.overallAverage, 3.5);
  assert.equal(result.overallDenominator, 4);
  assert.deepEqual(
    result.dimensions.map(({ key, average, denominator }) => ({
      key,
      average,
      denominator,
    })),
    [
      { key: "general", average: 3.5, denominator: 4 },
      { key: "contents", average: 3.75, denominator: 4 },
      { key: "instructor", average: 4, denominator: 4 },
      { key: "platform", average: 3.75, denominator: 4 },
      { key: "activities", average: 4, denominator: 3 },
      { key: "materials", average: 3, denominator: 3 },
    ],
  );
  assert.equal(result.bestDimension.key, "instructor");
  assert.equal(result.improvementOpportunity.key, "materials");
  assert.deepEqual(result.generalDistribution, {
    "1": 1,
    "2": 0,
    "3": 0,
    "4": 2,
    "5": 1,
  });
  assert.equal(result.recommendation.answered, 3);
  assert.equal(result.recommendation.unanswered, 1);
  assert.deepEqual(
    result.recommendation.options.slice(0, 2).map(({ count, proportion }) => ({
      count,
      proportion,
    })),
    [
      { count: 2, proportion: 0.67 },
      { count: 1, proportion: 0.33 },
    ],
  );
  assert.deepEqual(result.materialsNotUsed, {
    count: 1,
    denominator: 4,
    proportion: 0.25,
  });
  assert.deepEqual(result.synchronization, {
    synced: 1,
    pending: 2,
    failed: 1,
    total: 4,
    state: "requires_attention",
  });
});

test("best and improvement dimensions use a stable pedagogical order on ties", async () => {
  const { computeCourseSurveyAnalytics } = await analyticsModule();
  const result = computeCourseSurveyAnalytics([
    {
      generalRating: 4,
      contentRating: 4,
      instructorRating: 4,
      platformRating: 4,
      activitiesRating: 4,
      materialsRating: 4,
      materialsNotUsed: false,
      recommendationApplication: "",
      sheetSyncStatus: "synced",
    },
  ]);

  assert.equal(result.bestDimension.key, "general");
  assert.equal(result.improvementOpportunity.key, "general");
});
