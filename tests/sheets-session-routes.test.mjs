import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
const require = createRequire(import.meta.url);
const currentTimestamp = { op: "timestamp" };
const person = {
  fullName: "Docente Ejemplo",
  email: "DOCENTE@example.test",
  institution: "Plantel",
  role: "Docente",
  consent: true,
};

// Run the real handlers and validation helpers with only storage and PDF signing
// replaced. No Google account, network request, or real participant data is used.
function loadRoute(session, repository) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = readFileSync(file, "utf8");
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    assert.equal(parsed.parseDiagnostics.length, 0, `Invalid TypeScript: ${file}`);
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(file, module);
    const customRequire = (specifier) => {
      const resolved = resolve(dirname(file), specifier);
      if (resolved === `${root}/db`) {
        return {
          getDb: () => repository,
          increment: (value) => ({ op: "increment", value }),
          currentTimestamp,
        };
      }
      if (resolved === `${root}/db/schema`) {
        return new Proxy({}, { get: (_, key) => String(key) });
      }
      if (resolved === `${root}/app/evidence-pdf-server`) {
        return { createPdfAccessCode: async () => "verified-pdf-token" };
      }
      if (specifier.startsWith(".")) return load(`${resolved}.ts`);
      return require(specifier);
    };
    vm.runInNewContext(compiled, {
      module, exports: module.exports, require: customRequire,
      Request, Response, URL, crypto: webcrypto, console,
      Error, Date, JSON, Object, Set, Number, String, Boolean, Math,
    }, { filename: file });
    return module.exports;
  }
  return load(`${root}/app/api/session-${session}/route.ts`);
}

function mockRepository({ existing = false, failWrites = false } = {}) {
  const writes = [];
  const repository = {
    writes,
    find: async () => existing
      ? [{ id: 1, participantId: "PAR-EXISTING", fullName: person.fullName }]
      : [],
    upsert: async (...args) => {
      if (failWrites) throw new Error("Google Sheets unavailable");
      writes.push(args);
      return args[1];
    },
    insert: async (...args) => {
      if (failWrites) throw new Error("Google Sheets unavailable");
      writes.push(args);
      return args[1];
    },
    countBy: async () => [
      { category: "planeacion", count: 3 },
      { category: "evaluacion", count: 2 },
    ],
  };
  return repository;
}

const request = (payload) => new Request("https://example.test/api", {
  method: "POST",
  body: JSON.stringify(payload),
  headers: { "content-type": "application/json" },
});

for (const [index, session] of ["one", "two", "three", "four", "five", "six"].entries()) {
  const label = `Session ${index + 1}`;
  const action = index === 0 || index === 5 ? "attendance" : `s${index + 1}_main_attendance`;

  test(`${label} confirms attendance only after one successful Sheets write`, async () => {
    const db = mockRepository();
    const route = loadRoute(session, db);
    const response = await route.POST(request({ ...person, action }));
    const result = await response.json();
    assert.equal(response.status, 201);
    assert.equal(result.ok, true);
    assert.equal(result.sheetSync, "synced");
    assert.equal(db.writes.length, 1);
    assert.equal(db.writes[0][0], "attendance");
    assert.equal(db.writes[0][1].email, "docente@example.test");
    assert.equal(db.writes[0][2].createdAt, currentTimestamp);
  });

  test(`${label} never reports a stored record when Google Sheets fails`, async () => {
    const db = mockRepository({ failWrites: true });
    const route = loadRoute(session, db);
    const response = await route.POST(request({ ...person, action }));
    const result = await response.json();
    assert.equal(response.status, 500);
    assert.equal(result.ok, undefined);
    assert.equal(result.sheetSync, undefined);
    assert.equal(typeof result.error, "string");
    assert.equal(db.writes.length, 0);
  });

  test(`${label} rejects invalid attendance before attempting a write`, async () => {
    const db = mockRepository();
    const route = loadRoute(session, db);
    const response = await route.POST(request({ ...person, email: "invalid", action }));
    assert.equal(response.status, 400);
    assert.equal(db.writes.length, 0);
  });

  if (index > 0 && index < 5) {
    test(`${label} updates a preparation registration with its existing participant identity`, async () => {
      const db = mockRepository({ existing: true });
      const route = loadRoute(session, db);
      const response = await route.POST(request({ ...person, action: "leveling_attendance" }));
      const result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(result.sheetSync, "synced");
      assert.equal(result.updatedPreviousResponse, true);
      assert.equal(db.writes.length, 1);
      assert.equal(db.writes[0][0], "levelingRecords");
      assert.equal(db.writes[0][1].participantId, "PAR-EXISTING");
      assert.equal(db.writes[0][2].attempt.op, "increment");
      assert.equal(db.writes[0][2].attempt.value, 1);
      assert.equal(db.writes[0][2].responseVersion.value, 1);
    });
  }
}

