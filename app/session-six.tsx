"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { type FormEvent, useEffect, useState } from "react";
import EvidencePdfDownload from "./evidence-pdf-download";
import PortfolioRecovery from "./portfolio-recovery";
import SessionNavigation from "./session-navigation";
import {
  auditChecklist,
  buildIntegrationPrompt,
  finalEvidenceFields,
  integrationChain,
  reviewOptions,
  sessionConnections,
  sessionSixAgenda,
  sessionSixApplicationMinutes,
  sessionSixFaq,
  sessionSixOrientationMinutes,
  sessionSixTitle,
  sessionSixTotalMinutes,
  supportRoutes,
  type AuditChecklistKey,
  type SupportRoute,
} from "./session-six-data";
import styles from "./session-six.module.css";

type SaveState = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
  code?: string;
  pdfAccessCode?: string;
};

type AttendanceDraft = {
  fullName: string;
  email: string;
  institution: string;
  role: string;
  consent: boolean;
};

type RegisteredAttendance = Pick<AttendanceDraft, "fullName" | "email">;

type EvidenceDraft = {
  email: string;
  route: SupportRoute;
  projectTitle: string;
  teachingNeed: string;
  educationalLevel: string;
  subject: string;
  pedagogicalContext: string;
  learningPurpose: string;
  sourceTraceability: string;
  prompt: string;
  activitySequence: string;
  assessmentEvidence: string;
  instrumentCriteria: string;
  analysisLimits: string;
  teacherDecision: string;
  followUpEvidence: string;
  adaptation: string;
  aiContribution: string;
  teacherReview: string;
  implementationStep: string;
};

type EvidenceIssue = {
  key: keyof EvidenceDraft | "fullName" | "checklist";
  fieldId: string;
  label: string;
  section: string;
  message: string;
};

const ATTENDANCE_KEY = "aula-ia-s6-attendance";
const DRAFT_KEY = "aula-ia-s6-evidence-draft";
const CHECKS_KEY = "aula-ia-s6-audit-checks";
const PROGRESS_KEY = "aula-ia-s6-progress";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialAttendance: AttendanceDraft = {
  fullName: "",
  email: "",
  institution: "",
  role: "Docente",
  consent: false,
};

function initialEvidence(): EvidenceDraft {
  const base = {
    email: "",
    route: "basica" as const,
    projectTitle: "",
    teachingNeed: "",
    educationalLevel: "",
    subject: "",
    pedagogicalContext: "",
    learningPurpose: "",
    sourceTraceability: "",
  };
  return {
    ...base,
    prompt: buildIntegrationPrompt(base),
    activitySequence: "",
    assessmentEvidence: "",
    instrumentCriteria: "",
    analysisLimits: "",
    teacherDecision: "",
    followUpEvidence: "",
    adaptation: "",
    aiContribution: "",
    teacherReview: "",
    implementationStep: "",
  };
}

const requiredFields: ReadonlyArray<{
  key: keyof EvidenceDraft;
  id: string;
  label: string;
  section: string;
}> = [
  { key: "projectTitle", id: "s6-project-title", label: "Título del proyecto", section: "Laboratorio 1" },
  { key: "teachingNeed", id: "s6-teaching-need", label: "Necesidad docente", section: "Laboratorio 1" },
  { key: "educationalLevel", id: "s6-educational-level", label: "Nivel educativo", section: "Laboratorio 1" },
  { key: "subject", id: "s6-subject", label: "Asignatura o área", section: "Laboratorio 1" },
  { key: "pedagogicalContext", id: "s6-context", label: "Contexto pedagógico", section: "Laboratorio 1" },
  { key: "learningPurpose", id: "s6-purpose", label: "Propósito de aprendizaje", section: "Laboratorio 1" },
  { key: "sourceTraceability", id: "s6-source-traceability", label: "Fuentes y trazabilidad", section: "Laboratorio 1" },
  { key: "prompt", id: "s6-prompt", label: "Prompt integrado y revisado", section: "Laboratorio 1" },
  { key: "activitySequence", id: "s6-activity-sequence", label: "Secuencia de actividades", section: "Laboratorio 1" },
  { key: "assessmentEvidence", id: "s6-assessment-evidence", label: "Evidencia esperada", section: "Laboratorio 1" },
  { key: "instrumentCriteria", id: "s6-instrument-criteria", label: "Instrumento y criterios de evaluación", section: "Laboratorio 1" },
  { key: "analysisLimits", id: "s6-analysis-limits", label: "Lectura de datos, faltantes y límites", section: "Laboratorio 2" },
  { key: "teacherDecision", id: "s6-teacher-decision", label: "Decisión docente", section: "Laboratorio 2" },
  { key: "followUpEvidence", id: "s6-follow-up", label: "Nueva evidencia de seguimiento", section: "Laboratorio 2" },
  { key: "adaptation", id: "s6-adaptation", label: "Adaptación para inclusión o apoyo", section: "Laboratorio 2" },
  { key: "aiContribution", id: "s6-ai-contribution", label: "Aporte de la IA", section: "Revisión docente" },
  { key: "teacherReview", id: "s6-teacher-review", label: "Ajustes y justificación docente", section: "Revisión docente" },
  { key: "implementationStep", id: "s6-implementation-step", label: "Primer paso de aplicación", section: "Evidencia final" },
];

