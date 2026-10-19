import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 5 exposes separate preparation and principal routes without replacing earlier navigation", async () => {
  const [mainPage, prepPage, sessionOne, sessionFour, prepFour] = await Promise.all([
    read("../app/sesion-5/page.tsx"),
    read("../app/sesion-5/preparacion/page.tsx"),
    read("../app/session-one.tsx"),
    read("../app/session-four.tsx"),
    read("../app/session-four-prep.tsx"),
  ]);
  assert.match(mainPage, /SessionFive/);
  assert.match(prepPage, /SessionFivePrep/);
  assert.match(sessionOne, /href="\/sesion-5"/);
  assert.match(sessionFour, /href="\/sesion-5"/);
  assert.match(prepFour, /href="\/sesion-5"/);
});

test("Session 5 agendas total exactly 60 and 90 minutes with 75 applied minutes", async () => {
  const data = await read("../app/session-five-data.ts");
  const prepBlock = data.match(/export const prepAgenda = \[([\s\S]*?)\n\] as const;/)?.[1] || "";
  const mainBlock = data.match(/export const mainAgenda = \[([\s\S]*?)\n\] as const;/)?.[1] || "";
  const prepMinutes = [...prepBlock.matchAll(/minutes:\s*(\d+)/g)].map((match) => Number(match[1]));
  const mainItems = [...mainBlock.matchAll(/minutes:\s*(\d+)[\s\S]*?active:\s*(true|false)/g)].map((match) => ({ minutes: Number(match[1]), active: match[2] === "true" }));
  assert.deepEqual(prepMinutes, [5, 10, 12, 15, 10, 5, 3]);
  assert.equal(prepMinutes.reduce((sum, value) => sum + value, 0), 60);
  assert.deepEqual(mainItems.map((item) => item.minutes), [5, 10, 13, 22, 10, 18, 7, 5]);
  assert.equal(mainItems.reduce((sum, item) => sum + item.minutes, 0), 90);
  assert.equal(mainItems.filter((item) => item.active).reduce((sum, item) => sum + item.minutes, 0), 75);
});

test("Session 5 contains four complete public-system contexts and five instrument choices", async () => {
  const data = await read("../app/session-five-data.ts");
  const dataModule = await import(new URL("../app/session-five-data.ts", import.meta.url));
  for (const key of ["primaria", "secundaria", "media-superior", "superior"]) {
    assert.match(data, new RegExp(`key: "${key}"`));
  }
  for (const key of ["rubrica_analitica", "lista_cotejo", "escala_valoracion", "guia_observacion", "portafolio_evidencias"]) {
    assert.match(data, new RegExp(`key: "${key}"`));
  }
  assert.equal(dataModule.sequences.length, 4);
  assert.equal(dataModule.sequences.every((sequence) => sequence.moments.map((moment) => moment.label).join(",") === "Inicio,Desarrollo,Cierre"), true);
  for (const level of ["Educación básica", "Secundaria", "Educación media superior", "Educación superior"]) {
    assert.match(data, new RegExp(level));
  }
});