test("Session 1 reports the aggregate icebreaker counts from Sheets", async () => {
  const route = loadRoute("one", mockRepository());
  const response = await route.GET(new Request("https://example.test/api?view=icebreaker"));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.total, 5);
  assert.equal(result.counts.planeacion, 3);
  assert.equal(result.counts.evaluacion, 2);
});

test("Session 1 stores an anonymous icebreaker with one write", async () => {
  const db = mockRepository();
  const route = loadRoute("one", db);
  const response = await route.POST(request({
    action: "icebreaker", category: "planeacion", task: "Planificar clases",
  }));
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.sheetSync, "synced");
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0][0], "icebreakerResponses");
  assert.equal(db.writes[0][1].category, "planeacion");
  assert.equal(db.writes[0][1].task, "Planificar clases");
});

test("Session 1 preserves questionnaire scoring and the stored scaled average", async () => {
  const db = mockRepository();
  const route = loadRoute("one", db);
  const answers = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`D${i + 1}`, 4]));
  Object.assign(answers, { D7: "B", D8: "C", D9: "B", D10: "A", D11: "C", D12: "D" });
  const response = await route.POST(request({ action: "diagnostic", email: person.email, answers }));
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.sheetSync, "synced");
  assert.equal(result.knowledgeScore, 6);
  assert.equal(result.likertAverage, 4);
  assert.equal(db.writes[0][0], "diagnostics");
  assert.equal(db.writes[0][1].knowledgeScore, 6);
  assert.equal(db.writes[0][1].likertAverage, 400);
  assert.deepEqual(JSON.parse(db.writes[0][1].answersJson), answers);
});

test("Session 2 preserves digital questionnaire scoring on a repeated submission", async () => {
  const db = mockRepository({ existing: true });
  const route = loadRoute("two", db);
  const answers = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`H${i + 1}`, i === 12 ? "no" : "si"]));
  const response = await route.POST(request({ ...person, action: "digital_diagnostic", answers }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.sheetSync, "synced");
  assert.equal(result.identifiedLevel, "suficiente");
  assert.equal(db.writes[0][0], "digitalSkillDiagnostics");
  assert.equal(db.writes[0][1].digitalScore, 26);
  assert.equal(db.writes[0][1].participantId, "PAR-EXISTING");
});

test("Session 6 stores every final evidence field before returning a PDF credential", async () => {
  const db = mockRepository({ existing: true });
  const route = loadRoute("six", db);
  const info = await (await route.GET()).json();
  const fields = [
    "projectTitle", "teachingNeed", "educationalLevel", "subject", "pedagogicalContext",
    "learningPurpose", "sourceTraceability", "prompt", "activitySequence", "assessmentEvidence",
    "instrumentCriteria", "analysisLimits", "teacherDecision", "followUpEvidence", "adaptation",
    "aiContribution", "teacherReview", "implementationStep",
  ];
  const evidence = Object.fromEntries(fields.map((key) => [key, `Contenido docente: ${key}.`]));
  const checklist = Object.fromEntries(info.checklistItems.map(({ key }) => [key, true]));
  const response = await route.POST(request({
    ...person, action: "evidence", route: "basica", ...evidence, checklist,
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.sheetSync, "synced");
  assert.equal(result.pdfAccessCode, "verified-pdf-token");
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0][0], "sessionSixEvidence");
  for (const field of fields) {
    assert.equal(db.writes[0][1][field], evidence[field]);
    assert.equal(db.writes[0][2][field], evidence[field]);
  }
  assert.deepEqual(JSON.parse(db.writes[0][1].checklistJson), checklist);
  assert.equal(db.writes[0][2].attempt.value, 1);
  assert.equal(db.writes[0][2].responseVersion.value, 1);
});
