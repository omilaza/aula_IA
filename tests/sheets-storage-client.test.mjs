import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../db/sheets-client.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, {
  exports: module.exports,
  require: (name) => {
    assert.equal(name, "drizzle-orm");
    return { getTableName: (table) => table.name };
  },
  URL, AbortController, setTimeout, clearTimeout,
  crypto: { randomUUID },
  fetch: () => { throw new Error("A test attempted an uninjected network request"); },
}, { filename: "sheets-client.js" });

const { createSheetsRepository, currentTimestamp, increment } = module.exports;
const url = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec";
const secret = "private-worker-secret-at-least-thirty-two-characters";
const table = { name: "attendance" };
const plain = (value) => JSON.parse(JSON.stringify(value));

function success(body, result) {
  return new Response(JSON.stringify({ ok: true, version: 1, requestId: JSON.parse(body).requestId, result }));
}

function client(fetch, overrides = {}) {
  return createSheetsRepository({ url, secret, fetch, requestId: randomUUID, timeoutMs: 50, retryDelayMs: 0, ...overrides });
}

test("configuration requires a production Google Apps Script URL and a sufficiently long secret", () => {
  for (const options of [
    {}, { url }, { url, secret: "short" },
    { url: "https://example.test/macros/s/DEPLOYMENT_ID/exec", secret },
    { url: "http://script.google.com/macros/s/DEPLOYMENT_ID/exec", secret },
    { url: "https://script.google.com/macros/s/DEPLOYMENT_ID/dev", secret },
    { url: `${url}?secret=private`, secret },
    { url: `${url}#fragment`, secret },
    { url: "https://credentials@script.google.com/macros/s/DEPLOYMENT_ID/exec", secret },
    { url: "https://script.google.com.evil.test/macros/s/DEPLOYMENT_ID/exec", secret },
    { url: "invalid deployment URL", secret },
  ]) assert.throws(() => createSheetsRepository(options));
});

test("find sends filters and projection only in its authenticated server POST body", async () => {
  const requestId = randomUUID();
  const expected = [{ fullName: "Docente" }];
  const calls = [];
  const db = client(async (target, init) => {
    calls.push({ target, init });
    return success(init.body, expected);
  }, { requestId: () => requestId });
  const filters = { email: "docente@example.test", session: "S1" };
  const options = { columns: ["fullName"], orderBy: "id", descending: true, limit: 1 };
  assert.deepEqual(plain(await db.find(table, filters, options)), expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].target, url);
  assert.doesNotMatch(calls[0].target, /private-worker|docente@example/);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.redirect, "follow");
  assert.equal(calls[0].init.headers["content-type"], "text/plain;charset=UTF-8");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    action: "storage", version: 1, secret, requestId, operation: "find", table: "attendance", filters, options,
  });
});

test("upsert preserves values and explicitly serializes increment and timestamp operations", async () => {
  const values = { email: "docente@example.test", confirmationCode: "AS1-NEW", attempt: 1 };
  const updates = { confirmationCode: "AS1-NEW", attempt: increment(1), updatedAt: currentTimestamp };
  let sent;
  const db = client(async (_target, init) => {
    sent = JSON.parse(init.body);
    return success(init.body, { ...values, attempt: 2 });
  });
  assert.equal((await db.upsert(table, values, updates)).attempt, 2);
  assert.equal(sent.operation, "upsert");
  assert.deepEqual(sent.values, values);
  assert.deepEqual(sent.updates, { confirmationCode: "AS1-NEW", attempt: { op: "increment", value: 1 }, updatedAt: { op: "timestamp" } });
});

test("network errors retry the exact same body and request UUID", async () => {
  const calls = [];
  let requestIdCalls = 0;
  const requestId = randomUUID();
  const db = client(async (_target, init) => {
    calls.push(init.body);
    if (calls.length < 3) throw new Error(`upstream error containing ${secret}`);
    return success(init.body, { confirmationCode: "AS1-SAVED" });
  }, { requestId: () => { requestIdCalls++; return requestId; } });
  assert.equal((await db.insert(table, { confirmationCode: "AS1-SAVED" })).confirmationCode, "AS1-SAVED");
  assert.equal(calls.length, 3);
  assert.equal(requestIdCalls, 1);
  assert.equal(new Set(calls).size, 1);
  assert.equal(JSON.parse(calls[0]).requestId, requestId);
});

test("HTTP 503 and a BUSY storage response retry without changing the operation", async () => {
  const calls = [];
  const db = client(async (_target, init) => {
    calls.push(init.body);
    if (calls.length === 1) return new Response("unavailable", { status: 503 });
    if (calls.length === 2) return new Response(JSON.stringify({ ok: false, error: { code: "BUSY" } }));
    return success(init.body, []);
  });
  assert.deepEqual(plain(await db.find(table, { session: "S2" })), []);
  assert.equal(calls.length, 3);
  assert.equal(new Set(calls).size, 1);
});

