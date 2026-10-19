import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Sessions 1 to 6 share accessible top and bottom navigation", async () => {
  const navigation = await read("../app/session-navigation.tsx");
  for (const [number, href] of [[1, "/"], [2, "/sesion-2"], [3, "/sesion-3"], [4, "/sesion-4"], [5, "/sesion-5"], [6, "/sesion-6"]]) {
    assert.match(navigation, new RegExp(`number: ${number}, href: "${href.replaceAll("/", "\\/")}"`));
  }
  assert.match(navigation, /aria-current="page"/);
  assert.doesNotMatch(navigation, /Próximamente|aria-disabled="true"/);

  const files = ["session-one.tsx", "session-two.tsx", "session-two-prep.tsx", "session-three.tsx", "session-three-prep.tsx", "session-four.tsx", "session-four-prep.tsx", "session-five.tsx", "session-five-prep.tsx", "session-six.tsx"];
  for (const file of files) {
    const source = await read(`../app/${file}`);
    assert.equal((source.match(/<SessionNavigation current=\{/g) || []).length, 2, `${file} needs top and bottom navigation`);
    assert.match(source, /position="top"/);
    assert.match(source, /position="bottom"/);
  }
});

test("Sessions 1 to 5 distinguish local progress from accredited evidence and list exact issues", async () => {
  const files = ["session-one.tsx", "session-two.tsx", "session-three.tsx", "session-four.tsx", "session-five.tsx"];
  for (const file of files) {
    const source = await read(`../app/${file}`);
    assert.match(source, /Guardar avance sin acreditar/);
    assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
    assert.match(source, /validationIssues|ValidationIssues/);
    assert.match(source, /No se puede acreditar todavía|No se puede completar todavía|Faltan datos para guardar/);
  }
});

test("Session 1 keeps the checklist warning live until all ten values and six affirmative answers exist", async () => {
  const source = await read("../app/session-one.tsx");
  assert.match(source, /function updateChecklistValue/);
  assert.match(source, /const unvalued = checklistItems\.filter/);
  assert.match(source, /yesCount >= 6/);
  assert.match(source, /onChange=\{\(event\) => updateChecklistValue\(item, event\.target\.value\)\}/);
});

test("Session APIs enumerate critical fields without changing persistence schemas", async () => {
  for (const session of ["one", "two", "three", "four", "five"]) {
    const route = await read(`../app/api/session-${session}/route.ts`);
    assert.match(route, /fields:/);
    assert.doesNotMatch(route, /\b(?:DROP|ALTER|TRUNCATE|DELETE FROM)\b/i);
  }
});
