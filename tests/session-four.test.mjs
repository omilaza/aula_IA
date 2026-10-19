import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 4 exposes preparation and principal routes from the established navigation", async () => {
  const [mainPage, prepPage, sessionOne, sessionThree] = await Promise.all([
    read("../app/sesion-4/page.tsx"),
    read("../app/sesion-4/preparacion/page.tsx"),
    read("../app/session-one.tsx"),
    read("../app/session-three.tsx"),
  ]);
  assert.match(mainPage, /SessionFour/);
  assert.match(prepPage, /SessionFourPrep/);
  assert.match(sessionOne, /href="\/sesion-4"/);
  assert.match(sessionThree, /href="\/sesion-4"/);
});

test("Session 4 agendas total exactly 60 and 90 minutes, with 75 applied minutes", async () => {
  const data = await read("../app/session-four-data.ts");
  const prepBlock = data.match(/export const prepAgenda = \[([\s\S]*?)\n\] as const;/)?.[1] || "";
  const mainBlock = data.match(/export const mainAgenda = \[([\s\S]*?)\n\] as const;/)?.[1] || "";
  const prepMinutes = [...prepBlock.matchAll(/minutes:\s*(\d+)/g)].map((match) => Number(match[1]));
  const mainItems = [...mainBlock.matchAll(/minutes:\s*(\d+)[\s\S]*?active:\s*(true|false)/g)].map((match) => ({
    minutes: Number(match[1]),
    active: match[2] === "true",
  }));
  assert.deepEqual(prepMinutes, [5, 10, 15, 20, 5, 5]);
  assert.equal(prepMinutes.reduce((sum, value) => sum + value, 0), 60);
  assert.deepEqual(mainItems.map((item) => item.minutes), [5, 10, 15, 35, 15, 5, 5]);
  assert.equal(mainItems.reduce((sum, item) => sum + item.minutes, 0), 90);
  assert.equal(mainItems.filter((item) => item.active).reduce((sum, item) => sum + item.minutes, 0), 75);
});

test("Session 4 offers all nine level and difficulty combinations", async () => {
  const data = await read("../app/session-four-data.ts");
  const caseBlock = data.match(/export const cases = \[([\s\S]*?)\n\] as const;/)?.[1] || "";
  const difficultyBlock = data.match(/export const difficultyLevels = \[([\s\S]*?)\n\] as const;/)?.[1] || "";
  const caseKeys = [...caseBlock.matchAll(/key:\s*"(basica|media|superior)"/g)].map((match) => match[1]);
  const difficultyKeys = [...difficultyBlock.matchAll(/key:\s*"(basico|intermedio|avanzado)"/g)].map((match) => match[1]);
  const combinations = caseKeys.flatMap((caseKey) => difficultyKeys.map((difficulty) => `${caseKey}:${difficulty}`));
  assert.deepEqual(caseKeys, ["basica", "media", "superior"]);
  assert.deepEqual(difficultyKeys, ["basico", "intermedio", "avanzado"]);
  assert.equal(new Set(combinations).size, 9);
});