async function postSessionSix(payload: Record<string, unknown>) {
  const response = await fetch("/api/session-six", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "No fue posible guardar la información.");
  }
  return result;
}

function StatusBanner({ state }: { state: SaveState }) {
  if (state.kind === "idle") return null;
  return (
    <div className={`${styles.status} ${styles[state.kind]}`} role="status" aria-live="polite">
      <strong>{state.kind === "success" ? "Registro confirmado" : state.kind === "error" ? "Revisa la información" : "Procesando"}</strong>
      {state.message ? <p>{state.message}</p> : null}
      {state.code ? <code>{state.code}</code> : null}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function ToolLinks() {
  return (
    <div className={styles.toolLinks} aria-label="Abrir asistentes de IA en una pestaña nueva">
      <a href="https://chatgpt.com/" target="_blank" rel="noreferrer noopener">Abrir ChatGPT</a>
      <a href="https://gemini.google.com/" target="_blank" rel="noreferrer noopener">Abrir Gemini</a>
      <a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer noopener">Abrir NotebookLM</a>
    </div>
  );
}

export function SessionSix() {
  const [attendance, setAttendance] = useState<AttendanceDraft>(initialAttendance);
  const [registeredAttendance, setRegisteredAttendance] = useState<RegisteredAttendance>({ fullName: "", email: "" });
  const [attendanceState, setAttendanceState] = useState<SaveState>({ kind: "idle" });
  const [evidence, setEvidence] = useState<EvidenceDraft>(initialEvidence);
  const [checks, setChecks] = useState<Partial<Record<AuditChecklistKey, boolean>>>({});
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [progressMessage, setProgressMessage] = useState("");
  const [validationIssues, setValidationIssues] = useState<EvidenceIssue[]>([]);
  const [copied, setCopied] = useState(false);
  const [promptNotice, setPromptNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedAttendance = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || "{}") as Partial<AttendanceDraft>;
        const savedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as Partial<EvidenceDraft>;
        const savedChecks = JSON.parse(localStorage.getItem(CHECKS_KEY) || "{}") as Partial<Record<AuditChecklistKey, boolean>>;
        const attendanceEmail = String(savedAttendance.email || "").trim().toLowerCase();
        const evidenceEmail = String(savedDraft.email || savedAttendance.email || "").trim().toLowerCase();
        setAttendance({ ...initialAttendance, ...savedAttendance, email: attendanceEmail });
        setRegisteredAttendance({ fullName: String(savedAttendance.fullName || ""), email: attendanceEmail });
        setEvidence({ ...initialEvidence(), ...savedDraft, email: evidenceEmail });
        setChecks(savedChecks);
      } catch {
        setAttendance(initialAttendance);
        setRegisteredAttendance({ fullName: "", email: "" });
        setEvidence(initialEvidence());
        setChecks({});
      } finally {
        setHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(evidence));
    localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  }, [checks, evidence, hydrated]);

  function updateEvidence(patch: Partial<EvidenceDraft>) {
    const keys = new Set(Object.keys(patch));
    setEvidence((current) => ({ ...current, ...patch }));
    setValidationIssues((current) => current.filter((issue) => !keys.has(issue.key)));
    setProgressMessage("");
    if (keys.has("prompt")) setPromptNotice("");
    setEvidenceState((current) => current.kind === "success"
      ? { kind: "idle", pdfAccessCode: current.pdfAccessCode }
      : current);
  }

  async function handleAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = attendance.email.trim().toLowerCase();
    if (!attendance.fullName.trim() || !EMAIL_PATTERN.test(email) || !attendance.institution.trim() || !attendance.consent) {
      setAttendanceState({ kind: "error", message: "Completa nombre, correo válido, institución y consentimiento." });
      return;
    }
    setAttendanceState({ kind: "loading", message: "Registrando tu entrada a la Sesión 6…" });
    try {
      const result = await postSessionSix({ action: "attendance", ...attendance, email });
      const linkedAttendance = { ...attendance, email };
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(linkedAttendance));
      setAttendance(linkedAttendance);
      setRegisteredAttendance({ fullName: linkedAttendance.fullName.trim(), email });
      updateEvidence({ email });
      setAttendanceState({
        kind: "success",
        message: typeof result.message === "string" ? result.message : "Asistencia registrada. Usa este mismo correo para la evidencia final.",
        code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined,
      });
    } catch (error) {
      setAttendanceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible registrar la asistencia." });
    }
  }

  function selectRoute(route: SupportRoute) {
    if (route === evidence.route) return;
    const currentBase = buildIntegrationPrompt(evidence);
    if (evidence.prompt === currentBase) {
      updateEvidence({ route, prompt: buildIntegrationPrompt({ ...evidence, route }) });
      setPromptNotice("La ruta cambió y el prompt base se actualizó sin borrar ningún otro campo.");
      return;
    }
    updateEvidence({ route });
    setPromptNotice("La ruta cambió. Tu prompt editado se conservó; usa «Actualizar prompt base» solo si deseas reemplazarlo con una versión ligada a la nueva ruta.");
  }

  function rebuildPrompt() {
    const nextPrompt = buildIntegrationPrompt(evidence);
    if (evidence.prompt.trim() && evidence.prompt !== nextPrompt) {
      const replace = window.confirm("Actualizar el prompt base reemplazará la edición visible. ¿Deseas continuar?");
      if (!replace) return;
    }
    updateEvidence({ prompt: nextPrompt });
    setPromptNotice("Prompt base actualizado con la ruta y los datos actuales.");
    window.requestAnimationFrame(() => document.getElementById("s6-prompt")?.focus());
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(evidence.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function chooseReview(text: string) {
    updateEvidence({ teacherReview: evidence.teacherReview.trim() ? `${evidence.teacherReview}\n\n${text}` : text });
    window.requestAnimationFrame(() => document.getElementById("s6-teacher-review")?.focus());
  }

  function collectIssues() {
    const issues: EvidenceIssue[] = [];
    const attendanceEmail = registeredAttendance.email.trim().toLowerCase();
    const evidenceEmail = evidence.email.trim().toLowerCase();
    if (!(registeredAttendance.fullName || attendance.fullName).trim()) {
      issues.push({ key: "fullName", fieldId: "s6-evidence-name", label: "Nombre usado en la asistencia", section: "Evidencia final", message: "Escribe tu nombre completo." });
    }
    if (!EMAIL_PATTERN.test(evidenceEmail)) {
      issues.push({ key: "email", fieldId: "s6-evidence-email", label: "Correo usado en la asistencia", section: "Evidencia final", message: "Escribe el mismo correo válido que registraste en la asistencia." });
    } else if (attendanceEmail && evidenceEmail !== attendanceEmail) {
      issues.push({ key: "email", fieldId: "s6-evidence-email", label: "Correo usado en la asistencia", section: "Evidencia final", message: "Este correo debe coincidir con el registrado en la asistencia de la Sesión 6." });
    }
    for (const field of requiredFields) {
      if (!String(evidence[field.key] || "").trim()) {
        issues.push({ key: field.key, fieldId: field.id, label: field.label, section: field.section, message: "Este campo está vacío." });
      }
    }
    const missingChecks = auditChecklist.filter((item) => !checks[item.key]);
    if (missingChecks.length) {
      issues.push({ key: "checklist", fieldId: "s6-audit-checklist", label: "Auditoría de ocho criterios", section: "Evidencia final", message: `Falta confirmar ${missingChecks.length} ${missingChecks.length === 1 ? "criterio" : "criterios"}.` });
    }
    return issues;
  }

  function focusIssue(issue: EvidenceIssue) {
    window.requestAnimationFrame(() => {
      const element = document.getElementById(issue.fieldId);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus({ preventScroll: true });
    });
  }

  function issueFor(key: EvidenceIssue["key"]) {
    return validationIssues.find((issue) => issue.key === key);
  }

  function validationClass(key: EvidenceIssue["key"]) {
    return issueFor(key) ? styles.fieldError : "";
  }

  function saveProgress() {
    const savedAt = new Date().toISOString();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(evidence));
    localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ savedAt, email: evidence.email.trim().toLowerCase(), status: "avance-local" }));
    setProgressMessage("Avance guardado en este dispositivo. Aún no genera folio ni acredita la Sesión 6.");
  }

  async function handleEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = collectIssues();
    setValidationIssues(issues);
    if (issues.length) {
      setEvidenceState({ kind: "error", message: `Faltan ${issues.length} ${issues.length === 1 ? "requisito" : "requisitos"}. Están enumerados y tu avance permanece guardado.` });
      focusIssue(issues[0]);
      return;
    }

    setEvidenceState({ kind: "loading", message: "Guardando tu producto final de la Sesión 6…" });
    try {
      const checklist = Object.fromEntries(auditChecklist.map((item) => [item.key, Boolean(checks[item.key])]));
      const result = await postSessionSix({ action: "evidence", fullName: (registeredAttendance.fullName || attendance.fullName).trim(), ...evidence, email: evidence.email.trim().toLowerCase(), checklist });
      setEvidenceState({
        kind: "success",
        message: typeof result.message === "string" ? result.message : "Producto final guardado correctamente.",
        code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined,
        pdfAccessCode: typeof result.pdfAccessCode === "string" ? result.pdfAccessCode : undefined,
      });
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ savedAt: new Date().toISOString(), email: evidence.email.trim().toLowerCase(), status: "evidencia-acreditada" }));
    } catch (error) {
      setEvidenceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar. Tu borrador permanece en este dispositivo." });
    }
  }

  return (
    <main className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="AULA-IA, volver al inicio"><span aria-hidden="true">AI</span><span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span></a>
        <nav aria-label="Navegación de Sesión 6"><a href="#recorrido">Recorrido</a><a href="#laboratorio-1">Integración</a><a href="#laboratorio-2">Auditoría</a><a href="#evidencia">Evidencia final</a></nav>
      </header>
      <SessionNavigation current={6} position="top" />

      <div id="contenido">
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Sesión 6 de 6 · Cierre integrador</p>
            <h1>Integra, audita y lleva tu proyecto a la práctica</h1>
            <p className={styles.lede}>{sessionSixTitle}. Reúne lo construido en las cinco sesiones anteriores y conviértelo en una intervención docente congruente, verificable y decidida por ti.</p>
            <div className={styles.metrics}><span><strong>{sessionSixTotalMinutes}</strong> minutos</span><span><strong>{sessionSixOrientationMinutes}</strong> de orientación</span><span><strong>{sessionSixApplicationMinutes}</strong> de aplicación</span><span><strong>1</strong> producto integrado</span></div>
            <div className={styles.heroActions}><a className={styles.primaryButton} href="#registro-principal">Registrar asistencia</a><a className={styles.secondaryButton} href="#laboratorio-1">Ver el producto final</a></div>
            <p className={styles.microcopy}>La IA puede organizar y proponer. Verificar, justificar y decidir sigue siendo responsabilidad docente.</p>
          </div>
          <div className={styles.heroVisual}>
            <figure className={styles.heroImage}>
              <img src="/recursos/sesion-6/hero-integracion-producto-final-s6.png" alt="Docentes integran contexto, fuentes, secuencia, evaluación e instrumento en un proyecto didáctico final" width="1536" height="1024" />
              <figcaption>Los productos de las sesiones anteriores se recuperan, revisan y conectan en una intervención viable.</figcaption>
            </figure>
            <div className={styles.heroMap} aria-label="Ruta de integración del proyecto final">
              {integrationChain.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>)}
            </div>
          </div>
        </section>

        <section className={styles.section} id="registro-principal">
          <SectionHeading eyebrow="Asistencia oficial" title="Registra tu entrada a la Sesión 6" description="Utiliza el mismo correo de las sesiones anteriores para vincular tu asistencia, producto final, folio y PDF." />
          <form className={`${styles.form} ${styles.cardForm}`} onSubmit={handleAttendance}>
            <div className={styles.twoColumns}>
              <label>Nombre completo<input required autoComplete="name" value={attendance.fullName} onChange={(event) => setAttendance({ ...attendance, fullName: event.target.value })} /></label>
              <label>Correo electrónico<input required type="email" autoComplete="email" value={attendance.email} onChange={(event) => setAttendance({ ...attendance, email: event.target.value })} /></label>
              <label>Institución<input required autoComplete="organization" value={attendance.institution} onChange={(event) => setAttendance({ ...attendance, institution: event.target.value })} /></label>
              <label>Función<select value={attendance.role} onChange={(event) => setAttendance({ ...attendance, role: event.target.value })}><option>Docente</option><option>Directivo</option><option>Apoyo técnico-pedagógico</option><option>Estudiante normalista</option><option>Otra función educativa</option></select></label>
            </div>
            <label className={styles.consent}><input type="checkbox" checked={attendance.consent} onChange={(event) => setAttendance({ ...attendance, consent: event.target.checked })} /><span>Acepto el uso de estos datos para asistencia, seguimiento y acreditación. No se mostrarán al grupo.</span></label>
            <button className={styles.primaryButton} type="submit" disabled={attendanceState.kind === "loading"}>{attendanceState.kind === "loading" ? "Registrando…" : "Registrar asistencia S6"}</button>
            <StatusBanner state={attendanceState} />
          </form>
        </section>

        <PortfolioRecovery initialEmail={registeredAttendance.email || attendance.email} />

        <section className={styles.section} id="recorrido">
          <SectionHeading eyebrow="Recuperación del curso" title="Cinco productos se convierten en un solo proyecto" description="No empiezas de cero. Cada sesión aporta una pieza que ahora revisarás como parte de una misma intervención." />
          <div className={styles.connectionGrid}>{sessionConnections.map((item) => <article key={item.session}><span>{item.session}</span><h3>{item.title}</h3><p>{item.contribution}</p></article>)}</div>
        </section>

        <section className={`${styles.section} ${styles.agendaSection}`} id="agenda">
          <SectionHeading eyebrow="Ruta de 90 minutos" title="15 minutos de orientación y 75 de aplicación" description="La mayor parte del tiempo se destina a recuperar, integrar, auditar, revisar y registrar el producto final." />
          <ol className={styles.agenda}>{sessionSixAgenda.map((item) => <li key={item.range}><span>{item.range} min</span><div><strong>{item.title}</strong><p>{item.mode}</p></div><em>{item.minutes} min</em></li>)}</ol>
        </section>

        <section className={styles.section} id="rutas">
          <SectionHeading eyebrow="Selector de acompañamiento" title="El mismo núcleo, con diferente nivel de apoyo" description="La ruta no cambia el valor de la acreditación. Solo modifica el andamiaje con el que integras y revisas el proyecto." />
          <div className={styles.routeGrid} role="group" aria-label="Elegir ruta de acompañamiento">
            {supportRoutes.map((route) => <article key={route.key} className={evidence.route === route.key ? styles.routeSelected : ""}><span>Ruta {route.label}</span><h3>{route.subtitle}</h3><p>{route.description}</p><ul>{route.support.map((item) => <li key={item}>{item}</li>)}</ul><button type="button" aria-pressed={evidence.route === route.key} onClick={() => selectRoute(route.key)}>{evidence.route === route.key ? "Ruta elegida" : `Elegir ruta ${route.label}`}</button></article>)}
          </div>
          <p className={styles.note} role="status">Ruta actual: <strong>{supportRoutes.find((route) => route.key === evidence.route)?.label}</strong>. Cambiar de ruta conserva todos tus textos y confirmaciones.</p>
          {promptNotice ? <p className={styles.promptNotice} role="status">{promptNotice}</p> : null}
        </section>

        <section className={styles.section} id="laboratorio-1">
          <SectionHeading eyebrow="Laboratorio 1 · 30 minutos" title="Ensambla tu Proyecto didáctico integrado AULA-IA" description="Recupera tus productos anteriores, completa lo que falte y comprueba que contexto, propósito, actividad, evidencia e instrumento forman una misma propuesta." />
          <div className={`${styles.form} ${styles.labPanel}`}>
            <div className={styles.twoColumns}>
              <label className={validationClass("projectTitle")}>Título del proyecto<input id="s6-project-title" aria-invalid={Boolean(issueFor("projectTitle"))} value={evidence.projectTitle} onChange={(event) => updateEvidence({ projectTitle: event.target.value })} placeholder="Una intervención concreta y reconocible" />{issueFor("projectTitle") ? <span className={styles.validationMessage}>{issueFor("projectTitle")?.message}</span> : null}</label>
              <label className={validationClass("teachingNeed")}>Necesidad docente observable<input id="s6-teaching-need" aria-invalid={Boolean(issueFor("teachingNeed"))} value={evidence.teachingNeed} onChange={(event) => updateEvidence({ teachingNeed: event.target.value })} placeholder="¿Qué situación buscas atender?" />{issueFor("teachingNeed") ? <span className={styles.validationMessage}>{issueFor("teachingNeed")?.message}</span> : null}</label>
              <label className={validationClass("educationalLevel")}>Nivel educativo<input id="s6-educational-level" aria-invalid={Boolean(issueFor("educationalLevel"))} value={evidence.educationalLevel} onChange={(event) => updateEvidence({ educationalLevel: event.target.value })} />{issueFor("educationalLevel") ? <span className={styles.validationMessage}>{issueFor("educationalLevel")?.message}</span> : null}</label>
              <label className={validationClass("subject")}>Asignatura o área<input id="s6-subject" aria-invalid={Boolean(issueFor("subject"))} value={evidence.subject} onChange={(event) => updateEvidence({ subject: event.target.value })} />{issueFor("subject") ? <span className={styles.validationMessage}>{issueFor("subject")?.message}</span> : null}</label>
            </div>
            <label className={validationClass("pedagogicalContext")}>Contexto pedagógico sin datos personales<textarea id="s6-context" aria-invalid={Boolean(issueFor("pedagogicalContext"))} rows={5} value={evidence.pedagogicalContext} onChange={(event) => updateEvidence({ pedagogicalContext: event.target.value })} placeholder="Grupo, tiempo, recursos, condiciones y necesidad general." />{issueFor("pedagogicalContext") ? <span className={styles.validationMessage}>{issueFor("pedagogicalContext")?.message}</span> : null}</label>
            <label className={validationClass("learningPurpose")}>Propósito de aprendizaje observable<textarea id="s6-purpose" aria-invalid={Boolean(issueFor("learningPurpose"))} rows={3} value={evidence.learningPurpose} onChange={(event) => updateEvidence({ learningPurpose: event.target.value })} />{issueFor("learningPurpose") ? <span className={styles.validationMessage}>{issueFor("learningPurpose")?.message}</span> : null}</label>
            <label className={validationClass("sourceTraceability")}>Fuentes, trazabilidad y aspectos por verificar<textarea id="s6-source-traceability" aria-invalid={Boolean(issueFor("sourceTraceability"))} rows={5} value={evidence.sourceTraceability} onChange={(event) => updateEvidence({ sourceTraceability: event.target.value })} placeholder="Identifica las fuentes; separa lo sustentado, lo propuesto y lo pendiente de verificación." />{issueFor("sourceTraceability") ? <span className={styles.validationMessage}>{issueFor("sourceTraceability")?.message}</span> : null}</label>
          </div>

          <div className={styles.promptPanel}>
            <div className={styles.promptHeader}><div><p className={styles.eyebrow}>Prompt editable</p><h3>Integra el proyecto sin delegar la decisión</h3></div><div><button type="button" onClick={rebuildPrompt}>Actualizar prompt base</button><button type="button" onClick={() => void copyPrompt()}>{copied ? "Prompt copiado" : "Copiar prompt"}</button></div></div>
            <label className={validationClass("prompt")}>Prompt integrado y revisado<textarea id="s6-prompt" aria-invalid={Boolean(issueFor("prompt"))} rows={18} value={evidence.prompt} onChange={(event) => updateEvidence({ prompt: event.target.value })} placeholder="Conserva aquí la versión que realmente utilizarías y precisa contexto, límites y formato esperado." />{issueFor("prompt") ? <span className={styles.validationMessage}>{issueFor("prompt")?.message}</span> : null}</label>
          </div>
          <ToolLinks />

          <div className={`${styles.form} ${styles.labPanel}`}>
            <label className={validationClass("activitySequence")}>Secuencia de actividades<textarea id="s6-activity-sequence" aria-invalid={Boolean(issueFor("activitySequence"))} rows={7} value={evidence.activitySequence} onChange={(event) => updateEvidence({ activitySequence: event.target.value })} placeholder="Inicio, desarrollo, cierre, tiempos y acciones del docente y del alumnado." />{issueFor("activitySequence") ? <span className={styles.validationMessage}>{issueFor("activitySequence")?.message}</span> : null}</label>
            <label className={validationClass("assessmentEvidence")}>Evidencia de aprendizaje esperada<textarea id="s6-assessment-evidence" aria-invalid={Boolean(issueFor("assessmentEvidence"))} rows={5} value={evidence.assessmentEvidence} onChange={(event) => updateEvidence({ assessmentEvidence: event.target.value })} />{issueFor("assessmentEvidence") ? <span className={styles.validationMessage}>{issueFor("assessmentEvidence")?.message}</span> : null}</label>
            <label className={validationClass("instrumentCriteria")}>Instrumento y criterios observables<textarea id="s6-instrument-criteria" aria-invalid={Boolean(issueFor("instrumentCriteria"))} rows={10} value={evidence.instrumentCriteria} onChange={(event) => updateEvidence({ instrumentCriteria: event.target.value })} placeholder="Describe el instrumento, su aplicación y los criterios que permitirán valorar la evidencia." />{issueFor("instrumentCriteria") ? <span className={styles.validationMessage}>{issueFor("instrumentCriteria")?.message}</span> : null}</label>
          </div>
        </section>

        <section className={styles.section} id="laboratorio-2">
          <SectionHeading eyebrow="Laboratorio 2 · 20 minutos" title="Audita congruencia, límites y posibilidad de seguimiento" description="No se trata de hacer el documento más largo, sino de detectar contradicciones antes de llevarlo al aula." />
          <div className={styles.auditGrid}>{auditChecklist.map((item, index) => <article key={item.key}><span>{String(index + 1).padStart(2, "0")}</span><p>{item.label}</p></article>)}</div>
          <div className={`${styles.form} ${styles.labPanel}`}>
            <label className={validationClass("analysisLimits")}>Lectura de datos, faltantes y límites<textarea id="s6-analysis-limits" aria-invalid={Boolean(issueFor("analysisLimits"))} rows={8} value={evidence.analysisLimits} onChange={(event) => updateEvidence({ analysisLimits: event.target.value })} placeholder="Separa observaciones e inferencias; incluye denominadores, faltantes y lo que los datos no permiten afirmar." />{issueFor("analysisLimits") ? <span className={styles.validationMessage}>{issueFor("analysisLimits")?.message}</span> : null}</label>
            <div className={styles.twoColumns}>
              <label className={validationClass("teacherDecision")}>Decisión docente condicionada<textarea id="s6-teacher-decision" aria-invalid={Boolean(issueFor("teacherDecision"))} rows={6} value={evidence.teacherDecision} onChange={(event) => updateEvidence({ teacherDecision: event.target.value })} />{issueFor("teacherDecision") ? <span className={styles.validationMessage}>{issueFor("teacherDecision")?.message}</span> : null}</label>
              <label className={validationClass("followUpEvidence")}>Nueva evidencia de seguimiento<textarea id="s6-follow-up" aria-invalid={Boolean(issueFor("followUpEvidence"))} rows={6} value={evidence.followUpEvidence} onChange={(event) => updateEvidence({ followUpEvidence: event.target.value })} placeholder="¿Qué recogerás para saber si la decisión funcionó?" />{issueFor("followUpEvidence") ? <span className={styles.validationMessage}>{issueFor("followUpEvidence")?.message}</span> : null}</label>
            </div>
            <label className={validationClass("adaptation")}>Adaptación para inclusión o apoyo<textarea id="s6-adaptation" aria-invalid={Boolean(issueFor("adaptation"))} rows={5} value={evidence.adaptation} onChange={(event) => updateEvidence({ adaptation: event.target.value })} />{issueFor("adaptation") ? <span className={styles.validationMessage}>{issueFor("adaptation")?.message}</span> : null}</label>
          </div>
        </section>

        <section className={`${styles.section} ${styles.reviewSection}`} id="revision">
          <SectionHeading eyebrow="Revisión docente · 15 minutos" title="Aceptar, adaptar o rechazar, siempre con justificación" description="Ninguna salida de IA pasa directamente al producto final. Registra qué aportó y qué decisión tomaste frente a ese aporte." />
          <div className={styles.reviewButtons}>{reviewOptions.map((option) => <button type="button" key={option.key} onClick={() => chooseReview(option.prompt)}><strong>{option.label}</strong><span>{option.prompt}</span></button>)}</div>
          <div className={`${styles.form} ${styles.labPanel}`}>
            <label className={validationClass("aiContribution")}>¿Qué aportó la IA?<textarea id="s6-ai-contribution" aria-invalid={Boolean(issueFor("aiContribution"))} rows={5} value={evidence.aiContribution} onChange={(event) => updateEvidence({ aiContribution: event.target.value })} placeholder="Organización, alternativas, redacción inicial o aspecto que ayudó a revisar." />{issueFor("aiContribution") ? <span className={styles.validationMessage}>{issueFor("aiContribution")?.message}</span> : null}</label>
            <label className={validationClass("teacherReview")}>¿Qué aceptaste, adaptaste o rechazaste y por qué?<textarea id="s6-teacher-review" aria-invalid={Boolean(issueFor("teacherReview"))} rows={8} value={evidence.teacherReview} onChange={(event) => updateEvidence({ teacherReview: event.target.value })} />{issueFor("teacherReview") ? <span className={styles.validationMessage}>{issueFor("teacherReview")?.message}</span> : null}</label>
          </div>
        </section>

        <section className={styles.section} id="evidencia">
          <SectionHeading eyebrow="Producto final acreditable" title="Registra tu Proyecto didáctico integrado AULA-IA" description="Las tres rutas entregan el mismo núcleo. El guardado final requiere el correo de asistencia, los componentes escritos y la auditoría de ocho criterios." />
          <div className={styles.evidenceOverview}><div><h3>Tu evidencia reúne</h3><ol>{finalEvidenceFields.map((field) => <li key={field}>{field}</li>)}</ol></div><div><p>Producto</p><strong>Proyecto didáctico integrado AULA-IA</strong><p>Responsabilidad</p><strong>Revisión y decisión docente</strong><p>Privacidad</p><strong>Sin datos personales del alumnado</strong></div></div>

          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence} noValidate>
            <div className={styles.twoColumns}>
              <label className={validationClass("fullName")}>Nombre usado en la asistencia<input id="s6-evidence-name" aria-invalid={Boolean(issueFor("fullName"))} autoComplete="name" readOnly={Boolean(registeredAttendance.fullName)} value={registeredAttendance.fullName || attendance.fullName} onChange={(event) => { setAttendance({ ...attendance, fullName: event.target.value }); setValidationIssues((current) => current.filter((issue) => issue.key !== "fullName")); setEvidenceState((current) => current.kind === "success" ? { kind: "idle", pdfAccessCode: current.pdfAccessCode } : current); }} />{issueFor("fullName") ? <span className={styles.validationMessage}>{issueFor("fullName")?.message}</span> : null}</label>
              <label className={validationClass("email")}>Correo usado en la asistencia<input id="s6-evidence-email" aria-invalid={Boolean(issueFor("email"))} type="email" autoComplete="email" value={evidence.email} onChange={(event) => updateEvidence({ email: event.target.value })} />{issueFor("email") ? <span className={styles.validationMessage}>{issueFor("email")?.message}</span> : null}</label>
            </div>
            <label className={validationClass("implementationStep")}>Primer paso concreto para aplicar o continuar el proyecto<textarea id="s6-implementation-step" aria-invalid={Boolean(issueFor("implementationStep"))} rows={5} value={evidence.implementationStep} onChange={(event) => updateEvidence({ implementationStep: event.target.value })} placeholder="Qué harás, con qué grupo o contexto, qué verificarás antes y qué evidencia observarás." />{issueFor("implementationStep") ? <span className={styles.validationMessage}>{issueFor("implementationStep")?.message}</span> : null}</label>

            <fieldset id="s6-audit-checklist" className={`${styles.checklist} ${validationClass("checklist")}`} tabIndex={-1}>
              <legend>Auditoría final · {auditChecklist.filter((item) => checks[item.key]).length} de {auditChecklist.length} confirmados</legend>
              {auditChecklist.map((item) => <label key={item.key}><input type="checkbox" checked={Boolean(checks[item.key])} onChange={(event) => { const next = { ...checks, [item.key]: event.target.checked }; setChecks(next); setValidationIssues((current) => auditChecklist.every((criterion) => next[criterion.key]) ? current.filter((issue) => issue.key !== "checklist") : current); setEvidenceState((current) => current.kind === "success" ? { kind: "idle", pdfAccessCode: current.pdfAccessCode } : current); }} /><span>{item.label}</span></label>)}
              {issueFor("checklist") ? <span className={styles.validationMessage}>{issueFor("checklist")?.message}</span> : null}
            </fieldset>

            {validationIssues.length ? <div className={styles.validationSummary} role="alert"><h3>Faltan datos para guardar</h3><p>Completa únicamente los campos vacíos o pendientes. Selecciona cualquiera para ir directamente a él.</p><ol>{validationIssues.map((issue) => <li key={`${issue.key}-${issue.fieldId}`}><button type="button" onClick={() => focusIssue(issue)}><strong>{issue.section} → {issue.label}</strong><span>{issue.message}</span></button></li>)}</ol><div className={styles.inlineActions}><button className={styles.secondaryButton} type="button" onClick={saveProgress}>Guardar avance</button><button className={styles.primaryButton} type="button" onClick={() => focusIssue(validationIssues[0])}>Ir al primer campo pendiente</button></div></div> : null}

            <div className={styles.inlineActions}><button className={styles.secondaryButton} type="button" onClick={saveProgress}>Guardar avance sin acreditar</button><button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Guardando producto final…" : "Guardar evidencia S6"}</button></div>
            {progressMessage ? <p className={styles.progressMessage} role="status">{progressMessage}</p> : null}
            <StatusBanner state={evidenceState} />
          </form>

          <EvidencePdfDownload session="S6" email={evidence.email} pdfAccessCode={evidenceState.pdfAccessCode} />
        </section>

        <section className={styles.section} id="dudas">
          <SectionHeading eyebrow="Dudas previsibles" title="Respuestas breves antes de cerrar" description="Estas aclaraciones mantienen el producto viable, verificable y bajo responsabilidad docente." />
          <div className={styles.faq}>{sessionSixFaq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
        </section>

        <section className={styles.closing}>
          <p className={styles.eyebrow}>Cierre AULA-IA</p>
          <h2>La evidencia final no es un texto producido por IA: es una intervención revisada y defendible por ti.</h2>
          <p>Conserva tu folio y tu PDF. El siguiente paso es verificar las condiciones de aplicación, recoger nueva evidencia y volver a decidir.</p>
          <div className={styles.inlineActions}><a className={styles.primaryButton} href="/encuesta-satisfaccion">Encuesta de satisfacción del curso</a><a className={styles.secondaryButton} href="#evidencia">Revisar mi producto final</a></div>
          <p className={styles.microcopy}>La encuesta es anónima por defecto, toma de 3 a 5 minutos y no forma parte de la acreditación.</p>
        </section>
      </div>

      <SessionNavigation current={6} position="bottom" />
      <footer className={styles.footer}><strong>AULA-IA · Red de Docentes Transdisciplinares</strong><span>Sesión 6 · Integración, auditoría y transferencia</span></footer>
    </main>
  );
}
