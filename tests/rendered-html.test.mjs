import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the finished Session 1 module and no starter preview", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/session-one.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /De la pregunta rápida al/);
  assert.match(page, /90 minutos/);
  assert.match(page, /const activeMinutes/);
  assert.match(page, /min de aplicación/);
  assert.match(page, /Laboratorio AULA-IA/);
  assert.match(layout, /Sesión 1/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("keeps the agreed diagnostic and D1 configuration", async () => {
  const [page, route, hosting] = await Promise.all([
    readFile(new URL("../app/session-one.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/session-one/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  for (let number = 1; number <= 12; number += 1) {
    assert.match(page, new RegExp(`D${number}`));
  }
  assert.match(route, /D7:\s*"B"/);
  assert.match(route, /D8:\s*"C"/);
  assert.match(route, /D9:\s*"B"/);
  assert.match(route, /D10:\s*"A"/);
  assert.match(route, /D11:\s*"C"/);
  assert.match(route, /D12:\s*"D"/);
  assert.match(hosting, /"d1":\s*"DB"/);
});

test("keeps a stable form reference while the icebreaker request is pending", async () => {
  const page = await readFile(new URL("../app/session-one.tsx", import.meta.url), "utf8");
  assert.match(page, /const form = event\.currentTarget;/);
  assert.match(page, /form\.reset\(\);/);
  assert.doesNotMatch(page, /event\.currentTarget\.reset\(\);/);
});
