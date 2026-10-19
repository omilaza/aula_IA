import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Session 6 implements the approved 90-minute integration route", async () => {
  const data = await read("../app/session-six-data.ts");
  assert.match(data, /sessionSixTotalMinutes = 90/);
  assert.match(data, /sessionSixOrientationMinutes = 15/);
  assert.match(data, /sessionSixApplicationMinutes = 75/);

  const agendaBlock = data.slice(data.indexOf("sessionSixAgenda"), data.indexOf("sessionConnections"));
  const agendaMinutes = [...agendaBlock.matchAll(/minutes: (\d+)/g)].reduce((total, match) => total + Number(match[1]), 0);
  assert.equal(agendaMinutes, 90);
  for (const session of ["Sesión 1", "Sesión 2", "Sesión 3", "Sesión 4", "Sesión 5"]) {
    assert.match(data, new RegExp(session));
  }
  for (const step of ["Contexto", "Propósito", "Actividad", "Evidencia", "Instrumento", "Datos", "Hallazgo", "Decisión", "Nueva evidencia"]) {
    assert.match(data, new RegExp(`"${step}"`));
  }
});

test("all three support routes share the same evidence core and the audit has eight stable keys", async () => {
  const data = await read("../app/session-six-data.ts");
  for (const route of ["basica", "intermedia", "avanzada"]) assert.match(data, new RegExp(`key: "${route}"`));
  assert.match(data, /El mismo núcleo, con diferente nivel de apoyo|mismo núcleo/i);

  const expectedKeys = [
    "context_alignment",
    "source_traceability",
    "sequence_coherence",
    "evidence_alignment",
    "instrument_alignment",
    "data_limits",
    "teacher_decision",
    "inclusion_follow_up",
  ];
  const checklistBlock = data.slice(data.indexOf("auditChecklist"), data.indexOf("AuditChecklistKey"));
  assert.equal((checklistBlock.match(/key: "/g) || []).length, 8);
  for (const key of expectedKeys) assert.match(checklistBlock, new RegExp(`key: "${key}"`));
});

test("Session 6 UI connects attendance, direct portfolio recovery, editable prompt and final evidence", async () => {
  const source = await read("../app/session-six.tsx");
  assert.match(source, /fetch\("\/api\/session-six"/);
  assert.match(source, /action: "attendance"/);
  assert.match(source, /action: "evidence"/);
  assert.match(source, /<PortfolioRecovery initialEmail=\{registeredAttendance\.email \|\| attendance\.email\} \/>/);
  assert.match(source, /<EvidencePdfDownload session="S6"/);
  assert.doesNotMatch(source, /evidenceState\.kind === "success" \? <EvidencePdfDownload/);
  assert.match(source, /Actualizar prompt base/);
  assert.match(source, /Copiar prompt/);
  assert.match(source, /https:\/\/chatgpt\.com\//);
  assert.match(source, /https:\/\/gemini\.google\.com\//);
  assert.match(source, /https:\/\/notebooklm\.google\.com\//);
  assert.equal((source.match(/target="_blank"/g) || []).length, 3);
  assert.match(source, /Aceptar, adaptar o rechazar/);
  assert.match(source, /Guardar avance sin acreditar/);
  assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(source, /aula-ia-s6-evidence-draft/);
  assert.match(source, /aula-ia-s6-audit-checks/);
  assert.match(source, /const attendanceEmail = String\(savedAttendance\.email \|\| ""\)/);
  assert.match(source, /const evidenceEmail = String\(savedDraft\.email \|\| savedAttendance\.email \|\| ""\)/);
  assert.match(source, /const attendanceEmail = registeredAttendance\.email/);
  assert.match(source, /evidenceEmail !== attendanceEmail/);
  assert.match(source, /debe coincidir con el registrado en la asistencia/);
  assert.doesNotMatch(source, /localStorage\.setItem\(ATTENDANCE_KEY, JSON\.stringify\(attendance\)\)/);
  assert.match(source, /window\.confirm\("Actualizar el prompt base reemplazará la edición visible/);
  assert.match(source, /Tu prompt editado se conservó/);
});

test("Session 6 evidence payload preserves every approved field without route-specific requirements", async () => {
  const source = await read("../app/session-six.tsx");
  const fields = [
    "fullName",
    "email",
    "route",
    "projectTitle",
    "teachingNeed",
    "educationalLevel",
    "subject",
    "pedagogicalContext",
    "learningPurpose",
    "sourceTraceability",
    "prompt",
    "activitySequence",
    "assessmentEvidence",
    "instrumentCriteria",
    "analysisLimits",
    "teacherDecision",
    "followUpEvidence",
    "adaptation",
    "aiContribution",
    "teacherReview",
    "implementationStep",
    "checklist",
  ];
  for (const field of fields) assert.match(source, new RegExp(`\\b${field}\\b`));
  assert.doesNotMatch(source, /route === "(?:intermedia|avanzada)"[^\n]+required|\bsupportRoute\b/);
});

test("Session 6 route and metadata use the verified institutional cover", async () => {
  const [page, source] = await Promise.all([
    read("../app/sesion-6/page.tsx"),
    read("../app/session-six.tsx"),
  ]);
  for (const text of [page, source]) {
    assert.match(text, /hero-integracion-producto-final-s6\.png/);
  }
  assert.match(page, /Sesión 6 · Integración y producto final/);
  assert.match(page, /summary_large_image/);
  assert.match(source, /<SessionNavigation current=\{6\} position="top" \/>/);
  assert.match(source, /<SessionNavigation current=\{6\} position="bottom" \/>/);
});
