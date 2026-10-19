import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 3 exposes preparation and principal routes from the established navigation", async () => {
  const [mainPage, prepPage, sessionOne, sessionTwo] = await Promise.all([
    read("../app/sesion-3/page.tsx"),
    read("../app/sesion-3/preparacion/page.tsx"),
    read("../app/session-one.tsx"),
    read("../app/session-two.tsx"),
  ]);
  assert.match(mainPage, /SessionThree/);
  assert.match(prepPage, /SessionThreePrep/);
  assert.match(sessionOne, /href="\/sesion-3"/);
  assert.match(sessionTwo, /href="\/sesion-3"/);
});

test("Session 3 agendas total exactly 60 and 90 minutes, with 70 applied minutes", async () => {
  const data = await read("../app/session-three-data.ts");
  const prepBlock = data.match(/export const prepAgenda = \[([\s\S]*?)\n\];/)?.[1] || "";
  const mainBlock = data.match(/export const mainAgenda = \[([\s\S]*?)\n\];/)?.[1] || "";
  const prepMinutes = [...prepBlock.matchAll(/minutes:\s*(\d+)/g)].map((match) => Number(match[1]));
  const mainItems = [...mainBlock.matchAll(/minutes:\s*(\d+)[\s\S]*?active:\s*(true|false)/g)].map((match) => ({
    minutes: Number(match[1]),
    active: match[2] === "true",
  }));
  assert.deepEqual(prepMinutes, [5, 10, 15, 20, 5, 5]);
  assert.equal(prepMinutes.reduce((sum, value) => sum + value, 0), 60);
  assert.deepEqual(mainItems.map((item) => item.minutes), [5, 15, 20, 35, 10, 5]);
  assert.equal(mainItems.reduce((sum, item) => sum + item.minutes, 0), 90);
  assert.equal(mainItems.filter((item) => item.active).reduce((sum, item) => sum + item.minutes, 0), 70);
});

test("Session 3 keeps the approved pedagogical safeguards and adaptive paths", async () => {
  const [main, prep, data] = await Promise.all([
    read("../app/session-three.tsx"),
    read("../app/session-three-prep.tsx"),
    read("../app/session-three-data.ts"),
  ]);
  const combined = `${main}\n${prep}\n${data}`;
  assert.match(combined, /ACTIVIDADES ADICIONALES/);
  assert.match(combined, /Educación básica/);
  assert.match(combined, /Media superior/);
  assert.match(combined, /Educación superior/);
  assert.match(combined, /Básico/);
  assert.match(combined, /Intermedio/);
  assert.match(combined, /Avanzado/);
  assert.match(combined, /CAVIA/);
  assert.match(combined, /EJEMPLO SIMULADO/);
  assert.match(combined, /no acredita/i);
  assert.doesNotMatch(combined, /type="file"/);
});

test("Session 3 provides discreet primary sources and an offline contingency", async () => {
  const [main, prep, data] = await Promise.all([
    read("../app/session-three.tsx"),
    read("../app/session-three-prep.tsx"),
    read("../app/session-three-data.ts"),
  ]);
  assert.match(main, /Consultar fuente/);
  assert.match(prep, /respuesta (integrada|de práctica)/i);
  for (const expected of [
    "unesdoc.unesco.org",
    "academy.openai.com",
    "help.openai.com",
    "joint-research-centre.ec.europa.eu",
    "udlguidelines.cast.org",
  ]) {
    assert.match(data, new RegExp(expected.replaceAll(".", "\\.")));
  }
});

test("All educational levels keep explicit cumulative requirements from cards through the final checklist", async () => {
  const [main, data] = await Promise.all([
    read("../app/session-three.tsx"),
    read("../app/session-three-data.ts"),
  ]);

  for (const requirement of [
    "Boleto de salida",
    "Apoyo para distintos ritmos de aprendizaje",
    "Ruta de participación A",
    "Ruta de participación B",
    "cómo las rutas A y B alcanzan el mismo propósito",
    "Alternativa de acceso",
    "Contraejemplo",
    "qué conservar",
    "qué ajustar",
    "qué retirar",
  ]) {
    assert.match(data, new RegExp(requirement, "i"));
  }

  assert.match(main, /difficultyPromptRequirements\[difficulty\.key\]/);
  assert.match(main, /difficultyContent\[item\.key\]/);
  assert.match(main, /difficultyEvidenceChecklist\[currentDifficulty\.key\]/);
  assert.match(main, /currentEvidenceChecklist\.map/);
  assert.match(main, /currentEvidenceChecklist\.some/);
  assert.doesNotMatch(main, /isMediaSuperior|mediaSuperior/);
  assert.doesNotMatch(data, /Incluye lo (?:básico|intermedio)/i);
  assert.match(
    data,
    /product: "Secuencia de seminario con apertura, contraste de interpretaciones y producción escrita\."/,
  );
});

test("Every educational level keeps the card, prompt and final evidence synchronized", async () => {
  const main = await read("../app/session-three.tsx");

  assert.match(main, /const nextDifficulty = event\.target\.value[\s\S]*?chooseDifficulty\(nextDifficulty\);/);
  assert.match(main, /const nextLevel = event\.target\.value;\s*const nextCase = cases\.find/);
  assert.match(main, /if \(nextCase\) chooseCase\(nextCase\.key\);/);
  assert.doesNotMatch(main, /currentCase\.key === "media"/);
  assert.match(main, /Cambiar de caso conservará tus textos/);
  assert.match(main, /los nuevos pendientes quedaron señalados de inmediato/);
  assert.match(main, /setChecks\(nextChecks\);/);
  assert.match(main, /setEvidenceState\(\{ kind: "idle" \}\);/);
});

test("Difficulty requirements and checklists preserve the exact 6, 11 and 20 progression", async () => {
  const data = await read("../app/session-three-data.ts");
  const directEntries = (name) => {
    const block = data.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\] as const;`))?.[1] || "";
    return [...block.matchAll(/^\s*"/gm)].length;
  };

  assert.equal(directEntries("basicPromptRequirements"), 6);
  assert.equal(directEntries("intermediatePromptRequirements"), 5);
  assert.equal(directEntries("advancedPromptRequirements"), 9);
  assert.equal(directEntries("basicChecklist"), 6);
  assert.equal(directEntries("intermediateChecklist"), 5);
  assert.equal(directEntries("advancedChecklist"), 9);
  assert.match(data, /\.\.\.basicPromptRequirements/);
  assert.match(data, /\.\.\.intermediatePromptRequirements/);
  assert.match(data, /\.\.\.basicChecklist/);
  assert.match(data, /\.\.\.intermediateChecklist/);
});
