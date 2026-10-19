import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 2 exposes two separate routes inside the same site", async () => {
  const [mainPage, prepPage, sessionOne] = await Promise.all([
    read("../app/sesion-2/page.tsx"),
    read("../app/sesion-2/preparacion/page.tsx"),
    read("../app/session-one.tsx"),
  ]);
  assert.match(mainPage, /SessionTwo/);
  assert.match(prepPage, /SessionTwoPrep/);
  assert.match(sessionOne, /href="\/sesion-2"/);
  assert.match(sessionOne, /01 · Contexto/);
});

test("agendas total exactly 60 and 90 minutes, with 70 applied minutes in the principal route", async () => {
  const data = await read("../app/session-two-data.ts");
  const prepBlock = data.match(/export const prepAgenda = \[([\s\S]*?)\n\];/)?.[1] || "";
  const mainBlock = data.match(/export const mainAgenda = \[([\s\S]*?)\n\];/)?.[1] || "";
  const prepMinutes = [...prepBlock.matchAll(/minutes:\s*(\d+)/g)].map((match) => Number(match[1]));
  const mainItems = [...mainBlock.matchAll(/minutes:\s*(\d+)[\s\S]*?active:\s*(true|false)/g)].map((match) => ({ minutes: Number(match[1]), active: match[2] === "true" }));
  assert.equal(prepMinutes.reduce((sum, value) => sum + value, 0), 60);
  assert.equal(mainItems.reduce((sum, item) => sum + item.minutes, 0), 90);
  assert.equal(mainItems.filter((item) => item.active).reduce((sum, item) => sum + item.minutes, 0), 70);
});

test("participant interfaces avoid uploads and include internal evidence, fallback and privacy", async () => {
  const [main, prep] = await Promise.all([read("../app/session-two.tsx"), read("../app/session-two-prep.tsx")]);
  const combined = `${main}\n${prep}`;
  assert.doesNotMatch(combined, /type="file"/);
  assert.match(combined, /s2_evidence/);
  assert.match(combined, /leveling_activity/);
  assert.match(combined, /respuesta de (muestra|contingencia)/i);
  assert.match(combined, /datos personales/i);
  assert.match(combined, /no acredita/i);
  assert.match(combined, /borrador/i);
});

test("Session 2 backend separates orientation, leveling, attendance and evidence", async () => {
  const [route, schema] = await Promise.all([read("../app/api/session-two/route.ts"), read("../db/schema.ts")]);
  for (const action of ["digital_diagnostic", "leveling_attendance", "leveling_activity", "s2_main_attendance", "s2_evidence"]) {
    assert.match(route, new RegExp(action));
  }
  assert.match(schema, /digitalSkillDiagnostics/);
  assert.match(schema, /levelingRecords/);
  assert.match(schema, /sessionTwoEvidence/);
  assert.match(route, /onConflictDoUpdate/);
  assert.match(route, /attendance.*SESSION/s);
});

