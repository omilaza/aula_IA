import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
let harnessId = 0;

function moduleUrl(source) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });
  assert.deepEqual(result.diagnostics, []);
  return `data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`;
}

async function routeModule(t, path, repository, dependencies = {}) {
  const key = `__aulaSheetsApiTest${harnessId++}`;
  globalThis[key] = repository;
  t.after(() => { delete globalThis[key]; });
  let source = (await read(path)).replace(
    'import { getDb } from "../../../db";',
    `const getDb = () => globalThis[${JSON.stringify(key)}];`,
  );
  source = source.replace(
    /import \{([^}]+)\} from "\.\.\/\.\.\/\.\.\/db\/schema";/,
    (_, imports) => imports.split(",").map((name) => name.trim()).filter(Boolean)
      .map((name) => `const ${name} = ${JSON.stringify(name)};`).join("\n"),
  );
  for (const [specifier, replacement] of Object.entries(dependencies)) {
    source = source.replace(JSON.stringify(specifier), JSON.stringify(replacement));
  }
  return import(moduleUrl(source));
}

const validSurvey = {
  action: "submit",
  idempotencyKey: "survey-test-key-0001",
  generalRating: 5,
  contentRating: 4,
  instructorRating: 5,
  platformRating: 4,
};

function surveyRequest(body, headers = {}) {
  return new Request("https://aula.example/api/course-survey", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://aula.example", ...headers },
    body: JSON.stringify(body),
  });
}

