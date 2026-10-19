"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import EvidencePdfDownload from "./evidence-pdf-download";
import SessionNavigation from "./session-navigation";
import styles from "./session-two.module.css";
import {
  additionalActivities,
  alignmentQuestions,
  caviaChecklist,
  cases,
  difficultyContent,
  difficultyEvidenceChecklist,
  difficultyLevels,
  difficultyPromptRequirements,
  faq,
  mainAgenda,
  reviewScenarios,
  sessionThreeTitle,
  sourceLinks,
} from "./session-three-data";

type SaveState = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
  code?: string;
  pdfAccessCode?: string;
};

type EvidenceDraft = {
  email: string;
  sequenceTitle: string;
  educationalLevel: string;
  subject: string;
  difficultyLevel: string;
  purpose: string;
  pedagogicalContext: string;
  sources: string;
  prompt: string;
  aiDraft: string;
  activitySequence: string;
  assessmentEvidence: string;
  teacherReview: string;
  detectedRisk: string;
  adaptation: string;
  adjustment: string;
};

type EvidenceIssue = {
  key: keyof EvidenceDraft | "checklist";
  fieldId: string;
  section: string;
  label: string;
  message: string;
  severity: "critical" | "warning";
  origin?: "configuration";
};

const DRAFT_KEY = "aula-ia-s3-evidence-draft";
const IDENTITY_KEY = "aula-ia-s3-identity";
const CHECKS_KEY = "aula-ia-s3-route-checks";
const PROGRESS_KEY = "aula-ia-s3-progress";
const IMPACT_KEY = "aula-ia-s3-configuration-impacts";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildSequencePrompt(
  item: (typeof cases)[number],
  difficulty: (typeof difficultyLevels)[number],
) {
  const difficultyRequirement = difficultyContent[difficulty.key].requirement;
  const deliverables = difficultyPromptRequirements[difficulty.key]
    .map((requirement, index) => `${index + 1}. ${requirement}`)
    .join("\n");

  return `Actúa como asistente de diseño didáctico. Produce un BORRADOR que una persona docente revisará antes de utilizar.

CONTEXTO
Nivel educativo: ${item.level}
Asignatura general: ${item.subject}
Condiciones: ${item.context}

PROPÓSITO OBSERVABLE
${item.learningPurpose}

FUENTE O CASO DE REFERENCIA
${item.source}
FIN DE LA FUENTE

ENCARGO
Diseña ${item.product.toLowerCase()}
Ruta de dificultad elegida: ${difficulty.label}.
Requisito de esta ruta: ${difficultyRequirement}

Presenta:
${deliverables}

Marca como PROPUESTA cualquier elemento creado por ti. No inventes datos, resultados, normas ni referencias. Comprueba que los tiempos sumen la duración disponible.`;
}

const firstCase = cases[0];
const firstDifficulty = difficultyLevels[0];

const initialEvidence: EvidenceDraft = {
  email: "",
  sequenceTitle: firstCase.title,
  educationalLevel: firstCase.level,
  subject: firstCase.subject,
  difficultyLevel: firstDifficulty.key,
  purpose: firstCase.learningPurpose,
  pedagogicalContext: firstCase.context,
  sources: "Ejemplo simulado AULA-IA integrado en la plataforma.",
  prompt: buildSequencePrompt(firstCase, firstDifficulty),
  aiDraft: "",
  activitySequence: "",
  assessmentEvidence: "",
  teacherReview: "",
  detectedRisk: "",
  adaptation: "",
  adjustment: "",
};