test("timeout abort retries keep the UUID and clear the previous attempt signal", async () => {
  const calls = [];
  let firstSignal;
  const db = client(async (_target, init) => {
    calls.push(init.body);
    if (calls.length === 1) {
      firstSignal = init.signal;
      return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("request timeout")), { once: true }));
    }
    assert.notEqual(init.signal, firstSignal);
    assert.equal(init.signal.aborted, false);
    return success(init.body, []);
  }, { timeoutMs: 5 });
  assert.deepEqual(plain(await db.find(table)), []);
  assert.equal(firstSignal.aborted, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
});

test("an acknowledgement with the wrong UUID, version, or missing result can never succeed", async () => {
  for (const invalid of [
    (id) => ({ ok: true, version: 1, requestId: `${id}-different`, result: [] }),
    (id) => ({ ok: true, version: 2, requestId: id, result: [] }),
    (id) => ({ ok: true, version: 1, requestId: id }),
    (id) => ({ version: 1, requestId: id, result: [] }),
  ]) {
    let attempts = 0;
    const db = client(async (_target, init) => {
      attempts++;
      return new Response(JSON.stringify(invalid(JSON.parse(init.body).requestId)));
    });
    await assert.rejects(db.find(table));
    assert.equal(attempts, 1, "a protocol mismatch is not a transient network error");
  }
});

test("redacted errors never disclose secrets, response bodies or submitted answers", async () => {
  const privateAnswer = "private teacher answer";
  for (const behavior of [
    async () => { throw new Error(`${secret} ${privateAnswer}`); },
    async () => new Response(`${secret} ${privateAnswer}`, { status: 503 }),
    async () => new Response(JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: `${secret} ${privateAnswer}` } })),
  ]) {
    const db = client(behavior);
    await assert.rejects(db.insert(table, { fullName: privateAnswer }), (error) => {
      assert.match(error.message, /No se pudo confirmar/);
      assert.doesNotMatch(error.message, new RegExp(`${secret}|${privateAnswer}`));
      assert.equal(Object.hasOwn(error, "cause"), false);
      return true;
    });
  }
});

test("insert and upsert reject a mismatched folio even when the envelope is valid", async () => {
  for (const operation of ["insert", "upsert"]) {
    const db = client(async (_target, init) => success(init.body, { confirmationCode: "AS1-OTHER" }));
    await assert.rejects(db[operation](table, { confirmationCode: "AS1-EXPECTED" }, {}), /no corresponde/);
  }
  const db = client(async (_target, init) => success(init.body, { evidenceCode: "LAB-OTHER" }));
  await assert.rejects(db.insert(table, { evidenceCode: "LAB-EXPECTED" }), /no corresponde/);
});

test("insertIfAbsent accepts the saved original folio only for the same idempotency key", async () => {
  const values = { idempotencyKey: "survey-submission-1", referenceCode: "SURV-NEW" };
  const db = client(async (_target, init) => success(init.body, {
    inserted: false, row: { idempotencyKey: values.idempotencyKey, referenceCode: "SURV-ORIGINAL" },
  }));
  assert.deepEqual(plain(await db.insertIfAbsent({ name: "course_satisfaction_survey_responses" }, values)), {
    inserted: false, row: { idempotencyKey: values.idempotencyKey, referenceCode: "SURV-ORIGINAL" },
  });
  for (const result of [
    { inserted: false, row: { idempotencyKey: "another-submission", referenceCode: "SURV-ORIGINAL" } },
    { inserted: false, row: { idempotencyKey: values.idempotencyKey, referenceCode: "" } },
    { inserted: "false", row: { idempotencyKey: values.idempotencyKey, referenceCode: "SURV-ORIGINAL" } },
  ]) {
    const invalid = client(async (_target, init) => success(init.body, result));
    await assert.rejects(invalid.insertIfAbsent(table, values));
  }
});

test("countBy serializes its grouping and rejects an unexpected non-array result", async () => {
  let sent;
  const db = client(async (_target, init) => {
    sent = JSON.parse(init.body);
    return success(init.body, [{ category: "planeacion", count: 3 }]);
  });
  assert.deepEqual(plain(await db.countBy({ name: "icebreaker_responses" }, { session: "S1" }, "category")), [{ category: "planeacion", count: 3 }]);
  assert.equal(sent.table, "icebreaker_responses");
  assert.deepEqual(sent.filters, { session: "S1" });
  assert.equal(sent.field, "category");
  const invalid = client(async (_target, init) => success(init.body, { category: "planeacion", count: 3 }));
  await assert.rejects(invalid.countBy(table, {}, "category"), /conteo/);
});