test("Sheets survey validates origin, content type, required ratings and optional identity before storing", async (t) => {
  let writes = 0;
  const { GET, POST } = await routeModule(t, "../app/api/course-survey/route.ts", {
    async insertIfAbsent() { writes++; throw new Error("Must not write invalid submissions"); },
  });
  assert.equal((await GET()).status, 200);
  assert.equal((await POST(surveyRequest(validSurvey, { Origin: "https://other.example" }))).status, 403);
  assert.equal((await POST(surveyRequest(validSurvey, { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await POST(surveyRequest(validSurvey, { "Content-Length": "80001" }))).status, 413);
  for (const field of ["generalRating", "contentRating", "instructorRating", "platformRating"]) {
    for (const invalid of [null, 0, 6, 1.5, "5"]) {
      const response = await POST(surveyRequest({ ...validSurvey, [field]: invalid }));
      assert.equal(response.status, 400, `${field} must reject ${invalid}`);
      assert.ok((await response.json()).fields.includes(field));
    }
  }
  assert.equal((await POST(surveyRequest({ ...validSurvey, email: "invalid-address" }))).status, 400);
  assert.equal((await POST(surveyRequest({ ...validSurvey, idempotencyKey: "bad" }))).status, 400);
  assert.equal(writes, 0);
});

test("Sheets survey concurrent retries preserve the first folio and response with anonymous nullable defaults", async (t) => {
  const saved = new Map();
  const { POST } = await routeModule(t, "../app/api/course-survey/route.ts", {
    async insertIfAbsent(table, values) {
      assert.equal(table, "courseSatisfactionSurveyResponses");
      if (saved.has(values.idempotencyKey)) return { row: saved.get(values.idempotencyKey), inserted: false };
      const row = { ...values, id: saved.size + 1, createdAt: "2026-10-19T00:00:00Z" };
      saved.set(values.idempotencyKey, row);
      return { row, inserted: true };
    },
  });
  const responses = await Promise.all([
    POST(surveyRequest({ ...validSurvey, materialsNotUsed: true, materialsRating: 5 })),
    POST(surveyRequest({ ...validSurvey, generalRating: 1 })),
  ]);
  assert.deepEqual(responses.map(({ status }) => status), [201, 200]);
  const [first, duplicate] = await Promise.all(responses.map((response) => response.json()));
  assert.equal(first.sheetSync, "synced");
  assert.equal(duplicate.sheetSync, "synced");
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.referenceCode, first.referenceCode);
  assert.match(first.referenceCode, /^SURV-/);
  assert.equal(saved.size, 1);
  const row = saved.get(validSurvey.idempotencyKey);
  assert.equal(row.generalRating, 5);
  assert.equal(row.isAnonymous, true);
  assert.equal(row.name, "");
  assert.equal(row.email, "");
  assert.equal(row.activitiesRating, null);
  assert.equal(row.materialsRating, null);
  assert.equal(row.materialsNotUsed, true);
});

test("Sheets survey never claims success on failure and recovers the committed folio after a lost acknowledgment", async (t) => {
  let row;
  let failBeforeWrite = true;
  const { POST } = await routeModule(t, "../app/api/course-survey/route.ts", {
    async insertIfAbsent(_table, values) {
      if (failBeforeWrite) throw new Error("Unavailable before save");
      if (row) return { row, inserted: false };
      row = { ...values, id: 1, createdAt: "2026-10-19T00:00:00Z" };
      throw new Error("Acknowledgment lost after save");
    },
  });
  for (const beforeWrite of [true, false]) {
    failBeforeWrite = beforeWrite;
    const response = await POST(surveyRequest(validSurvey));
    assert.equal(response.status, 500);
    const failure = await response.json();
    assert.equal(failure.ok, undefined);
    assert.equal(failure.sheetSync, undefined);
    assert.equal(failure.referenceCode, undefined);
    assert.equal(typeof failure.error, "string");
  }
  const response = await POST(surveyRequest({ ...validSurvey, generalRating: 1 }));
  assert.equal(response.status, 200);
  const recovered = await response.json();
  assert.equal(recovered.referenceCode, row.referenceCode);
  assert.equal(recovered.idempotent, true);
  assert.equal(row.generalRating, 5);
});

test("Sheets analytics requests only non-identifying columns and returns aggregates, CSV and an honest failure", async (t) => {
  const columns = [
    "generalRating", "contentRating", "instructorRating", "platformRating",
    "activitiesRating", "materialsRating", "materialsNotUsed", "recommendationApplication",
  ];
  let failReads = false;
  const { GET } = await routeModule(t, "../app/api/course-survey-analytics/route.ts", {
    async find(table, filters, options) {
      assert.equal(table, "courseSatisfactionSurveyResponses");
      assert.deepEqual(filters, {});
      assert.deepEqual(options.columns, columns);
      if (failReads) throw new Error("Sheets unavailable");
      return [5, 3].map((generalRating) => ({
        generalRating, contentRating: 4, instructorRating: 5, platformRating: 4,
        activitiesRating: null, materialsRating: null, materialsNotUsed: true,
        recommendationApplication: "definitely_yes",
      }));
    },
  }, { "../../course-survey-analytics": moduleUrl(await read("../app/course-survey-analytics.ts")) });
  const response = await GET(new Request("https://aula.example/api/course-survey-analytics"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  const body = await response.json();
  assert.equal(body.totalResponses, 2);
  assert.equal(body.overallAverage, 4);
  assert.deepEqual(body.synchronization, { synced: 2, pending: 0, failed: 0, total: 2, state: "synced" });
  for (const privateField of ["name", "email", "referenceCode", "likedMost", "improvements", "additionalComments"]) {
    assert.equal(columns.includes(privateField), false);
    assert.equal(Object.hasOwn(body, privateField), false);
  }
  const csv = await GET(new Request("https://aula.example/api/course-survey-analytics?format=csv"));
  assert.equal(csv.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(await csv.text(), /total_responses/);
  failReads = true;
  const unavailable = await GET(new Request("https://aula.example/api/course-survey-analytics"));
  assert.equal(unavailable.status, 503);
  const error = await unavailable.json();
  assert.equal(error.ok, false);
  assert.equal(error.totalResponses, undefined);
});

async function pdfHarness(t) {
  const serverUrl = moduleUrl((await read("../app/evidence-pdf-server.ts")).replace(
    'import { env } from "cloudflare:workers";',
    'const env = { PDF_EXPORT_SECRET: "test-only-pdf-signing-key-01234567890123456789" };',
  ));
  const state = { missing: false, unavailable: false, confirmationCode: "EVIDENCE-1", calls: [] };
  const route = await routeModule(t, "../app/api/evidence-pdf/route.ts", {
    async find(table, filters, options) {
      state.calls.push({ table, filters, options });
      if (state.unavailable) throw new Error("Sheets unavailable");
      if (state.missing) return [];
      return [{
        id: 1, email: "docente@example.mx", fullName: "Docente", institution: "CBTis", role: "docente",
        evidenceCode: state.confirmationCode, confirmationCode: state.confirmationCode,
        createdAt: "2026-10-19T00:00:00Z", updatedAt: "2026-10-19T00:00:00Z",
        contextJson: "{}", checklistJson: "{}", responseJson: "{}",
      }];
    },
  }, { "../../evidence-pdf-server": serverUrl });
  return { ...route, ...await import(serverUrl), state };
}

test("Sheets PDF loaders isolate session, principal/preparation route and exact email, and select the latest S6 record", async (t) => {
  const { loadEvidenceDocument, state } = await pdfHarness(t);
  for (const session of ["S1", "S2", "S3", "S4", "S5P", "S5", "S6"]) {
    state.calls.length = 0;
    const document = await loadEvidenceDocument(session, "docente@example.mx");
    assert.equal(document.session, session);
    assert.equal(document.confirmationCode, "EVIDENCE-1");
    for (const query of state.calls) {
      assert.equal(query.filters.email, "docente@example.mx");
      assert.equal(query.options.limit, 1);
    }
    const query = state.calls[0];
    if (["S2", "S3", "S4", "S5"].includes(session)) {
      assert.deepEqual(query.filters, { email: "docente@example.mx", session, route: "principal", activity: "evidencia-principal" });
    }
    if (session === "S5P") {
      assert.equal(query.table, "levelingRecords");
      assert.deepEqual(query.filters, { email: "docente@example.mx", session: "S5", route: "preparatoria", activity: "nivelacion-instrumentos" });
    }
    if (session === "S6") {
      assert.deepEqual(query.options, { orderBy: "updatedAt", descending: true, limit: 1 });
    }
  }
});

test("Sheets PDF retrieval requires the current HMAC and emits a private PDF only after a successful read", async (t) => {
  const { POST, createPdfAccessCode, state } = await pdfHarness(t);
  const code = await createPdfAccessCode("S2", "docente@example.mx", "EVIDENCE-1");
  const request = (credential = code, email = "Docente@example.mx") => new Request("https://aula.example/api/evidence-pdf", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session: "S2", email, code: credential }),
  });
  const valid = await POST(request());
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("content-type"), "application/pdf");
  assert.equal(valid.headers.get("cache-control"), "private, no-store");
  assert.equal(valid.headers.get("referrer-policy"), "no-referrer");
  assert.match(Buffer.from(await valid.arrayBuffer()).toString("latin1"), /^%PDF-/);
  assert.equal((await POST(request(`PDF2-${"a".repeat(43)}`))).status, 403);
  assert.equal((await POST(request(code, "otro@example.mx"))).status, 403);
  state.confirmationCode = "EVIDENCE-UPDATED";
  assert.equal((await POST(request())).status, 403);
  state.confirmationCode = "EVIDENCE-1";
  state.missing = true;
  assert.equal((await POST(request())).status, 403);
  state.missing = false;
  state.unavailable = true;
  assert.equal((await POST(request())).status, 500);
});