async function postSessionThree(payload: Record<string, unknown>) {
  const response = await fetch("/api/session-three", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "No fue posible guardar la respuesta.");
  }
  return result;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function StatusBanner({ state }: { state: SaveState }) {
  if (state.kind === "idle") return null;
  return (
    <div
      className={`${styles.status} ${styles[`status_${state.kind}`]}`}
      role={state.kind === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <strong>{state.kind === "loading" ? "Procesando…" : state.kind === "success" ? "Listo" : "Revisa"}</strong>
      <span>{state.message}</span>
      {state.code ? <span className={styles.code}>Código: {state.code}</span> : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
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
    <div className={styles.toolLinks} aria-label="Herramientas externas de inteligencia artificial">
      <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Abrir ChatGPT <span aria-hidden="true">↗</span></a>
      <a href="https://gemini.google.com/" target="_blank" rel="noreferrer">Abrir Gemini <span aria-hidden="true">↗</span></a>
      <a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer">Abrir NotebookLM <span aria-hidden="true">↗</span></a>
    </div>
  );
}

export function SessionThree() {
  const [attendance, setAttendance] = useState({
    fullName: "",
    email: "",
    institution: "",
    role: "Docente",
    consent: false,
  });
  const [attendanceState, setAttendanceState] = useState<SaveState>({ kind: "idle" });
  const [registeredAttendanceEmail, setRegisteredAttendanceEmail] = useState("");
  const [selectedCase, setSelectedCase] = useState<(typeof cases)[number]["key"]>("basica");
  const [selectedDifficulty, setSelectedDifficulty] = useState<(typeof difficultyLevels)[number]["key"]>("basico");
  const [evidence, setEvidence] = useState<EvidenceDraft>(initialEvidence);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [alignmentAnswers, setAlignmentAnswers] = useState<string[]>(Array(alignmentQuestions.length).fill(""));
  const [alignmentScore, setAlignmentScore] = useState<number | null>(null);
  const [reviewAnswers, setReviewAnswers] = useState<string[]>(Array(reviewScenarios.length).fill(""));
  const [reviewScore, setReviewScore] = useState<number | null>(null);
  const [copied, setCopied] = useState("");
  const [caseNotice, setCaseNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [progressState, setProgressState] = useState<SaveState>({ kind: "idle" });
  const [validationIssues, setValidationIssues] = useState<EvidenceIssue[]>([]);
  const [configurationImpacts, setConfigurationImpacts] = useState<EvidenceIssue[]>([]);

  const currentCase = cases.find((item) => item.key === selectedCase) ?? firstCase;
  const currentDifficulty = difficultyLevels.find((item) => item.key === selectedDifficulty) ?? firstDifficulty;
  const currentDifficultyContent = difficultyContent[currentDifficulty.key];
  const currentEvidenceChecklist = difficultyEvidenceChecklist[currentDifficulty.key];
  const totalMinutes = mainAgenda.reduce((sum, item) => sum + item.minutes, 0);
  const activeMinutes = mainAgenda.filter((item) => item.active).reduce((sum, item) => sum + item.minutes, 0);
  const checkedCount = currentEvidenceChecklist.filter((item) => Boolean(checks[item])).length;
  const sequencePrompt = useMemo(
    () => buildSequencePrompt(currentCase, currentDifficulty),
    [currentCase, currentDifficulty],
  );

  const progress = [
    attendanceState.kind === "success",
    alignmentScore === alignmentQuestions.length,
    evidence.aiDraft.trim().length >= 30,
    reviewScore !== null && reviewScore >= 3,
    evidenceState.kind === "success",
  ].filter(Boolean).length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const identity = JSON.parse(localStorage.getItem(IDENTITY_KEY) || "{}") as Record<string, string>;
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as Partial<EvidenceDraft>;
        const savedChecks = JSON.parse(localStorage.getItem(CHECKS_KEY) || "{}") as Record<string, boolean>;
        const savedProgress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") as { savedAt?: string };
        const savedImpacts = JSON.parse(localStorage.getItem(IMPACT_KEY) || "[]") as EvidenceIssue[];
        const identityEmail = String(identity.email || "").trim().toLowerCase();
        const savedEmail = String(saved.email || "").trim().toLowerCase();
        const linkedEmail = EMAIL_PATTERN.test(identityEmail) ? identityEmail : savedEmail;
        setAttendance((current) => ({
          ...current,
          fullName: identity.fullName || "",
          email: linkedEmail,
          institution: identity.institution || "",
          role: identity.role || "Docente",
        }));
        const merged = { ...initialEvidence, ...saved, email: linkedEmail };
        setEvidence(merged);
        const matchedCase = cases.find((item) => item.level === merged.educationalLevel && item.subject === merged.subject);
        const matchedDifficulty = difficultyLevels.find((item) => item.key === merged.difficultyLevel);
        if (matchedCase) setSelectedCase(matchedCase.key);
        if (matchedDifficulty) setSelectedDifficulty(matchedDifficulty.key);
        setChecks(savedChecks);
        if (Array.isArray(savedImpacts)) { setConfigurationImpacts(savedImpacts); setValidationIssues(savedImpacts); }
        if (savedProgress.savedAt) setProgressState({ kind: "success", message: `Avance local recuperado (${savedProgress.savedAt}). Aún no es una evidencia acreditada.` });
      } catch {
        // Un borrador local dañado no impide realizar la sesión.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(evidence));
  }, [evidence, hydrated]);

  useEffect(() => { if (hydrated) localStorage.setItem(CHECKS_KEY, JSON.stringify(checks)); }, [checks, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(IMPACT_KEY, JSON.stringify(configurationImpacts)); }, [configurationImpacts, hydrated]);

  function updateEvidence(patch: Partial<EvidenceDraft>) {
    const keys = new Set(Object.keys(patch));
    setEvidence((current) => ({ ...current, ...patch }));
    setValidationIssues((current) => current.filter((issue) => !keys.has(issue.key)));
    setConfigurationImpacts((current) => current.filter((issue) => !keys.has(issue.key)));
    setProgressState({ kind: "idle" });
    if (evidenceState.kind === "success") setEvidenceState({ kind: "idle" });
  }

  function authoritativeDraft() {
    return { ...evidence, email: evidence.email.trim().toLowerCase(), educationalLevel: currentCase.level, subject: currentCase.subject, difficultyLevel: currentDifficulty.key };
  }

  function persistProgress(message = "Tu avance quedó guardado en este dispositivo. No genera folio ni acredita la sesión hasta completar los requisitos críticos.") {
    const savedAt = new Date().toLocaleString("es-MX");
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(authoritativeDraft()));
      localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ savedAt, email: evidence.email.trim().toLowerCase(), status: "avance-local" }));
      setProgressState({ kind: "success", message });
    } catch { setProgressState({ kind: "error", message: "No fue posible confirmar el guardado local. Mantén esta página abierta mientras corriges los pendientes." }); }
  }

  function collectEvidenceIssues() {
    const issues: EvidenceIssue[] = [];
    const add = (key: keyof EvidenceDraft, fieldId: string, label: string, minimum: number, severity: EvidenceIssue["severity"]) => {
      const length = String(evidence[key] || "").trim().length;
      if (length < minimum) issues.push({ key, fieldId, section: severity === "critical" ? "Evidencia" : "Información complementaria", label, severity, message: `${label}: escribe al menos ${minimum} caracteres; actualmente hay ${length}.` });
    };
    const email = evidence.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) issues.push({ key: "email", fieldId: "s3-email", section: "Vinculación", label: "Correo usado en la asistencia", severity: "critical", message: "Escribe un correo válido." });
    else if (registeredAttendanceEmail && email !== registeredAttendanceEmail) issues.push({ key: "email", fieldId: "s3-email", section: "Vinculación", label: "Correo usado en la asistencia", severity: "critical", message: "Debe coincidir con la asistencia principal registrada." });
    add("sequenceTitle", "s3-title", "Título de la secuencia", 5, "warning");
    add("sources", "s3-sources", "Fuente o caso utilizado", 5, "warning");
    add("subject", "s3-subject", "Asignatura general", 3, "critical");
    add("purpose", "s3-purpose", "Propósito observable", 20, "critical");
    add("pedagogicalContext", "s3-context", "Contexto pedagógico", 20, "critical");
    add("prompt", "s3-prompt", "Prompt principal", 60, "critical");
    add("aiDraft", "s3-draft", "Borrador de IA o contingencia", 30, "critical");
    add("activitySequence", "s3-sequence", "Secuencia final", 80, "critical");
    add("assessmentEvidence", "s3-assessment", "Evidencia y criterio de revisión", 25, "critical");
    add("teacherReview", "s3-review", "Revisión docente", 30, "critical");
    add("detectedRisk", "s3-risk", "Desalineación, vacío o riesgo", 15, "critical");
    add("adaptation", "s3-adaptation", "Apoyo o adaptación", 15, "critical");
    add("adjustment", "s3-adjustment", "Ajuste final", 20, "critical");
    const missing = currentEvidenceChecklist.filter((item) => !checks[item]);
    if (missing.length) issues.push({ key: "checklist", fieldId: "s3-checklist", section: `Ruta ${currentDifficulty.label}`, label: `Lista de cotejo (${currentEvidenceChecklist.length})`, severity: "critical", message: `Faltan ${missing.length} casillas: ${missing.join(" · ")}` });
    for (const impact of configurationImpacts) if (!issues.some((issue) => issue.key === impact.key)) issues.push(impact);
    return issues;
  }

  function focusIssue(issue: EvidenceIssue) { window.requestAnimationFrame(() => { const element = document.getElementById(issue.fieldId); element?.scrollIntoView({ behavior: "smooth", block: "center" }); element?.focus({ preventScroll: true }); }); }
  function issueFor(key: EvidenceIssue["key"]) { return validationIssues.find((issue) => issue.key === key); }
  function validationClass(key: EvidenceIssue["key"]) { const issue = issueFor(key); return !issue ? "" : issue.severity === "critical" ? styles.validationFieldError : styles.validationFieldWarning; }

  async function handleAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttendanceState({ kind: "loading", message: "Registrando tu asistencia a la Sesión 3…" });
    try {
      const normalizedEmail = attendance.email.trim().toLowerCase();
      const linkedAttendance = { ...attendance, email: normalizedEmail };
      const result = await postSessionThree({ action: "s3_main_attendance", ...linkedAttendance });
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(linkedAttendance));
      setAttendance(linkedAttendance);
      setRegisteredAttendanceEmail(normalizedEmail);
      setEvidence((current) => ({ ...current, email: normalizedEmail }));
      setAttendanceState({
        kind: "success",
        message: typeof result.message === "string" ? result.message : "Asistencia registrada.",
        code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined,
      });
    } catch (error) {
      setAttendanceState({
        kind: "error",
        message: error instanceof Error ? error.message : "No fue posible registrar la asistencia.",
      });
    }
  }

  async function handleEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await attemptEvidence(false);
  }

  async function attemptEvidence(acceptWarnings: boolean) {
    persistProgress("La información escrita quedó conservada como avance local mientras se valida la acreditación.");
    const issues = collectEvidenceIssues();
    const critical = issues.filter((issue) => issue.severity === "critical");
    const warnings = issues.filter((issue) => issue.severity === "warning");
    setValidationIssues(issues);
    if (critical.length) { setEvidenceState({ kind: "error", message: `No podemos acreditar todavía: hay ${critical.length} requisitos críticos. Están enumerados y resaltados.` }); focusIssue(critical[0]); return; }
    if (warnings.length && !acceptWarnings) { setEvidenceState({ kind: "idle" }); focusIssue(warnings[0]); return; }
    setEvidenceState({ kind: "loading", message: "Guardando la evidencia de la Sesión 3… No cierres esta página." });
    try {
      const checklist = Object.fromEntries(currentEvidenceChecklist.map((item) => [item, Boolean(checks[item])]));
      const result = await postSessionThree({
        action: "s3_evidence",
        ...authoritativeDraft(),
        checklist,
      });
      const syncNote = result.sheetSync === "synced"
        ? " También quedó reflejada en la hoja institucional."
        : result.sheetSync === "failed"
          ? " La evidencia quedó protegida en la plataforma, pero la réplica institucional requiere revisión."
          : " La evidencia quedó protegida en la plataforma; la conexión institucional no está configurada en este entorno.";
      setEvidenceState({
        kind: "success",
        message: `${typeof result.message === "string" ? result.message : "Evidencia guardada."}${syncNote}`,
        code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined,
        pdfAccessCode: typeof result.pdfAccessCode === "string" ? result.pdfAccessCode : undefined,
      });
      setValidationIssues([]);
      setConfigurationImpacts([]);
    } catch (error) {
      setEvidenceState({
        kind: "error",
        message: error instanceof Error ? error.message : "No fue posible guardar. Tu borrador permanece en este dispositivo.",
      });
    }
  }

  async function handleCopy(label: string, value: string) {
    try {
      await copyText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 2500);
    } catch {
      setCopied("error");
    }
  }

  function resetCaseBoundEvidence(
    item: (typeof cases)[number],
    difficulty: (typeof difficultyLevels)[number],
  ) {
    const impacts: EvidenceIssue[] = [
      ["aiDraft", "s3-draft", "Borrador de IA o contingencia"], ["activitySequence", "s3-sequence", "Secuencia final"], ["assessmentEvidence", "s3-assessment", "Evidencia y criterio"], ["teacherReview", "s3-review", "Revisión docente"], ["detectedRisk", "s3-risk", "Desalineación, vacío o riesgo"], ["adaptation", "s3-adaptation", "Apoyo o adaptación"], ["adjustment", "s3-adjustment", "Ajuste final"],
    ].map(([key, fieldId, label]) => ({ key: key as keyof EvidenceDraft, fieldId, section: "Cambio de caso", label, severity: "critical" as const, origin: "configuration" as const, message: "El contenido se conservó; revísalo o ajústalo para la nueva selección antes de acreditar." }));
    const nextChecks: Record<string, boolean> = {};
    setEvidence((current) => ({
      ...current,
      sequenceTitle: item.title,
      educationalLevel: item.level,
      subject: item.subject,
      difficultyLevel: difficulty.key,
      purpose: item.learningPurpose,
      pedagogicalContext: item.context,
      sources: "Ejemplo simulado AULA-IA integrado en la plataforma.",
      prompt: buildSequencePrompt(item, difficulty),
    }));
    setChecks(nextChecks);
    setConfigurationImpacts(impacts);
    const missing = difficultyEvidenceChecklist[difficulty.key];
    setValidationIssues([...impacts, { key: "checklist", fieldId: "s3-checklist", section: `Ruta ${difficulty.label}`, label: `Lista de cotejo (${missing.length})`, severity: "critical", message: `Confirma de nuevo las ${missing.length} casillas para la nueva selección.` }]);
    setProgressState({ kind: "idle" });
    setEvidenceState({ kind: "idle" });
    setCaseNotice("Caso actualizado. Se conservaron tus textos y quedaron señalados para revisión inmediata; las casillas se desmarcaron con tu confirmación.");
    window.setTimeout(() => setCaseNotice(""), 5000);
  }

  function chooseCase(key: (typeof cases)[number]["key"]) {
    const item = cases.find((candidate) => candidate.key === key) ?? firstCase;
    if (item.key === currentCase.key) return;
    if (currentEvidenceChecklist.some((criterion) => checks[criterion]) && !window.confirm("Cambiar de caso conservará tus textos, pero desmarcará la lista de cotejo para que la confirmes con la nueva secuencia. ¿Deseas continuar?")) return;
    setSelectedCase(item.key);
    resetCaseBoundEvidence(item, currentDifficulty);
  }

  function chooseDifficulty(key: (typeof difficultyLevels)[number]["key"]) {
    const difficulty = difficultyLevels.find((item) => item.key === key) ?? firstDifficulty;
    if (difficulty.key === currentDifficulty.key) return;
    setSelectedDifficulty(difficulty.key);
    updateEvidence({ difficultyLevel: difficulty.key, prompt: buildSequencePrompt(currentCase, difficulty) });
    const nextChecklist = difficultyEvidenceChecklist[difficulty.key];
    const missing = nextChecklist.filter((item) => !checks[item]);
    setValidationIssues([...configurationImpacts, ...(missing.length ? [{ key: "checklist" as const, fieldId: "s3-checklist", section: `Ruta ${difficulty.label}`, label: `Lista de cotejo (${nextChecklist.length})`, severity: "critical" as const, message: `Faltan ${missing.length} casillas: ${missing.join(" · ")}` }] : [])]);
    setCaseNotice("Ruta actualizada. Se conservaron tus respuestas y las casillas compartidas; los nuevos pendientes quedaron señalados de inmediato.");
    window.setTimeout(() => setCaseNotice(""), 5000);
  }

  return (
    <main className={`${styles.shell} ${styles.sessionThreeShell}`}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="AULA-IA, volver a la Sesión 1">
          <span aria-hidden="true">AI</span>
          <span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span>
        </a>
        <nav aria-label="Navegación de Sesión 3">
          <a href="#agenda">Agenda</a>
          <a href="#laboratorio">Laboratorio</a>
          <a href="#evidencia">Evidencia</a>
          <a href="/sesion-3/preparacion">Principiantes</a>
        </nav>
      </header>
      <SessionNavigation current={3} position="top" />

      <div id="contenido">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Sesión 3 de 6 · Ruta principal</p>
            <h1>Diseñar para que el aprendizaje se vea</h1>
            <p className={styles.lede}>{sessionThreeTitle}. La IA produce un borrador; la coherencia pedagógica se decide y documenta desde la práctica docente.</p>
            <div className={styles.metrics}>
              <span><strong>{totalMinutes}</strong> minutos exactos</span>
              <span><strong>{activeMinutes}</strong> minutos de aplicación</span>
              <span><strong>1</strong> evidencia acreditable</span>
            </div>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#registro-principal">Registrar asistencia</a>
              <a className={styles.secondaryButton} href="/sesion-3/preparacion">Ir a preparación</a>
            </div>
            <p className={styles.microcopy}>No es obligatorio completar los tres niveles de dificultad. Elige una ruta y desarrolla un producto suficiente, revisado y viable.</p>
          </div>
          <figure className={styles.heroImage}>
            <img src="/recursos/sesion-3/og-sesion-3.png" alt="Composición educativa sobre propósito, actividades, evidencia y revisión docente con inteligencia artificial" width="1536" height="1024" />
            <figcaption>Una secuencia conecta decisiones; no acumula actividades.</figcaption>
          </figure>
        </section>

        <section className={styles.routeStrip} aria-label="Rutas disponibles">
          <div>
            <span>Ruta de apoyo</span>
            <strong>Principiantes · 60 min</strong>
            <p>Plantilla acompañada, ejemplo sencillo, revisión guiada y registro no acreditable.</p>
            <a href="/sesion-3/preparacion">Abrir preparación</a>
          </div>
          <div className={styles.routeActive}>
            <span>Ruta oficial</span>
            <strong>Principal · 90 min</strong>
            <p>Demostración, laboratorio, revisión, ajuste y evidencia. Sí cuenta para acreditación.</p>
            <a href="#registro-principal">Continuar aquí</a>
          </div>
        </section>

        <section className={styles.section} id="registro-principal">
          <SectionHeading
            eyebrow="Asistencia oficial"
            title="Registra tu entrada a la Sesión 3 principal"
            description="La preparación tiene un registro separado. Usa el mismo correo para vincular asistencia y evidencia."
          />
          <form className={`${styles.form} ${styles.cardForm}`} onSubmit={handleAttendance}>
            <div className={styles.twoColumns}>
              <label>Nombre completo<input required value={attendance.fullName} onChange={(event) => setAttendance({ ...attendance, fullName: event.target.value })} autoComplete="name" /></label>
              <label>Correo electrónico<input required type="email" value={attendance.email} onChange={(event) => setAttendance({ ...attendance, email: event.target.value })} autoComplete="email" /></label>
              <label>Institución<input required value={attendance.institution} onChange={(event) => setAttendance({ ...attendance, institution: event.target.value })} autoComplete="organization" /></label>
              <label>Función<select value={attendance.role} onChange={(event) => setAttendance({ ...attendance, role: event.target.value })}><option>Docente</option><option>Directivo</option><option>Apoyo técnico-pedagógico</option><option>Estudiante normalista</option><option>Otra función educativa</option></select></label>
            </div>
            <label className={styles.consent}><input type="checkbox" checked={attendance.consent} onChange={(event) => setAttendance({ ...attendance, consent: event.target.checked })} /><span>Acepto que estos datos se utilicen para asistencia, seguimiento y acreditación del curso. No se mostrarán al grupo.</span></label>
            <button className={styles.primaryButton} type="submit" disabled={attendanceState.kind === "loading"}>{attendanceState.kind === "loading" ? "Registrando…" : "Registrar asistencia principal"}</button>
            <StatusBanner state={attendanceState} />
          </form>
        </section>

        <section className={styles.section}>
          <SectionHeading
            eyebrow="Progreso de la sesión"
            title={`${progress} de 5 hitos completados`}
            description="El indicador orienta tu recorrido; no sustituye la lista de cotejo de la evidencia."
          />
          <div className={styles.progressPanel}>
            <progress max={5} value={progress} aria-label={`${progress} de 5 hitos completados`} />
            <ol>
              <li data-done={attendanceState.kind === "success"}>Asistencia</li>
              <li data-done={alignmentScore === alignmentQuestions.length}>Alineación</li>
              <li data-done={evidence.aiDraft.trim().length >= 30}>Borrador</li>
              <li data-done={reviewScore !== null && reviewScore >= 3}>Revisión</li>
              <li data-done={evidenceState.kind === "success"}>Evidencia</li>
            </ol>
          </div>
        </section>

        <section className={styles.section} id="agenda">
          <SectionHeading
            eyebrow="Ruta comprobable"
            title="90 minutos exactos; 70 de trabajo aplicado"
            description="La explicación se mantiene breve. La mayor parte del tiempo se dedica a demostrar, producir, revisar y ajustar."
          />
          <ol className={styles.agenda}>
            {mainAgenda.map((item) => (
              <li key={item.time} className={item.active ? styles.agendaActive : ""}>
                <span>{item.time} min</span>
                <div><strong>{item.label}</strong><p>{item.detail}</p></div>
                {item.active ? <em>Aplicación</em> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.section} ${styles.quoteSection}`}>
          <p className={styles.eyebrow}>Frase detonadora · propuesta AULA-IA</p>
          <blockquote>“Una secuencia no mejora por tener más actividades, sino cuando cada decisión acerca al aprendizaje.”</blockquote>
          <details><summary>Pregunta para debatir durante 2 minutos</summary><p>¿Qué actividad de nuestras clases ocupa tiempo, pero no permite observar el aprendizaje que declaramos?</p></details>
        </section>

        <section className={styles.section} id="microcontenido">
          <SectionHeading
            eyebrow="Microcontenido dialogado · 15 minutos"
            title="Propósito, actividad, evidencia, tiempo e inclusión deben apuntar al mismo lugar"
            description="La IA puede proponer piezas coherentes en apariencia. La revisión docente comprueba si realmente están alineadas."
          />
          <div className={styles.chain}>
            <div><span>1</span><strong>Propósito</strong><p>¿Qué acción observable se espera?</p></div>
            <div><span>2</span><strong>Contexto</strong><p>¿Con quién, cuánto tiempo y con qué recursos?</p></div>
            <div><span>3</span><strong>Actividad</strong><p>¿Qué hará el grupo para practicar?</p></div>
            <div><span>4</span><strong>Evidencia</strong><p>¿Qué permitirá observar el aprendizaje?</p></div>
            <div><span>5</span><strong>Borrador IA</strong><p>¿Qué propuesta puede ayudarnos a organizar?</p></div>
            <div><span>6</span><strong>Revisión</strong><p>¿Qué conservamos, ajustamos o retiramos?</p></div>
          </div>
          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 1 · Relacionar conceptos</p><h3>¿Propósito, actividad o evidencia?</h3><p>Clasifica cada elemento y comprueba el criterio que lo distingue.</p></div>
            <div className={styles.quizList}>
              {alignmentQuestions.map((item, index) => (
                <label key={item.text}>
                  <span>{item.text}</span>
                  <select value={alignmentAnswers[index]} onChange={(event) => { const next = [...alignmentAnswers]; next[index] = event.target.value; setAlignmentAnswers(next); setAlignmentScore(null); }}>
                    <option value="">Selecciona</option>
                    <option value="proposito">Propósito</option>
                    <option value="actividad">Actividad</option>
                    <option value="evidencia">Evidencia</option>
                  </select>
                  {alignmentScore !== null ? <small>{item.feedback}</small> : null}
                </label>
              ))}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => setAlignmentScore(alignmentQuestions.filter((item, index) => item.answer === alignmentAnswers[index]).length)}>Comprobar alineación</button>
            {alignmentScore !== null ? <p className={styles.quizResult} role="status">{alignmentScore} de {alignmentQuestions.length} correctas. {alignmentScore === alignmentQuestions.length ? "Ya puedes aplicar la relación a tu secuencia." : "Lee la retroalimentación y vuelve a intentarlo."}</p> : null}
          </div>
          <details className={styles.detailsCard}>
            <summary>Consultar fundamento de esta recomendación</summary>
            <p>La integración de IA centrada en la agencia docente se apoya en el marco de competencias de UNESCO. La relación propósito-contexto-formato se utiliza aquí como criterio de diseño del curso y se identifica como propuesta metodológica AULA-IA.</p>
            <a href={sourceLinks[0].url} target="_blank" rel="noreferrer">{sourceLinks[0].label} ↗</a>
          </details>
        </section>

        <section className={styles.section} id="demostracion">
          <SectionHeading
            eyebrow="Demostración comparativa · 20 minutos"
            title="Una petición extensa no garantiza una secuencia coherente"
            description="Compara una solicitud general con un encargo que hace visibles propósito, contexto, producto y revisión."
          />
          <div className={styles.comparison}>
            <article className={styles.genericCard}>
              <span>Petición general</span>
              <h3>“Haz una clase interesante sobre filosofía.”</h3>
              <ul><li>No define aprendizaje observable.</li><li>No informa tiempo ni grupo.</li><li>No indica evidencia ni criterio.</li></ul>
            </article>
            <article className={styles.groundedCard}>
              <span>Encargo revisable</span>
              <h3>Propósito + contexto + fuente + evidencia</h3>
              <ul><li>Delimita qué debe aprenderse.</li><li>Solicita acciones y tiempos.</li><li>Exige revisión y límites.</li></ul>
            </article>
          </div>
          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}>
              <div><p className={styles.eyebrow}>Prompt de demostración</p><h3>Filosofía · ruta básica</h3></div>
              <button type="button" onClick={() => handleCopy("demo", buildSequencePrompt(cases[1], firstDifficulty))}>{copied === "demo" ? "Copiado" : "Copiar prompt"}</button>
            </div>
            <pre>{buildSequencePrompt(cases[1], firstDifficulty)}</pre>
          </div>
          <ToolLinks />
          <details className={styles.sampleAnswer}>
            <summary>No tengo acceso a una IA: usar respuesta de contingencia</summary>
            <p><strong>Propósito:</strong> distinguir tesis, razón, objeción y supuesto. <strong>Inicio, 8 min:</strong> responder la pregunta detonadora. <strong>Desarrollo, 30 min:</strong> subrayar las dos posiciones, completar una tabla y contrastar en parejas. <strong>Cierre, 12 min:</strong> redactar una conclusión con una razón y una objeción. <strong>Evidencia:</strong> texto de cinco líneas revisado con tres criterios. <strong>PROPUESTA:</strong> ofrecer un esquema de frases iniciales a quien lo necesite.</p>
          </details>
          <details className={styles.detailsCard}>
            <summary>¿En qué se basa la estructura del prompt?</summary>
            <p>OpenAI Academy presenta el patrón tarea, contexto y salida; Google describe componentes semejantes para instrucciones de Gems. AULA-IA agrega propósito, fuente, evidencia y revisión como propuesta de diseño docente.</p>
            <div className={styles.inlineActions}><a href={sourceLinks[1].url} target="_blank" rel="noreferrer">Fuente OpenAI ↗</a><a href={sourceLinks[4].url} target="_blank" rel="noreferrer">Fuente Google ↗</a></div>
          </details>
        </section>

        <section className={styles.section} id="laboratorio">
          <SectionHeading
            eyebrow="Laboratorio de diseño · 35 minutos"
            title="Diseña una secuencia en una sola ruta"
            description="Elige un caso espejo y un nivel de dificultad. Los demás quedan disponibles para avanzar a tu propio ritmo."
          />
          <div className={styles.caseTabs} role="group" aria-label="Casos espejo por nivel educativo">
            {cases.map((item) => (
              <button key={item.key} type="button" aria-pressed={selectedCase === item.key} onClick={() => chooseCase(item.key)}>
                <strong>{item.level}</strong><span>{item.subject} · {item.title}</span>
              </button>
            ))}
          </div>
          <div className={styles.caseCard}>
            <div>
              <p className={styles.eyebrow}>Caso espejo seleccionado</p>
              <h3>{currentCase.title}</h3>
              <p><strong>Propósito:</strong> {currentCase.learningPurpose}</p>
              <p><strong>Contexto:</strong> {currentCase.context}</p>
              <p><strong>Producto:</strong> {currentCase.product}</p>
            </div>
            <details open><summary>Fuente de práctica · ejemplo simulado</summary><pre>{currentCase.source}</pre></details>
          </div>

          <div className={styles.levelGrid} role="group" aria-label="Nivel de dificultad opcional">
            {difficultyLevels.map((item) => {
              const content = difficultyContent[item.key];
              return (
                <article key={item.key}>
                  <span>{item.label}</span>
                  <h3>{content.description}</h3>
                  <p>{content.requirement}</p>
                  <button type="button" aria-pressed={selectedDifficulty === item.key} onClick={() => chooseDifficulty(item.key)}>{selectedDifficulty === item.key ? "Ruta elegida" : "Elegir esta ruta"}</button>
                </article>
              );
            })}
          </div>
          {caseNotice ? <p className={styles.note} role="status">{caseNotice}</p> : null}

          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}>
              <div><p className={styles.eyebrow}>Prompt contextualizado</p><h3>{currentCase.level} · {currentDifficulty.label}</h3></div>
              <button type="button" onClick={() => handleCopy("lab", sequencePrompt)}>{copied === "lab" ? "Copiado" : "Copiar prompt"}</button>
            </div>
            <pre>{sequencePrompt}</pre>
          </div>
          <ToolLinks />
          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Producción central</p><h3>Regresa con un borrador y conviértelo en decisión docente</h3><p>Copia el prompt, trabaja en otra pestaña y pega el resultado. Después completa cada campo con tu revisión.</p></div>
            <div className={styles.form}>
              <label>Borrador producido por la IA o respuesta de contingencia<textarea rows={10} value={evidence.aiDraft} onChange={(event) => updateEvidence({ aiDraft: event.target.value })} placeholder="Pega el borrador. No lo presentes todavía como producto final." /></label>
              <label>{currentDifficulty.key === "avanzado" ? "Secuencia ajustada con rutas A y B que alcanzan el mismo propósito" : "Secuencia ajustada: tres momentos, tiempos y acciones de docente y alumnado"}<textarea rows={9} value={evidence.activitySequence} onChange={(event) => updateEvidence({ activitySequence: event.target.value })} placeholder="Escribe la versión que sí aplicarías." /></label>
              <label>{currentDifficulty.key === "basico" ? "Evidencia breve de aprendizaje y boleto de salida" : "Evidencia, criterio de revisión y lista de cotejo breve"}<textarea rows={5} value={evidence.assessmentEvidence} onChange={(event) => updateEvidence({ assessmentEvidence: event.target.value })} /></label>
              <label>{currentDifficulty.key === "avanzado" ? "Apoyo para distintos ritmos, adaptación y alternativa de acceso" : currentDifficulty.key === "intermedio" ? "Apoyo para distintos ritmos y adaptación" : "Apoyo o adaptación transversal de la revisión docente"}<textarea rows={4} value={evidence.adaptation} onChange={(event) => updateEvidence({ adaptation: event.target.value })} /></label>
            </div>
          </div>
        </section>

        <section className={styles.section} id="revision">
          <SectionHeading
            eyebrow="Auditoría CAVIA · 10 minutos"
            title="Una secuencia atractiva también puede estar desalineada"
            description="Decide si cada escenario está alineado, necesita ajuste o debe retirarse; la retroalimentación explica el criterio."
          />
          <div className={styles.quizList}>
            {reviewScenarios.map((item, index) => (
              <label key={item.text}>
                <span>{item.text}</span>
                <select value={reviewAnswers[index]} onChange={(event) => { const next = [...reviewAnswers]; next[index] = event.target.value; setReviewAnswers(next); setReviewScore(null); }}>
                  <option value="">Decide</option>
                  <option value="alineada">Alineada</option>
                  <option value="desalineada">Desalineada</option>
                  <option value="ajustar">Ajustar</option>
                  <option value="retirar">Retirar</option>
                </select>
                {reviewScore !== null ? <small>{item.feedback}</small> : null}
              </label>
            ))}
          </div>
          <button type="button" className={styles.secondaryButton} onClick={() => setReviewScore(reviewScenarios.filter((item, index) => item.answer === reviewAnswers[index]).length)}>Comprobar decisiones</button>
          {reviewScore !== null ? <p className={styles.quizResult} role="status">{reviewScore} de {reviewScenarios.length} decisiones coinciden con el criterio. {reviewScore >= 3 ? "Aplica ahora la revisión a tu producto." : "Revisa las explicaciones y vuelve a decidir."}</p> : null}
          <div className={styles.infoGrid}>
            {caviaChecklist.map((criterion) => {
              const [label, explanation] = criterion.split(": ");
              return <article key={criterion}><h3>{label}</h3><p>{explanation}</p></article>;
            })}
          </div>
          <p className={styles.note}>CAVIA es una propuesta metodológica original de AULA-IA para esta sesión; no se presenta como escala validada ni sustituye los criterios institucionales.</p>
        </section>

        <section className={styles.section} id="evidencia">
          <SectionHeading
            eyebrow="Evidencia acreditable y cierre · 5 minutos"
            title="Secuencia didáctica contextualizada y revisada"
            description={`${currentDifficultyContent.finalInstruction} Confirma cada criterio y espera el código; el borrador local permanece en este dispositivo hasta el envío.`}
          />
          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence} noValidate>
            <div className={styles.twoColumns}>
              <label className={validationClass("email")}>Correo usado en la asistencia<input id="s3-email" aria-invalid={Boolean(issueFor("email"))} type="email" value={evidence.email} onChange={(event) => updateEvidence({ email: event.target.value })} />{issueFor("email") ? <span className={styles.validationMessage}>{issueFor("email")?.message}</span> : null}</label>
              <label className={validationClass("sequenceTitle")}>Título de la secuencia<input id="s3-title" aria-invalid={Boolean(issueFor("sequenceTitle"))} value={evidence.sequenceTitle} onChange={(event) => updateEvidence({ sequenceTitle: event.target.value })} />{issueFor("sequenceTitle") ? <span className={styles.validationMessage}>{issueFor("sequenceTitle")?.message}</span> : null}</label>
              <label>Nivel educativo<select value={evidence.educationalLevel} onChange={(event) => {
                const nextLevel = event.target.value;
                const nextCase = cases.find((item) => item.level === nextLevel);
                if (nextCase) chooseCase(nextCase.key);
              }}><option>Educación básica</option><option>Media superior</option><option>Educación superior</option></select></label>
              <label className={validationClass("subject")}>Asignatura general<input id="s3-subject" aria-invalid={Boolean(issueFor("subject"))} value={evidence.subject} onChange={(event) => updateEvidence({ subject: event.target.value })} />{issueFor("subject") ? <span className={styles.validationMessage}>{issueFor("subject")?.message}</span> : null}</label>
              <label>Dificultad elegida<select value={evidence.difficultyLevel} onChange={(event) => {
                const nextDifficulty = event.target.value as (typeof difficultyLevels)[number]["key"];
                chooseDifficulty(nextDifficulty);
              }}><option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option></select></label>
              <label className={validationClass("sources")}>Fuente o caso utilizado<input id="s3-sources" aria-invalid={Boolean(issueFor("sources"))} value={evidence.sources} onChange={(event) => updateEvidence({ sources: event.target.value })} />{issueFor("sources") ? <span className={styles.validationMessage}>{issueFor("sources")?.message}</span> : null}</label>
            </div>
            <label className={validationClass("purpose")}>Propósito observable<textarea id="s3-purpose" aria-invalid={Boolean(issueFor("purpose"))} rows={4} value={evidence.purpose} onChange={(event) => updateEvidence({ purpose: event.target.value })} />{issueFor("purpose") ? <span className={styles.validationMessage}>{issueFor("purpose")?.message}</span> : null}</label>
            <label className={validationClass("pedagogicalContext")}>Contexto pedagógico<textarea id="s3-context" aria-invalid={Boolean(issueFor("pedagogicalContext"))} rows={4} value={evidence.pedagogicalContext} onChange={(event) => updateEvidence({ pedagogicalContext: event.target.value })} />{issueFor("pedagogicalContext") ? <span className={styles.validationMessage}>{issueFor("pedagogicalContext")?.message}</span> : null}</label>
            <label className={validationClass("prompt")}>Prompt principal<textarea id="s3-prompt" aria-invalid={Boolean(issueFor("prompt"))} rows={8} value={evidence.prompt} onChange={(event) => updateEvidence({ prompt: event.target.value })} />{issueFor("prompt") ? <span className={styles.validationMessage}>{issueFor("prompt")?.message}</span> : null}</label>
            <label className={validationClass("aiDraft")}>Borrador de IA o contingencia<textarea id="s3-draft" aria-invalid={Boolean(issueFor("aiDraft"))} rows={8} value={evidence.aiDraft} onChange={(event) => updateEvidence({ aiDraft: event.target.value })} />{issueFor("aiDraft") ? <span className={styles.validationMessage}>{issueFor("aiDraft")?.message}</span> : null}</label>
            <label className={validationClass("activitySequence")}>{currentDifficulty.key === "avanzado" ? "Secuencia final: tres momentos, tiempos, acciones y rutas A y B con propósito común" : "Secuencia final: tres momentos con tiempos y acciones de docente y alumnado"}<textarea id="s3-sequence" aria-invalid={Boolean(issueFor("activitySequence"))} rows={10} value={evidence.activitySequence} onChange={(event) => updateEvidence({ activitySequence: event.target.value })} />{issueFor("activitySequence") ? <span className={styles.validationMessage}>{issueFor("activitySequence")?.message}</span> : null}</label>
            <label className={validationClass("assessmentEvidence")}>{currentDifficulty.key === "basico" ? "Evidencia breve de aprendizaje y boleto de salida" : "Evidencia, criterio de revisión y lista de cotejo breve"}<textarea id="s3-assessment" aria-invalid={Boolean(issueFor("assessmentEvidence"))} rows={5} value={evidence.assessmentEvidence} onChange={(event) => updateEvidence({ assessmentEvidence: event.target.value })} />{issueFor("assessmentEvidence") ? <span className={styles.validationMessage}>{issueFor("assessmentEvidence")?.message}</span> : null}</label>
            <label className={validationClass("teacherReview")}>{currentDifficulty.key === "avanzado" ? "Revisión crítica: justifica qué conservar, qué ajustar y qué retirar" : currentDifficulty.key === "basico" ? "Revisión docente transversal: identifica una mejora sin añadir requisitos de rutas superiores" : "Revisión docente: qué conservas, cambias o retiras"}<textarea id="s3-review" aria-invalid={Boolean(issueFor("teacherReview"))} rows={5} value={evidence.teacherReview} onChange={(event) => updateEvidence({ teacherReview: event.target.value })} />{issueFor("teacherReview") ? <span className={styles.validationMessage}>{issueFor("teacherReview")?.message}</span> : null}</label>
            <label className={validationClass("detectedRisk")}>{currentDifficulty.key === "avanzado" ? "Desalineación, vacío, riesgo o contraejemplo detectado" : "Desalineación, vacío o riesgo detectado"}<textarea id="s3-risk" aria-invalid={Boolean(issueFor("detectedRisk"))} rows={4} value={evidence.detectedRisk} onChange={(event) => updateEvidence({ detectedRisk: event.target.value })} />{issueFor("detectedRisk") ? <span className={styles.validationMessage}>{issueFor("detectedRisk")?.message}</span> : null}</label>
            <label className={validationClass("adaptation")}>{currentDifficulty.key === "avanzado" ? "Apoyo para distintos ritmos, adaptación y alternativa de acceso" : currentDifficulty.key === "intermedio" ? "Apoyo para distintos ritmos y adaptación" : "Apoyo o adaptación transversal de la revisión docente"}<textarea id="s3-adaptation" aria-invalid={Boolean(issueFor("adaptation"))} rows={4} value={evidence.adaptation} onChange={(event) => updateEvidence({ adaptation: event.target.value })} />{issueFor("adaptation") ? <span className={styles.validationMessage}>{issueFor("adaptation")?.message}</span> : null}</label>
            <label className={validationClass("adjustment")}>{currentDifficulty.key === "avanzado" ? "Ajuste final derivado de las decisiones de conservar, ajustar y retirar" : "Ajuste final realizado"}<textarea id="s3-adjustment" aria-invalid={Boolean(issueFor("adjustment"))} rows={4} value={evidence.adjustment} onChange={(event) => updateEvidence({ adjustment: event.target.value })} />{issueFor("adjustment") ? <span className={styles.validationMessage}>{issueFor("adjustment")?.message}</span> : null}</label>
            <fieldset id="s3-checklist" tabIndex={-1} aria-invalid={Boolean(issueFor("checklist"))} className={`${styles.checklist} ${validationClass("checklist")}`}>
              <legend>Lista de cotejo · {checkedCount} de {currentEvidenceChecklist.length}</legend>
              <p>Confirma todos los criterios de la ruta elegida. Si alguno no se cumple, corrige antes de enviar.</p>
              {currentEvidenceChecklist.map((item) => (
                <label key={item}><input type="checkbox" checked={Boolean(checks[item])} onChange={(event) => { const next = { ...checks, [item]: event.target.checked }; setChecks(next); setProgressState({ kind: "idle" }); if (currentEvidenceChecklist.every((criterion) => next[criterion])) setValidationIssues((current) => current.filter((issue) => issue.key !== "checklist")); }} /><span>{item}</span></label>
              ))}
              {issueFor("checklist") ? <span className={styles.validationMessage}>{issueFor("checklist")?.message}</span> : null}
            </fieldset>
            <p className={styles.privacyNote}><strong>Antes de guardar:</strong> confirma que usaste el correo de la asistencia y que no incluiste datos personales de estudiantes.</p>
            {validationIssues.length ? <div className={styles.validationSummary} role="alert"><h3>{validationIssues.some((issue) => issue.severity === "critical") ? "No se puede acreditar todavía" : "Hay información complementaria pendiente"}</h3><p>{validationIssues.some((issue) => issue.severity === "critical") ? "Corrige los requisitos críticos enumerados. Tu avance quedó conservado." : "Puedes completar estos datos o guardar la evidencia con las advertencias visibles."}</p><ol>{validationIssues.map((issue) => <li key={`${issue.key}-${issue.severity}`} data-severity={issue.severity}><button type="button" onClick={() => focusIssue(issue)}><strong>{issue.section} → {issue.label}</strong><span>{issue.message}</span></button></li>)}</ol><div className={styles.inlineActions}>{validationIssues.some((issue) => issue.severity === "critical") ? <><button type="button" className={styles.secondaryButton} onClick={() => persistProgress()}>Guardar avance</button><button type="button" className={styles.primaryButton} onClick={() => focusIssue(validationIssues.find((issue) => issue.severity === "critical")!)}>Ir al primer requisito crítico</button></> : <><button type="button" className={styles.secondaryButton} onClick={() => focusIssue(validationIssues[0])}>Volver y completar</button><button type="button" className={styles.primaryButton} onClick={() => void attemptEvidence(true)}>Guardar evidencia con advertencias</button></>}</div></div> : null}
            <div className={styles.inlineActions}><button className={styles.secondaryButton} type="button" onClick={() => persistProgress()}>Guardar avance sin acreditar</button><button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Guardando evidencia…" : "Guardar evidencia S3"}</button></div>
            <StatusBanner state={progressState} />
            <StatusBanner state={evidenceState} />
            <p className={styles.draftNote}>El botón se bloquea durante el envío. Si aparece un error, corrige el campo señalado; el texto visible permanece en el formulario.</p>
          </form>
          <EvidencePdfDownload session="S3" email={evidence.email} pdfAccessCode={evidenceState.pdfAccessCode} />
        </section>

        <section className={styles.section} id="recursos">
          <SectionHeading
            eyebrow="Transferencia"
            title="Recursos para continuar"
            description="La actividad semanal se realiza fuera de los 90 minutos y no modifica la duración oficial."
          />
          <div className={styles.resourceGrid}>
            <article><span>Actividad semanal</span><h3>Aplicar, observar y ajustar</h3><ol><li>Elige una clase real.</li><li>Aplica una parte de la secuencia.</li><li>Registra qué funcionó, qué cambiaste y qué evidencia obtuviste.</li></ol></article>
            <article><span>Materiales</span><h3>Descargas de Sesión 3</h3><p>Cuadernillos, hoja de trabajo, banco de prompts y materiales de contingencia.</p><div className={styles.downloads}><a href="/recursos/sesion-3/cuadernillo-principal-s3.pdf">Cuadernillo PDF</a><a href="/recursos/sesion-3/hoja-trabajo-s3.docx">Hoja editable</a><a href="/recursos/sesion-3/banco-prompts-s3.pdf">Banco de prompts</a></div></article>
            <article><span>Preguntas frecuentes</span><h3>Resolver sin detener el grupo</h3><div className={styles.faq}>{faq.map(([question, answer]) => <article key={question}><strong>{question}</strong><p>{answer}</p></article>)}</div></article>
          </div>
        </section>

        <section className={styles.section} id="adicionales">
          <SectionHeading
            eyebrow="Opcionales"
            title="ACTIVIDADES ADICIONALES"
            description="Utilízalas únicamente si existe tiempo disponible. No sustituyen ninguna actividad obligatoria ni afectan la evidencia principal."
          />
          <div className={styles.resourceGrid}>
            {additionalActivities.map((item) => (
              <article key={item.title}>
                <span>{item.time}</span>
                <h3>{item.title}</h3>
                <p><strong>Propósito:</strong> {item.purpose}</p>
                <p><strong>Instrucción:</strong> {item.instruction}</p>
                <p><strong>Interacción:</strong> {item.interaction}</p>
                <p><strong>Retroalimentación:</strong> {item.feedback}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <SectionHeading
            eyebrow="Opciones del ponente"
            title="PROPUESTAS PARA ENRIQUECER LA SESIÓN"
            description="Estas ideas son propuestas de diseño AULA-IA, no requisitos ni resultados de investigación."
          />
          <div className={styles.infoGrid}>
            <article><h3>Comparación anónima</h3><p>Mostrar dos secuencias sin autoría y pedir que el grupo identifique cuál hace visible mejor el propósito.</p></article>
            <article><h3>Revisión en parejas</h3><p>Intercambiar únicamente propósito, actividad y evidencia; evitar compartir datos o documentos privados.</p></article>
            <article><h3>Reto de transferencia</h3><p>Adaptar una secuencia a otro nivel educativo modificando razonamiento, apoyo y evidencia, no solo vocabulario.</p></article>
          </div>
        </section>

        <section className={styles.section} id="fuentes">
          <SectionHeading
            eyebrow="Fundamentación discreta"
            title="Fuentes consultadas"
            description="Las fuentes respaldan afirmaciones sobre las herramientas o principios generales. Los casos y decisiones metodológicas AULA-IA se identifican como ejemplos o propuestas."
          />
          <div className={styles.sourceList}>
            {sourceLinks.map((item) => (
              <article key={item.url}><div><strong>{item.label}</strong><p>{item.support}</p></div><a href={item.url} target="_blank" rel="noreferrer">Consultar fuente ↗</a></article>
            ))}
          </div>
        </section>
      </div>

      <SessionNavigation current={3} position="bottom" />
      <footer className={styles.footer}>
        <div><strong>AULA-IA · Sesión 3</strong><p>Diseño docente con propósito, evidencia y revisión.</p></div>
        <div><a href="/">Sesión 1</a><a href="/sesion-2">Sesión 2</a><a href="/sesion-3/preparacion">Preparación S3</a><a href="/sesion-4">Sesión 4</a><a href="#contenido">Volver arriba</a></div>
      </footer>
    </main>
  );
}