test("Session 5 preserves the exact cumulative 3, 6 and 10 difficulty paths", async () => {
  const data = await read("../app/session-five-data.ts");
  const checklistBlock = data.match(/export const difficultyEvidenceChecklist = \{([\s\S]*?)\n\} as const;/)?.[1] || "";
  assert.match(checklistBlock, /basico: basicChecklist/);
  assert.match(checklistBlock, /intermedio: intermediateChecklist/);
  assert.match(checklistBlock, /avanzado: advancedChecklist/);
  assert.match(data, /const intermediateChecklist = \[\s*\.\.\.basicChecklist,/);
  assert.match(data, /const advancedChecklist = \[\s*\.\.\.intermediateChecklist,/);
  assert.match(data, /Responde 3 preguntas esenciales/);
  assert.match(data, /Responde 6 preguntas/);
  assert.match(data, /Responde 10 preguntas/);
  const dataModule = await import(new URL("../app/session-five-data.ts", import.meta.url));
  assert.equal(dataModule.difficultyEvidenceChecklist.basico.length, 3);
  assert.equal(dataModule.difficultyEvidenceChecklist.intermedio.length, 6);
  assert.equal(dataModule.difficultyEvidenceChecklist.avanzado.length, 10);
});

test("The dashboard uses 50 deterministic fictitious records in groups 17, 17 and 16", async () => {
  const data = await import(new URL("../app/session-five-data.ts", import.meta.url));
  assert.equal(data.studentResults.length, 50);
  assert.equal(data.studentResults.filter((item) => item.group === "G1").length, 17);
  assert.equal(data.studentResults.filter((item) => item.group === "G2").length, 17);
  assert.equal(data.studentResults.filter((item) => item.group === "G3").length, 16);
  assert.equal(data.expectedDashboardMetrics.submitted, 48);
  assert.equal(data.expectedDashboardMetrics.participationRate, 96);
  assert.equal(data.expectedDashboardMetrics.overallAverage, 2.76);
  assert.equal(data.expectedDashboardMetrics.groups.G1.average, 3.31);
  assert.equal(data.expectedDashboardMetrics.groups.G2.average, 2.72);
  assert.equal(data.expectedDashboardMetrics.groups.G3.average, 2.17);
});

test("The two laboratories stay linked and offer own-sequence, fallback, CSV and privacy controls", async () => {
  const main = await read("../app/session-five.tsx");
  assert.match(main, /id="laboratorio-1"/);
  assert.match(main, /id="laboratorio-2"/);
  assert.match(main, /Laboratorios enlazados/);
  assert.match(main, /Usar mi propia secuencia/);
  assert.match(main, /No tengo una secuencia completa: cargar caso simulado/);
  assert.match(main, /Descargar hoja CSV ficticia/);
  assert.match(main, /50 registros ficticios/);
  assert.doesNotMatch(main, /type="file"/);
  assert.match(main, /sin nombres, matrículas, diagnósticos ni documentos identificables/i);
});

test("Preparation uses a distinct scenario, eight records and a separate PDF recovery contract", async () => {
  const [prep, main, data] = await Promise.all([
    read("../app/session-five-prep.tsx"),
    read("../app/session-five.tsx"),
    read("../app/session-five-data.ts"),
  ]);
  assert.match(data, /1\.º de secundaria/);
  assert.match(prep, /ocho resultados ficticios/i);
  assert.match(prep, /activity: "nivelacion-instrumentos"/);
  assert.match(prep, /session="S5P"/);
  assert.match(main, /session="S5"/);
  assert.match(prep, /no acredita/i);
  assert.match(prep, /Abrir sesión principal/);
  assert.equal((data.match(/id: "P-\d\d"/g) || []).length, 8);
});

test("Preparation exposes two editable live prompts, output controls and the three optional AI services", async () => {
  const prep = await read("../app/session-five-prep.tsx");
  assert.match(prep, /Prompt base editable/);
  assert.match(prep, /Prompt vivo y editable/);
  assert.match(prep, /Tabla de cotejo/);
  assert.match(prep, /Markdown estructurado/);
  assert.match(prep, /Word editable/);
  assert.match(prep, /PDF imprimible/);
  assert.match(prep, /El PDF no se presenta como formato editable/);
  assert.match(prep, /Hallazgo observable:/);
  assert.match(prep, /Acción docente:/);
  assert.match(prep, /Nueva evidencia:/);
  assert.match(prep, /8 participantes/);
  assert.match(prep, /7 entregas/);
  assert.match(prep, /no presentes un dictamen automático/i);
  assert.equal((prep.match(/https:\/\/chatgpt\.com\//g) || []).length, 1);
  assert.equal((prep.match(/https:\/\/gemini\.google\.com\//g) || []).length, 1);
  assert.equal((prep.match(/https:\/\/notebooklm\.google\.com\//g) || []).length, 1);
  assert.match(prep, /Copiar prompt/);
  assert.match(prep, /ejemplo y punto de partida/i);
});

test("Session 5 retains shared route answers and exposes only verified participant downloads", async () => {
  const main = await read("../app/session-five.tsx");
  assert.match(main, /CHECKS_KEY/);
  const difficultyBranch = main.slice(main.indexOf("function chooseDifficulty"), main.indexOf("function startOwnSequence"));
  assert.doesNotMatch(difficultyBranch, /setChecks\(\{\}\)/);
  assert.match(main, /Descargas verificadas para participantes/);
  assert.match(main, /manual del instructor, el teleprompter, los planes de prueba y la evidencia técnica permanecen fuera/i);

  const files = [
    "presentacion-preparacion-s5.pdf",
    "presentacion-principal-s5.pdf",
    "cuadernillo-preparacion-s5.pdf",
    "cuadernillo-principal-s5.pdf",
    "hoja-trabajo-s5.docx",
    "hoja-trabajo-s5.pdf",
    "banco-prompts-s5.docx",
    "banco-prompts-s5.pdf",
    "plantillas-instrumentos-s5.docx",
    "plantillas-instrumentos-s5.pdf",
    "datos-ficticios-50-s5.csv",
  ];
  for (const file of files) {
    assert.match(main, new RegExp(file.replaceAll(".", "\\.")));
    const info = await stat(new URL(`../public/recursos/sesion-5/${file}`, import.meta.url));
    assert.ok(info.isFile());
    assert.ok(info.size > 1_000);
  }
});

test("Session 5 keeps discreet official sources, optional activities and a visible final-session handoff", async () => {
  const [main, data] = await Promise.all([
    read("../app/session-five.tsx"),
    read("../app/session-five-data.ts"),
  ]);
  assert.match(main, /ACTIVIDADES ADICIONALES/);
  assert.match(main, /Desplegar fuentes consultadas/);
  assert.match(main, /href="\/sesion-6"/);
  assert.match(main, /Encuesta de satisfacción del curso/);
  assert.doesNotMatch(main, /Sesión 6 · Próximamente/);
  for (const expected of ["educacionbasica.sep.gob.mx", "unesco.org", "oecd.org", "help.openai.com"]) {
    assert.match(data, new RegExp(expected.replaceAll(".", "\\.")));
  }
});

test("Session 5 original hero asset exists and is wired into both routes", async () => {
  const [main, prep, mainPage, prepPage] = await Promise.all([
    read("../app/session-five.tsx"),
    read("../app/session-five-prep.tsx"),
    read("../app/sesion-5/page.tsx"),
    read("../app/sesion-5/preparacion/page.tsx"),
  ]);
  const fileName = "hero-instrumentos-evidencias-s5.png";
  for (const source of [main, prep, mainPage, prepPage]) assert.match(source, new RegExp(fileName));
  const info = await stat(new URL(`../public/recursos/sesion-5/${fileName}`, import.meta.url));
  assert.ok(info.isFile());
  assert.ok(info.size > 100_000);
});
