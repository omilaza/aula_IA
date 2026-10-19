import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("course survey is a separate anonymous route with a non-accrediting confirmation", async () => {
  const [page, source] = await Promise.all([
    read("../app/encuesta-satisfaccion/page.tsx"),
    read("../app/course-survey.tsx"),
  ]);
  assert.match(page, /CourseSurvey/);
  assert.match(page, /Encuesta de satisfacción del curso/);
  assert.match(source, /Respuesta anónima por defecto/);
  assert.match(source, /nombre y el correo son opcionales/i);
  assert.match(source, /No forma parte de la acreditación/);
  assert.match(source, /No constituye acreditación ni comprobante académico/);
  assert.match(source, /analizará de forma agregada/);
});

test("survey includes the requested dimensions, materials N-A and accessible star choices", async () => {
  const [source, data, css] = await Promise.all([
    read("../app/course-survey.tsx"),
    read("../app/course-survey-data.ts"),
    read("../app/course-survey.module.css"),
  ]);
  for (const label of [
    "Satisfacción general con el curso",
    "Calidad y pertinencia de los contenidos",
    "Desempeño y acompañamiento del instructor",
    "Utilidad y facilidad de uso de la plataforma",
    "Actividades y prácticas",
  ]) assert.match(data, new RegExp(label));
  assert.match(source, /Materiales descargables, presentaciones y recursos de apoyo/);
  assert.match(source, /No los utilicé \/ No aplica/);
  assert.match(source, /type="radio"/);
  assert.match(source, /aria-label=\{`\$\{rating\} de 5:/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="radiogroup"/);
  assert.match(source, /aria-required=\{required\}/);
  assert.match(css, /input:focus-visible/);
  assert.match(css, /--coral: #a6372d/);
  assert.match(css, /--focus: #8b6717/);
  assert.match(css, /prefers-reduced-motion/);
});

test("only four ratings are indispensable and validation focuses the first real control", async () => {
  const source = await read("../app/course-survey.tsx");
  const criticalBlock = source.slice(source.indexOf("const criticalLabels"), source.indexOf("const criticalKeys"));
  for (const key of ["generalRating", "contentRating", "instructorRating", "platformRating"]) assert.match(criticalBlock, new RegExp(key));
  for (const key of ["activitiesRating", "materialsRating", "recommendationApplication"]) assert.doesNotMatch(criticalBlock, new RegExp(key));
  assert.match(source, /scrollIntoView\(\{ behavior: preferredScrollBehavior\(\), block: "center" \}\)/);
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(source, /firstControl \|\| field/);
  assert.match(source, /role="alert" aria-live="assertive"/);
  assert.match(source, /Hay \{issues\.length\}/);
  assert.match(source, /Revisa el formato del correo o deja el campo vacío/);
  assert.match(source, /aria-invalid=\{Boolean\(issueFor\("email"\)\)\}/);
});

test("survey uses one stable idempotency key, blocks double click and keeps the agreed payload", async () => {
  const source = await read("../app/course-survey.tsx");
  assert.match(source, /fetch\("\/api\/course-survey"/);
  assert.match(source, /action: "submit"/);
  assert.match(source, /idempotencyKey: idempotencyKeyRef\.current/);
  assert.match(source, /try \{\s+if \(!idempotencyKeyRef\.current\) idempotencyKeyRef\.current = crypto\.randomUUID\(\)/);
  assert.match(source, /submittingRef\.current \|\| submission\.kind === "loading" \|\| submission\.kind === "success"/);
  assert.match(source, /disabled=\{submission\.kind === "loading"\}/);
  assert.match(source, /payload\.issues/);
  assert.match(source, /setIssues\(mappedIssues\)/);
  for (const key of [
    "generalRating", "contentRating", "instructorRating", "platformRating", "activitiesRating",
    "materialsRating", "materialsNotUsed", "recommendationApplication", "likedMost", "improvements",
    "additionalComments", "name", "email",
  ]) assert.match(source, new RegExp(`\\b${key}\\b`));
});

test("open comments and recommendation are clear and optional", async () => {
  const source = await read("../app/course-survey.tsx");
  assert.match(source, /¿Qué fue lo que más te gustó y por qué\?<textarea/);
  assert.match(source, /¿Qué mejorarías y por qué\?<textarea/);
  assert.match(source, /Comentarios u observaciones adicionales<textarea/);
  assert.match(source, /¿Recomendarías el curso o aplicarías lo aprendido\?/);
  assert.match(source, /Esta pregunta es opcional/);
  assert.match(source, /<label>¿Qué fue lo que más te gustó y por qué\?<textarea/);
  assert.match(source, /<label>¿Qué mejorarías y por qué\?<textarea/);
  assert.match(source, /<label className=\{styles\.fullWidth\}>Comentarios u observaciones adicionales<textarea/);
});

test("Session 5 and Session 6 expose the survey without changing evidence actions", async () => {
  const [sessionFive, sessionSix] = await Promise.all([
    read("../app/session-five.tsx"),
    read("../app/session-six.tsx"),
  ]);
  for (const source of [sessionFive, sessionSix]) {
    assert.match(source, /href="\/encuesta-satisfaccion"/);
    assert.match(source, /Encuesta de satisfacción del curso/);
  }
  assert.match(sessionFive, /href="\/sesion-6"/);
  assert.doesNotMatch(sessionFive, /Sesión 6 · Próximamente/);
  assert.match(sessionFive, /Guardar evidencia S5/);
  assert.match(sessionSix, /Guardar evidencia S6/);
});