test("Difficulty requirements and checklists preserve the exact cumulative 6, 10 and 15 progression", async () => {
  const data = await read("../app/session-four-data.ts");
  const directEntries = (name) => {
    const block = data.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\] as const;`))?.[1] || "";
    return [...block.matchAll(/^\s*"/gm)].length;
  };
  assert.equal(directEntries("basicPromptRequirements"), 6);
  assert.equal(directEntries("intermediatePromptRequirements"), 4);
  assert.equal(directEntries("advancedPromptRequirements"), 5);
  assert.equal(directEntries("basicChecklist"), 6);
  assert.equal(directEntries("intermediateChecklist"), 4);
  assert.equal(directEntries("advancedChecklist"), 5);
  assert.match(data, /\.\.\.basicPromptRequirements/);
  assert.match(data, /\.\.\.intermediatePromptRequirements/);
  assert.match(data, /\.\.\.basicChecklist/);
  assert.match(data, /\.\.\.intermediateChecklist/);
});

test("Case, difficulty, prompt, form and checklist stay synchronized while compatible work is protected", async () => {
  const main = await read("../app/session-four.tsx");
  assert.match(main, /buildEvaluationPrompt\(currentCase, currentDifficulty, evidence\.evaluationMoment\)/);
  assert.match(main, /difficultyEvidenceChecklist\[currentDifficulty\.key\]/);
  assert.match(main, /function resetCaseBoundEvidence/);
  assert.match(main, /confirmChecklistReset/);
  assert.match(main, /configurationReviewIssues/);
  assert.match(main, /Tus textos se conservarán y quedarán marcados para revisión/);
  assert.match(main, /los nuevos pendientes quedaron señalados de inmediato/);
  assert.match(main, /setEvidenceState\(\{ kind: "idle" \}\);/);
  assert.match(main, /const nextCase = cases\.find/);
  const formativeCycle = main.match(/<div className=\{styles\.prepMap\} aria-label="Ciclo de evaluación formativa">([\s\S]*?)<\/div>/)?.[1] || "";
  assert.match(formativeCycle, /1\. Evidencia/);
  assert.match(formativeCycle, /2\. Criterio/);
  assert.match(formativeCycle, /3\. Retroalimentación/);
  assert.match(formativeCycle, /4\. Decisión docente/);
  assert.match(main, /evaluacion-formativa-docente-s4\.png/);
  assert.doesNotMatch(main, /type="file"/);
});

test("Session 4 keeps discreet sources, additional activities, privacy and offline contingency", async () => {
  const [main, prep, data] = await Promise.all([
    read("../app/session-four.tsx"),
    read("../app/session-four-prep.tsx"),
    read("../app/session-four-data.ts"),
  ]);
  const combined = `${main}\n${prep}\n${data}`;
  assert.match(combined, /ACTIVIDADES ADICIONALES/);
  assert.match(combined, /EJEMPLO SIMULADO/);
  assert.match(combined, /no acredita/i);
  assert.match(combined, /respuesta de contingencia/i);
  assert.match(prep, /ACTIVIDAD ADICIONAL · OPCIONAL · 15–20 MINUTOS/);
  assert.match(prep, /fuera de los 60 minutos oficiales/);
  assert.match(prep, /Calibrar antes de retroalimentar/);
  assert.equal((prep.match(/EJEMPLO SIMULADO AULA-IA/g) || []).length, 1);
  for (const expected of ["Inicial", "En proceso", "Logrado", "Aceptar", "Adaptar", "Rechazar"]) {
    assert.match(prep, new RegExp(expected));
  }
  assert.match(main, /<details className=\{styles\.detailsCard\}>/);
  for (const expected of ["unesdoc.unesco.org", "help.openai.com", "academy.openai.com", "support.google.com", "udlguidelines.cast.org"]) {
    assert.match(data, new RegExp(expected.replaceAll(".", "\\.")));
  }
});

test("Session 4 exposes only learner-facing downloads in their corresponding route", async () => {
  const [main, prep, mainPage, prepPage] = await Promise.all([
    read("../app/session-four.tsx"),
    read("../app/session-four-prep.tsx"),
    read("../app/sesion-4/page.tsx"),
    read("../app/sesion-4/preparacion/page.tsx"),
  ]);
  const mainFiles = [...main.matchAll(/href="\/recursos\/sesion-4\/([^"]+)"/g)].map((match) => match[1]);
  const prepFiles = [...prep.matchAll(/href="\/recursos\/sesion-4\/([^"]+)"/g)].map((match) => match[1]);
  const learnerFiles = [...mainFiles, ...prepFiles];
  assert.equal(mainFiles.length, 7);
  assert.deepEqual(prepFiles, ["presentacion-preparacion-s4.pptx"]);
  assert.equal(new Set(learnerFiles).size, 8);
  assert.doesNotMatch(main, /presentacion-preparacion-s4\.pptx/);
  assert.doesNotMatch(main, /manual-instructor-s4|Manual y guion del instructor/);
  assert.doesNotMatch(prep, /manual-instructor-s4|Manual y guion del instructor/);
  for (const fileName of [...learnerFiles, "evaluacion-formativa-docente-s4.png", "og-sesion-4.png"]) {
    const info = await stat(new URL(`../public/recursos/sesion-4/${fileName}`, import.meta.url));
    assert.ok(info.isFile());
    assert.ok(info.size > 1_000);
  }
  for (const fileName of ["manual-instructor-s4.pdf", "manual-instructor-s4.docx"]) {
    await assert.rejects(
      stat(new URL(`../public/recursos/sesion-4/${fileName}`, import.meta.url)),
      { code: "ENOENT" },
    );
  }
  assert.match(main, /src="\/recursos\/sesion-4\/evaluacion-formativa-docente-s4\.png"/);
  assert.match(mainPage, /\/recursos\/sesion-4\/og-sesion-4\.png/);
  assert.match(prepPage, /\/recursos\/sesion-4\/og-sesion-4\.png/);
});
