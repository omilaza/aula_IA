"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import EvidencePdfDownload from "./evidence-pdf-download";
import SessionNavigation from "./session-navigation";
import styles from "./session-two.module.css";
import {
  additionalActivities,
  cases,
  caviaChecklist,
  contingencyFeedback,
  difficultyContent,
  difficultyEvidenceChecklist,
  difficultyLevels,
  difficultyPromptRequirements,
  evaluationMoments,
  faq,
  mainAgenda,
  momentQuestions,
  reviewScenarios,
  sessionFourTitle,
  sourceLinks,
} from "./session-four-data";

type SaveState = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
  code?: string;
  pdfAccessCode?: string;
};

type EvidenceDraft = {
  email: string;
  caseKey: (typeof cases)[number]["key"];
  evaluationTitle: string;
  educationalLevel: string;
  subject: string;
  difficultyLevel: (typeof difficultyLevels)[number]["key"];
  learningPurpose: string;
  evaluationMoment: (typeof evaluationMoments)[number]["key"];
  pedagogicalContext: string;
  sourceCase: string;
  criteriaIndicators: string;
  prompt: string;
  aiDraft: string;
  evidenceAnalysis: string;
  generatedFeedback: string;
  teacherReview: string;
  detectedRisk: string;
  adaptation: string;
  finalDecision: string;
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

const DRAFT_KEY = "aula-ia-s4-evidence-draft";
const IDENTITY_KEY = "aula-ia-s4-identity";
const CHECKS_KEY = "aula-ia-s4-route-checks";
const PROGRESS_KEY = "aula-ia-s4-progress";
const IMPACT_KEY = "aula-ia-s4-configuration-impacts";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const firstCase = cases[0];
const firstDifficulty = difficultyLevels[0];

function buildEvaluationPrompt(
  item: (typeof cases)[number],
  difficulty: (typeof difficultyLevels)[number],
  evaluationMoment: EvidenceDraft["evaluationMoment"],
) {
  const requirements = difficultyPromptRequirements[difficulty.key]
    .map((requirement, index) => `${index + 1}. ${requirement}`)
    .join("\n");
  const moment = evaluationMoments.find((entry) => entry.key === evaluationMoment) ?? evaluationMoments[1];

  return `Actúa como asistente de evaluación formativa. Produce un BORRADOR que una persona docente revisará antes de utilizar.

CONTEXTO
Nivel educativo: ${item.level}
Asignatura general: ${item.subject}
Condiciones: ${item.context}

PROPÓSITO DE APRENDIZAJE
${item.learningPurpose}

MOMENTO DE EVALUACIÓN
${moment.label}: ${moment.description}

EVIDENCIA O CASO DE REFERENCIA
${item.source}
FIN DE LA EVIDENCIA

ENCARGO
Analiza el producto con base en el propósito y redacta retroalimentación. Ruta de dificultad: ${difficulty.label}.
Requisito de esta ruta: ${difficultyContent[difficulty.key].requirement}

Presenta:
${requirements}

REGLAS
- Distingue lo que la evidencia permite afirmar de cualquier inferencia.
- No diagnostiques rasgos, intenciones ni capacidades de la persona.
- No inventes datos, resultados, normas, citas ni referencias.
- Marca como PROPUESTA cualquier criterio o apoyo que no aparezca en el caso.
- Termina con una nota breve sobre qué debe comprobar la persona docente.`;
}

const initialEvidence: EvidenceDraft = {
  email: "",
  caseKey: firstCase.key,
  evaluationTitle: firstCase.title,
  educationalLevel: firstCase.level,
  subject: firstCase.subject,
  difficultyLevel: firstDifficulty.key,
  learningPurpose: firstCase.learningPurpose,
  evaluationMoment: "formativa",
  pedagogicalContext: firstCase.context,
  sourceCase: "Ejemplo simulado AULA-IA integrado en la plataforma.",
  criteriaIndicators: "",
  prompt: buildEvaluationPrompt(firstCase, firstDifficulty, "formativa"),
  aiDraft: "",
  evidenceAnalysis: "",
  generatedFeedback: "",
  teacherReview: "",
  detectedRisk: "",
  adaptation: "",
  finalDecision: "",
};

async function postSessionFour(payload: Record<string, unknown>) {
  const response = await fetch("/api/session-four", {
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

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
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

export function SessionFour() {
  const [attendance, setAttendance] = useState({ fullName: "", email: "", institution: "", role: "Docente", consent: false });
  const [attendanceState, setAttendanceState] = useState<SaveState>({ kind: "idle" });
  const [registeredAttendanceEmail, setRegisteredAttendanceEmail] = useState("");
  const [selectedCase, setSelectedCase] = useState<(typeof cases)[number]["key"]>(firstCase.key);
  const [selectedDifficulty, setSelectedDifficulty] = useState<(typeof difficultyLevels)[number]["key"]>(firstDifficulty.key);
  const [evidence, setEvidence] = useState<EvidenceDraft>(initialEvidence);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [momentAnswers, setMomentAnswers] = useState<string[]>(Array(momentQuestions.length).fill(""));
  const [momentScore, setMomentScore] = useState<number | null>(null);
  const [reviewAnswers, setReviewAnswers] = useState<string[]>(Array(reviewScenarios.length).fill(""));
  const [reviewScore, setReviewScore] = useState<number | null>(null);
  const [copied, setCopied] = useState("");
  const [caseNotice, setCaseNotice] = useState("");
  const [progressState, setProgressState] = useState<SaveState>({ kind: "idle" });
  const [validationIssues, setValidationIssues] = useState<EvidenceIssue[]>([]);
  const [configurationImpacts, setConfigurationImpacts] = useState<EvidenceIssue[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const currentCase = cases.find((item) => item.key === selectedCase) ?? firstCase;
  const currentDifficulty = difficultyLevels.find((item) => item.key === selectedDifficulty) ?? firstDifficulty;
  const currentDifficultyContent = difficultyContent[currentDifficulty.key];
  const currentEvidenceChecklist = difficultyEvidenceChecklist[currentDifficulty.key];
  const totalMinutes = mainAgenda.reduce((sum, item) => sum + item.minutes, 0);
  const activeMinutes = mainAgenda.filter((item) => item.active).reduce((sum, item) => sum + item.minutes, 0);
  const checkedCount = currentEvidenceChecklist.filter((item) => Boolean(checks[item])).length;
  const evaluationPrompt = useMemo(
    () => buildEvaluationPrompt(currentCase, currentDifficulty, evidence.evaluationMoment),
    [currentCase, currentDifficulty, evidence.evaluationMoment],
  );
  const progress = [
    attendanceState.kind === "success",
    momentScore === momentQuestions.length,
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
        const merged = { ...initialEvidence, ...saved, email: linkedEmail } as EvidenceDraft;
        const matchedCase = cases.find((item) => item.key === merged.caseKey);
        const matchedDifficulty = difficultyLevels.find((item) => item.key === merged.difficultyLevel);
        if (matchedCase) setSelectedCase(matchedCase.key);
        if (matchedDifficulty) setSelectedDifficulty(matchedDifficulty.key);
        setEvidence(merged);
        setChecks(savedChecks);
        if (Array.isArray(savedImpacts)) {
          setConfigurationImpacts(savedImpacts);
          setValidationIssues(savedImpacts);
        }
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

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  }, [checks, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(IMPACT_KEY, JSON.stringify(configurationImpacts));
  }, [configurationImpacts, hydrated]);

  function updateEvidence(patch: Partial<EvidenceDraft>) {
    setEvidence((current) => ({ ...current, ...patch }));
    const keys = new Set(Object.keys(patch));
    setValidationIssues((current) => current.filter((issue) => !keys.has(issue.key)));
    setConfigurationImpacts((current) => current.filter((issue) => !keys.has(issue.key)));
    setProgressState({ kind: "idle" });
    if (evidenceState.kind === "success") setEvidenceState({ kind: "idle" });
  }

  function authoritativeDraft() {
    return {
      ...evidence,
      email: evidence.email.trim().toLowerCase(),
      caseKey: currentCase.key,
      educationalLevel: currentCase.level,
      subject: currentCase.subject,
      difficultyLevel: currentDifficulty.key,
    };
  }

  function persistProgress(message = "Tu avance quedó guardado en este dispositivo. No genera folio ni acredita la sesión hasta completar los requisitos críticos.") {
    const savedAt = new Date().toLocaleString("es-MX");
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(authoritativeDraft()));
      localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ savedAt, email: evidence.email.trim().toLowerCase(), status: "avance-local" }));
      setProgressState({ kind: "success", message });
    } catch {
      setProgressState({ kind: "error", message: "No fue posible confirmar el guardado local. Mantén esta página abierta mientras corriges los pendientes." });
    }
  }

  function collectEvidenceIssues() {
    const issues: EvidenceIssue[] = [];
    const add = (key: keyof EvidenceDraft, fieldId: string, section: string, label: string, minimum: number, severity: EvidenceIssue["severity"]) => {
      const value = String(evidence[key] ?? "").trim();
      if (value.length >= minimum) return;
      issues.push({ key, fieldId, section, label, severity, message: `${label}: escribe al menos ${minimum} caracteres; actualmente hay ${value.length}.` });
    };
    const email = evidence.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) issues.push({ key: "email", fieldId: "s4-email", section: "Vinculación", label: "Correo usado en la asistencia", severity: "critical", message: "Correo usado en la asistencia: escribe un correo válido." });
    else if (registeredAttendanceEmail && email !== registeredAttendanceEmail) issues.push({ key: "email", fieldId: "s4-email", section: "Vinculación", label: "Correo usado en la asistencia", severity: "critical", message: "Correo usado en la asistencia: debe coincidir con la asistencia principal registrada." });
    add("evaluationTitle", "s4-title", "Información complementaria", "Título del ejercicio", 5, "warning");
    add("learningPurpose", "s4-purpose", "Información complementaria", "Propósito de aprendizaje observable", 20, "warning");
    add("pedagogicalContext", "s4-context", "Información complementaria", "Contexto pedagógico", 20, "warning");
    add("sourceCase", "s4-source", "Información complementaria", "Fuente o caso utilizado", 5, "warning");
    add("criteriaIndicators", "s4-criteria", "Evidencia", "Criterios e indicadores", 30, "critical");
    add("prompt", "s4-prompt", "Evidencia", "Prompt principal", 80, "critical");
    add("aiDraft", "s4-draft", "Evidencia", "Borrador de IA o contingencia", 30, "critical");
    add("evidenceAnalysis", "s4-analysis", "Evidencia", "Análisis de evidencia e inferencias", 40, "critical");
    add("generatedFeedback", "s4-feedback", "Evidencia", "Retroalimentación final", 60, "critical");
    add("teacherReview", "s4-review", "Revisión docente", "Revisión docente del borrador", 30, "critical");
    add("detectedRisk", "s4-risk", "Revisión docente", "Riesgo, sesgo o afirmación no sustentada", 20, "critical");
    add("adaptation", "s4-adaptation", "Revisión docente", "Adaptación o apoyo", 20, "critical");
    add("finalDecision", "s4-decision", "Revisión docente", "Decisión final y ajuste realizado", 30, "critical");
    const missingChecks = currentEvidenceChecklist.filter((item) => !checks[item]);
    if (missingChecks.length) issues.push({ key: "checklist", fieldId: "s4-checklist", section: `Ruta ${currentDifficulty.label}`, label: `Lista de cotejo (${currentEvidenceChecklist.length})`, severity: "critical", message: `Ruta ${currentDifficulty.label}: faltan ${missingChecks.length} casillas: ${missingChecks.join(" · ")}` });
    for (const impact of configurationImpacts) {
      if (!issues.some((issue) => issue.key === impact.key)) issues.push(impact);
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

  function issueFor(key: EvidenceIssue["key"]) { return validationIssues.find((issue) => issue.key === key); }
  function validationClass(key: EvidenceIssue["key"]) { const issue = issueFor(key); return !issue ? "" : issue.severity === "critical" ? styles.validationFieldError : styles.validationFieldWarning; }

  async function handleAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttendanceState({ kind: "loading", message: "Registrando tu asistencia a la Sesión 4…" });
    try {
      const normalizedEmail = attendance.email.trim().toLowerCase();
      const linkedAttendance = { ...attendance, email: normalizedEmail };
      const result = await postSessionFour({ action: "s4_main_attendance", ...linkedAttendance });
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
      setAttendanceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible registrar la asistencia." });
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
    if (critical.length) {
      setEvidenceState({ kind: "error", message: `No podemos acreditar todavía: hay ${critical.length} requisito${critical.length === 1 ? "" : "s"} crítico${critical.length === 1 ? "" : "s"}. Están enumerados y resaltados.` });
      focusIssue(critical[0]);
      return;
    }
    if (warnings.length && !acceptWarnings) {
      setEvidenceState({ kind: "idle" });
      focusIssue(warnings[0]);
      return;
    }
    setEvidenceState({ kind: "loading", message: "Guardando la evidencia de la Sesión 4… No cierres esta página." });
    try {
      const checklist = Object.fromEntries(currentEvidenceChecklist.map((item) => [item, Boolean(checks[item])]));
      const result = await postSessionFour({ action: "s4_evidence", ...authoritativeDraft(), checklist });
      const syncNote = result.sheetSync === "synced"
        ? " También quedó reflejada en la hoja institucional."
        : result.sheetSync === "failed"
          ? " La evidencia quedó protegida en la plataforma, pero la réplica institucional requiere revisión."
          : " La evidencia quedó protegida en la plataforma; la conexión institucional no está configurada en este entorno.";
      setEvidenceState({
        kind: "success",
        message: `${typeof result.message === "string" ? result.message : "Evidencia guardada."}${warnings.length ? ` Se acreditó con ${warnings.length} advertencia${warnings.length === 1 ? "" : "s"} complementaria${warnings.length === 1 ? "" : "s"} aceptada${warnings.length === 1 ? "" : "s"}.` : ""}${syncNote}`,
        code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined,
        pdfAccessCode: typeof result.pdfAccessCode === "string" ? result.pdfAccessCode : undefined,
      });
      setValidationIssues([]);
      setConfigurationImpacts([]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "No fue posible generar la evidencia.";
      setEvidenceState({ kind: "error", message: `La información quedó conservada como avance, pero ocurrió un problema al generar la evidencia: ${detail}` });
    }
  }

  async function handleCopy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 2500);
    } catch {
      setCopied("error");
    }
  }

  function resetCaseBoundEvidence(
    item: (typeof cases)[number],
    difficulty: (typeof difficultyLevels)[number],
    evaluationMoment: EvidenceDraft["evaluationMoment"],
  ) {
    const impacts = configurationReviewIssues("Cambiaste el caso o el momento de evaluación");
    const nextChecks: Record<string, boolean> = {};
    setEvidence((current) => ({
      ...current,
      caseKey: item.key,
      evaluationTitle: item.title,
      educationalLevel: item.level,
      subject: item.subject,
      difficultyLevel: difficulty.key,
      learningPurpose: item.learningPurpose,
      evaluationMoment,
      pedagogicalContext: item.context,
      sourceCase: "Ejemplo simulado AULA-IA integrado en la plataforma.",
      prompt: buildEvaluationPrompt(item, difficulty, evaluationMoment),
    }));
    setChecks(nextChecks);
    setConfigurationImpacts(impacts);
    const checklistIssue = checklistIssueFor(difficultyEvidenceChecklist[difficulty.key], nextChecks, difficulty.label);
    setValidationIssues([...impacts, ...(checklistIssue ? [checklistIssue] : [])]);
    setProgressState({ kind: "idle" });
    setEvidenceState({ kind: "idle" });
    setCaseNotice("Caso o momento actualizados. Se conservaron tus textos y quedaron señalados para revisión inmediata; las casillas se desmarcaron con tu confirmación.");
    window.setTimeout(() => setCaseNotice(""), 5000);
  }

  function chooseCase(key: (typeof cases)[number]["key"]) {
    const item = cases.find((candidate) => candidate.key === key) ?? firstCase;
    if (item.key === currentCase.key) return;
    if (!confirmChecklistReset("Cambiar de caso")) return;
    setSelectedCase(item.key);
    resetCaseBoundEvidence(item, currentDifficulty, evidence.evaluationMoment);
  }

  function chooseDifficulty(key: (typeof difficultyLevels)[number]["key"]) {
    const difficulty = difficultyLevels.find((item) => item.key === key) ?? firstDifficulty;
    if (difficulty.key === currentDifficulty.key) return;
    setSelectedDifficulty(difficulty.key);
    setEvidence((current) => ({
      ...current,
      difficultyLevel: difficulty.key,
      prompt: buildEvaluationPrompt(currentCase, difficulty, current.evaluationMoment),
    }));
    setProgressState({ kind: "idle" });
    setEvidenceState({ kind: "idle" });
    const nextChecklist = difficultyEvidenceChecklist[difficulty.key];
    const checklistIssue = checklistIssueFor(nextChecklist, checks, difficulty.label);
    setValidationIssues([...configurationImpacts, ...(checklistIssue ? [checklistIssue] : [])]);
    setCaseNotice("Ruta actualizada. Se conservaron tus respuestas y las casillas compartidas; los nuevos pendientes quedaron señalados de inmediato.");
    window.setTimeout(() => setCaseNotice(""), 5000);
  }

  function chooseMoment(key: EvidenceDraft["evaluationMoment"]) {
    if (key === evidence.evaluationMoment) return;
    if (!confirmChecklistReset("Cambiar el momento de evaluación")) return;
    resetCaseBoundEvidence(currentCase, currentDifficulty, key);
  }

  function configurationReviewIssues(reason: string): EvidenceIssue[] {
    return [
      ["criteriaIndicators", "s4-criteria", "Criterios e indicadores"],
      ["aiDraft", "s4-draft", "Borrador de IA o contingencia"],
      ["evidenceAnalysis", "s4-analysis", "Análisis de evidencia e inferencias"],
      ["generatedFeedback", "s4-feedback", "Retroalimentación final"],
      ["teacherReview", "s4-review", "Revisión docente del borrador"],
      ["detectedRisk", "s4-risk", "Riesgo, sesgo o afirmación no sustentada"],
      ["adaptation", "s4-adaptation", "Adaptación o apoyo"],
      ["finalDecision", "s4-decision", "Decisión final y ajuste realizado"],
    ].map(([key, fieldId, label]) => ({ key: key as keyof EvidenceDraft, fieldId, section: "Cambio de configuración", label, severity: "critical" as const, origin: "configuration" as const, message: `${reason}: el contenido se conservó; revísalo o ajústalo antes de acreditar.` }));
  }

  function checklistIssueFor(items: readonly string[], nextChecks: Record<string, boolean>, label: string): EvidenceIssue | null {
    const missing = items.filter((item) => !nextChecks[item]);
    return missing.length ? { key: "checklist", fieldId: "s4-checklist", section: `Ruta ${label}`, label: `Lista de cotejo (${items.length})`, severity: "critical", message: `Ruta ${label}: faltan ${missing.length} casillas: ${missing.join(" · ")}` } : null;
  }

  function confirmChecklistReset(action: string) {
    if (!currentEvidenceChecklist.some((item) => checks[item])) return true;
    return window.confirm(`${action}. Tus textos se conservarán y quedarán marcados para revisión, pero las casillas se desmarcarán porque deben confirmarse con la nueva selección. ¿Deseas continuar?`);
  }

  return (
    <main className={`${styles.shell} ${styles.sessionFourShell}`}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="AULA-IA, volver al inicio"><span aria-hidden="true">AI</span><span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span></a>
        <nav aria-label="Navegación de Sesión 4"><a href="/">Inicio</a><a href="/sesion-3">Sesión 3</a><a href="#laboratorio">Laboratorio</a><a href="#evidencia">Evidencia</a><a href="/sesion-4/preparacion">Principiantes</a></nav>
      </header>
      <SessionNavigation current={4} position="top" />

      <div id="contenido">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Sesión 4 de 6 · Ruta principal</p>
            <h1>Evaluar para abrir el siguiente paso</h1>
            <p className={styles.lede}>{sessionFourTitle}. La IA ayuda a producir un borrador; la persona docente contrasta la evidencia, protege a sus estudiantes y toma la decisión final.</p>
            <div className={styles.metrics}><span><strong>{totalMinutes}</strong> minutos exactos</span><span><strong>{activeMinutes}</strong> minutos de aplicación</span><span><strong>1</strong> evidencia acreditable</span></div>
            <div className={styles.heroActions}><a className={styles.primaryButton} href="#registro-principal">Registrar asistencia</a><a className={styles.secondaryButton} href="/sesion-4/preparacion">Ir a preparación</a></div>
            <p className={styles.microcopy}>Elige un nivel educativo y una dificultad. No es obligatorio completar las tres rutas.</p>
          </div>
          <div className={styles.evaluationHeroVisual}>
            <div className={styles.prepMap} aria-label="Ciclo de evaluación formativa"><span>1. Evidencia</span><span>2. Criterio</span><span>3. Retroalimentación</span><span>4. Decisión docente</span></div>
            <figure className={`${styles.heroImage} ${styles.evaluationImage}`}>
              <img src="/recursos/sesion-4/evaluacion-formativa-docente-s4.png" alt="Docente que contrasta evidencias anónimas con criterios, formula retroalimentación y decide el siguiente paso con apoyo de inteligencia artificial" width="1536" height="1024" />
              <figcaption>La IA propone; la persona docente interpreta la evidencia y decide cómo acompañar el aprendizaje.</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.routeStrip} aria-label="Rutas disponibles">
          <div><span>Ruta de apoyo</span><strong>Principiantes · 60 min</strong><p>Conceptos básicos, práctica guiada y registro no acreditable.</p><a href="/sesion-4/preparacion">Abrir preparación</a></div>
          <div className={styles.routeActive}><span>Ruta oficial</span><strong>Principal · 90 min</strong><p>Demostración, laboratorio, revisión, ajuste y evidencia acreditable.</p><a href="#registro-principal">Continuar aquí</a></div>
        </section>

        <section className={styles.section} id="registro-principal">
          <SectionHeading eyebrow="Asistencia oficial" title="Registra tu entrada a la Sesión 4 principal" description="La preparación tiene un registro separado. Usa el mismo correo para vincular asistencia y evidencia." />
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
          <SectionHeading eyebrow="Progreso de la sesión" title={`${progress} de 5 hitos completados`} description="El indicador orienta tu recorrido; la evidencia solo queda registrada cuando recibes un código." />
          <div className={styles.progressPanel}><progress max={5} value={progress} aria-label={`${progress} de 5 hitos completados`} /><ol><li data-done={attendanceState.kind === "success"}>Asistencia</li><li data-done={momentScore === momentQuestions.length}>Momentos</li><li data-done={evidence.aiDraft.trim().length >= 30}>Borrador</li><li data-done={reviewScore !== null && reviewScore >= 3}>Revisión</li><li data-done={evidenceState.kind === "success"}>Evidencia</li></ol></div>
        </section>

        <section className={styles.section} id="agenda">
          <SectionHeading eyebrow="Ruta comprobable" title="90 minutos exactos; 75 de trabajo aplicado" description="La mayor parte del tiempo se dedica a demostrar, producir, revisar y ajustar." />
          <ol className={styles.agenda}>{mainAgenda.map((item) => <li key={item.time} className={item.active ? styles.agendaActive : ""}><span>{item.time} min</span><div><strong>{item.label}</strong><p>{item.detail}</p></div>{item.active ? <em>Aplicación</em> : null}</li>)}</ol>
        </section>

        <section className={`${styles.section} ${styles.quoteSection}`}>
          <p className={styles.eyebrow}>Frase para dialogar</p>
          <blockquote>“Una evaluación útil no termina en el juicio: abre una decisión posible.”</blockquote>
          <p>Propuesta AULA-IA para debate: ¿qué información necesita una persona para poder mejorar?</p>
        </section>

        <section className={styles.section}>
          <SectionHeading eyebrow="5–15 min · Microcontenido" title="Evaluar no siempre significa calificar" description="El momento y el uso de la información cambian la función de la evaluación." />
          <div className={styles.infoGrid}>{evaluationMoments.map((item) => <article key={item.key}><h3>{item.label}</h3><p>{item.description}</p></article>)}</div>
          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción · Clasificar</p><h3>¿En qué momento se usa la información?</h3><p>Selecciona y comprueba. La explicación aparece después de responder.</p></div>
            <div className={styles.quizList}>{momentQuestions.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={momentAnswers[index]} onChange={(event) => { const next = [...momentAnswers]; next[index] = event.target.value; setMomentAnswers(next); setMomentScore(null); }}><option value="">Selecciona</option>{evaluationMoments.map((moment) => <option key={moment.key} value={moment.key}>{moment.label}</option>)}</select>{momentScore !== null ? <small>{item.feedback}</small> : null}</label>)}</div>
            <button type="button" className={styles.secondaryButton} onClick={() => setMomentScore(momentQuestions.filter((item, index) => item.answer === momentAnswers[index]).length)}>Comprobar respuestas</button>
            {momentScore !== null ? <p className={styles.quizResult} role="status">{momentScore} de {momentQuestions.length} correctas. {momentScore === momentQuestions.length ? "Ahora aplica la distinción al caso." : "Lee la explicación y vuelve a decidir."}</p> : null}
          </div>
          <details className={styles.detailsCard}><summary>Consultar fundamento sin salir de la actividad</summary><p>La evaluación formativa relaciona metas, evidencia, retroalimentación y ajustes. Cuando interviene IA, la agencia y la decisión evaluativa permanecen en la persona docente.</p><div className={styles.inlineActions}><a href={sourceLinks[6].url} target="_blank" rel="noreferrer">OCDE · evaluación formativa ↗</a><a href={sourceLinks[7].url} target="_blank" rel="noreferrer">SEP · evaluación y retroalimentación ↗</a><a href={sourceLinks[0].url} target="_blank" rel="noreferrer">UNESCO · agencia docente ↗</a><a href={sourceLinks[2].url} target="_blank" rel="noreferrer">OpenAI · evaluación con revisión humana ↗</a></div></details>
        </section>

        <section className={styles.section}>
          <SectionHeading eyebrow="15–30 min · Demostración" title="De una opinión general a una retroalimentación defendible" description="La segunda versión limita la afirmación, cita evidencia y propone una acción." />
          <div className={styles.demoGrid}>
            <article className={styles.genericCard}><span>Versión genérica</span><h3>“Buen trabajo. Debes profundizar más.”</h3><ul><li>No identifica evidencia.</li><li>No explica el criterio.</li><li>No indica qué hacer después.</li></ul></article>
            <article className={styles.groundedCard}><span>Versión revisable</span><h3>“Distingues una diferencia entre las fuentes. Revisa la frase ‘toda la comunidad’: los testimonios no respaldan esa generalización. Sustitúyela por una afirmación limitada y agrega una pregunta sobre la información faltante.”</h3><ul><li>Reconoce un logro.</li><li>Cita el problema observable.</li><li>Propone un siguiente paso.</li></ul></article>
          </div>
          <details className={styles.sampleAnswer}><summary>No tengo acceso a una IA: usar respuesta de contingencia</summary><pre>{contingencyFeedback}</pre></details>
        </section>

        <section className={styles.section} id="laboratorio">
          <SectionHeading eyebrow="Laboratorio por nivel · 35 minutos" title="Analiza una evidencia y decide qué retroalimentación sí usarías" description="Elige un caso espejo y una dificultad. Caso, prompt, formulario y lista de cotejo se actualizan juntos." />
          <div className={styles.caseTabs} role="group" aria-label="Casos espejo por nivel educativo">{cases.map((item) => <button key={item.key} type="button" aria-pressed={selectedCase === item.key} onClick={() => chooseCase(item.key)}><strong>{item.level}</strong><span>{item.subject} · {item.title}</span></button>)}</div>
          <div className={styles.caseCard}><div><p className={styles.eyebrow}>Caso espejo seleccionado</p><h3>{currentCase.title}</h3><p><strong>Propósito:</strong> {currentCase.learningPurpose}</p><p><strong>Contexto:</strong> {currentCase.context}</p><p><strong>Producto:</strong> {currentCase.evidenceProduct}</p></div><details open><summary>Evidencia de práctica · ejemplo simulado</summary><pre>{currentCase.source}</pre></details></div>

          <div className={styles.levelGrid} role="group" aria-label="Nivel de dificultad opcional">{difficultyLevels.map((item) => { const content = difficultyContent[item.key]; return <article key={item.key}><span>{item.label}</span><h3>{content.description}</h3><p>{content.requirement}</p><button type="button" aria-pressed={selectedDifficulty === item.key} onClick={() => chooseDifficulty(item.key)}>{selectedDifficulty === item.key ? "Ruta elegida" : "Elegir esta ruta"}</button></article>; })}</div>
          {caseNotice ? <p className={styles.note} role="status">{caseNotice}</p> : null}

          <div className={styles.form}>
            <label>Momento de evaluación<select value={evidence.evaluationMoment} onChange={(event) => chooseMoment(event.target.value as EvidenceDraft["evaluationMoment"])}>{evaluationMoments.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          </div>
          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt contextualizado</p><h3>{currentCase.level} · {currentDifficulty.label}</h3></div><button type="button" onClick={() => handleCopy("lab", evaluationPrompt)}>{copied === "lab" ? "Copiado" : "Copiar prompt"}</button></div>
            <pre>{evaluationPrompt}</pre>
          </div>
          <ToolLinks />
          <details className={styles.detailsCard}><summary>¿Por qué el prompt incluye fuente, evidencia y revisión?</summary><p>Las instrucciones claras reducen supuestos, pero no garantizan exactitud. Las fuentes y la revisión permiten rastrear afirmaciones y conservar la decisión docente.</p><div className={styles.inlineActions}><a href={sourceLinks[3].url} target="_blank" rel="noreferrer">OpenAI Academy · prompts ↗</a><a href={sourceLinks[4].url} target="_blank" rel="noreferrer">Google · NotebookLM ↗</a></div></details>

          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Producción central</p><h3>Convierte el borrador en una decisión docente</h3><p>Pega una salida de IA o usa la contingencia; luego registra tu análisis, retroalimentación y ajuste.</p></div>
            <div className={styles.form}>
              <label>Criterios e indicadores de logro<textarea rows={5} value={evidence.criteriaIndicators} onChange={(event) => setEvidence({ ...evidence, criteriaIndicators: event.target.value })} placeholder="Criterio 1… Indicador observable…" /></label>
              <label>Borrador producido por la IA o respuesta de contingencia<textarea rows={9} value={evidence.aiDraft} onChange={(event) => setEvidence({ ...evidence, aiDraft: event.target.value })} /></label>
              <label>Análisis de la evidencia: qué permite afirmar y qué no<textarea rows={6} value={evidence.evidenceAnalysis} onChange={(event) => setEvidence({ ...evidence, evidenceAnalysis: event.target.value })} /></label>
              <label>Retroalimentación que sí usarías<textarea rows={7} value={evidence.generatedFeedback} onChange={(event) => setEvidence({ ...evidence, generatedFeedback: event.target.value })} /></label>
              <label>{currentDifficulty.key === "avanzado" ? "Apoyo, alternativa de acceso y alternativa sin IA" : currentDifficulty.key === "intermedio" ? "Opción de acceso, expresión o apoyo" : "Apoyo o adaptación transversal de la revisión docente"}<textarea rows={4} value={evidence.adaptation} onChange={(event) => setEvidence({ ...evidence, adaptation: event.target.value })} /></label>
            </div>
          </div>
        </section>

        <section className={styles.section} id="revision">
          <SectionHeading eyebrow="Auditoría CAVIA · 15 minutos" title="Una frase fluida también puede ser injusta o imposible de comprobar" description="Decide qué conservar, ajustar, reducir o retirar. La retroalimentación explica el criterio." />
          <div className={styles.quizList}>{reviewScenarios.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={reviewAnswers[index]} onChange={(event) => { const next = [...reviewAnswers]; next[index] = event.target.value; setReviewAnswers(next); setReviewScore(null); }}><option value="">Decide</option><option value="conservar">Conservar</option><option value="ajustar">Ajustar</option><option value="reducir">Reducir</option><option value="retirar">Retirar</option></select>{reviewScore !== null ? <small>{item.feedback}</small> : null}</label>)}</div>
          <button type="button" className={styles.secondaryButton} onClick={() => setReviewScore(reviewScenarios.filter((item, index) => item.answer === reviewAnswers[index]).length)}>Comprobar decisiones</button>
          {reviewScore !== null ? <p className={styles.quizResult} role="status">{reviewScore} de {reviewScenarios.length} decisiones coinciden con el criterio. {reviewScore >= 3 ? "Aplica ahora la revisión a tu producto." : "Revisa las explicaciones y vuelve a decidir."}</p> : null}
          <div className={styles.infoGrid}>{caviaChecklist.map((criterion) => { const [label, explanation] = criterion.split(": "); return <article key={criterion}><h3>{label}</h3><p>{explanation}</p></article>; })}</div>
          <p className={styles.note}>CAVIA es una propuesta metodológica original de AULA-IA; no se presenta como escala validada ni sustituye las normas de evaluación de cada institución.</p>
        </section>

        <section className={styles.section} id="evidencia">
          <SectionHeading eyebrow="Ajuste, evidencia y cierre · 10 minutos" title="Retroalimentación contextualizada, fundamentada y revisada" description={`${currentDifficultyContent.finalInstruction} Confirma todos los criterios y espera el código de registro.`} />
          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence} noValidate>
            <div className={styles.twoColumns}>
              <label className={validationClass("email")}>Correo usado en la asistencia<input id="s4-email" aria-invalid={issueFor("email")?.severity === "critical"} type="email" value={evidence.email} onChange={(event) => updateEvidence({ email: event.target.value })} />{issueFor("email") ? <span className={styles.validationMessage}>{issueFor("email")?.message}</span> : null}</label>
              <label className={validationClass("evaluationTitle")}>Título del ejercicio<input id="s4-title" aria-invalid={issueFor("evaluationTitle")?.severity === "critical"} value={evidence.evaluationTitle} onChange={(event) => updateEvidence({ evaluationTitle: event.target.value })} />{issueFor("evaluationTitle") ? <span className={styles.validationMessage}>{issueFor("evaluationTitle")?.message}</span> : null}</label>
              <label>Nivel educativo<select value={evidence.educationalLevel} onChange={(event) => { const nextCase = cases.find((item) => item.level === event.target.value); if (nextCase) chooseCase(nextCase.key); }}>{cases.map((item) => <option key={item.key}>{item.level}</option>)}</select></label>
              <label>Asignatura general<input readOnly value={evidence.subject} /></label>
              <label>Dificultad elegida<select value={evidence.difficultyLevel} onChange={(event) => chooseDifficulty(event.target.value as EvidenceDraft["difficultyLevel"])}>{difficultyLevels.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
              <label>Momento de evaluación<select value={evidence.evaluationMoment} onChange={(event) => chooseMoment(event.target.value as EvidenceDraft["evaluationMoment"])}>{evaluationMoments.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
              <label className={validationClass("sourceCase")}>Fuente o caso utilizado<input id="s4-source" aria-invalid={issueFor("sourceCase")?.severity === "critical"} value={evidence.sourceCase} onChange={(event) => updateEvidence({ sourceCase: event.target.value })} />{issueFor("sourceCase") ? <span className={styles.validationMessage}>{issueFor("sourceCase")?.message}</span> : null}</label>
              <label>Caso seleccionado<input readOnly value={evidence.caseKey} /></label>
            </div>
            <label className={validationClass("learningPurpose")}>Propósito de aprendizaje observable<textarea id="s4-purpose" aria-invalid={issueFor("learningPurpose")?.severity === "critical"} rows={4} value={evidence.learningPurpose} onChange={(event) => updateEvidence({ learningPurpose: event.target.value })} />{issueFor("learningPurpose") ? <span className={styles.validationMessage}>{issueFor("learningPurpose")?.message}</span> : null}</label>
            <label className={validationClass("pedagogicalContext")}>Contexto pedagógico<textarea id="s4-context" aria-invalid={issueFor("pedagogicalContext")?.severity === "critical"} rows={4} value={evidence.pedagogicalContext} onChange={(event) => updateEvidence({ pedagogicalContext: event.target.value })} />{issueFor("pedagogicalContext") ? <span className={styles.validationMessage}>{issueFor("pedagogicalContext")?.message}</span> : null}</label>
            <label className={validationClass("criteriaIndicators")}>Criterios e indicadores<textarea id="s4-criteria" aria-invalid={issueFor("criteriaIndicators")?.severity === "critical"} rows={6} value={evidence.criteriaIndicators} onChange={(event) => updateEvidence({ criteriaIndicators: event.target.value })} />{issueFor("criteriaIndicators") ? <span className={styles.validationMessage}>{issueFor("criteriaIndicators")?.message}</span> : null}</label>
            <label className={validationClass("prompt")}>Prompt principal<textarea id="s4-prompt" aria-invalid={issueFor("prompt")?.severity === "critical"} rows={10} value={evidence.prompt} onChange={(event) => updateEvidence({ prompt: event.target.value })} />{issueFor("prompt") ? <span className={styles.validationMessage}>{issueFor("prompt")?.message}</span> : null}</label>
            <label className={validationClass("aiDraft")}>Borrador de IA o contingencia<textarea id="s4-draft" aria-invalid={issueFor("aiDraft")?.severity === "critical"} rows={8} value={evidence.aiDraft} onChange={(event) => updateEvidence({ aiDraft: event.target.value })} />{issueFor("aiDraft") ? <span className={styles.validationMessage}>{issueFor("aiDraft")?.message}</span> : null}</label>
            <label className={validationClass("evidenceAnalysis")}>Análisis de evidencia e inferencias<textarea id="s4-analysis" aria-invalid={issueFor("evidenceAnalysis")?.severity === "critical"} rows={7} value={evidence.evidenceAnalysis} onChange={(event) => updateEvidence({ evidenceAnalysis: event.target.value })} />{issueFor("evidenceAnalysis") ? <span className={styles.validationMessage}>{issueFor("evidenceAnalysis")?.message}</span> : null}</label>
            <label className={validationClass("generatedFeedback")}>Retroalimentación final: logro, evidencia y siguiente paso<textarea id="s4-feedback" aria-invalid={issueFor("generatedFeedback")?.severity === "critical"} rows={8} value={evidence.generatedFeedback} onChange={(event) => updateEvidence({ generatedFeedback: event.target.value })} />{issueFor("generatedFeedback") ? <span className={styles.validationMessage}>{issueFor("generatedFeedback")?.message}</span> : null}</label>
            <label className={validationClass("teacherReview")}>{currentDifficulty.key === "avanzado" ? "Revisión docente: conservar, ajustar y retirar con justificación" : "Revisión docente del borrador"}<textarea id="s4-review" aria-invalid={issueFor("teacherReview")?.severity === "critical"} rows={5} value={evidence.teacherReview} onChange={(event) => updateEvidence({ teacherReview: event.target.value })} />{issueFor("teacherReview") ? <span className={styles.validationMessage}>{issueFor("teacherReview")?.message}</span> : null}</label>
            <label className={validationClass("detectedRisk")}>{currentDifficulty.key === "avanzado" ? "Riesgo, sesgo, afirmación no sustentada y contraejemplo" : "Riesgo, sesgo o afirmación no sustentada"}<textarea id="s4-risk" aria-invalid={issueFor("detectedRisk")?.severity === "critical"} rows={5} value={evidence.detectedRisk} onChange={(event) => updateEvidence({ detectedRisk: event.target.value })} />{issueFor("detectedRisk") ? <span className={styles.validationMessage}>{issueFor("detectedRisk")?.message}</span> : null}</label>
            <label className={validationClass("adaptation")}>{currentDifficulty.key === "avanzado" ? "Apoyo, opción de acceso y alternativa sin IA" : currentDifficulty.key === "intermedio" ? "Opción de acceso, expresión o apoyo" : "Apoyo o adaptación transversal"}<textarea id="s4-adaptation" aria-invalid={issueFor("adaptation")?.severity === "critical"} rows={5} value={evidence.adaptation} onChange={(event) => updateEvidence({ adaptation: event.target.value })} />{issueFor("adaptation") ? <span className={styles.validationMessage}>{issueFor("adaptation")?.message}</span> : null}</label>
            <label className={validationClass("finalDecision")}>Decisión final y ajuste realizado<textarea id="s4-decision" aria-invalid={issueFor("finalDecision")?.severity === "critical"} rows={5} value={evidence.finalDecision} onChange={(event) => updateEvidence({ finalDecision: event.target.value })} />{issueFor("finalDecision") ? <span className={styles.validationMessage}>{issueFor("finalDecision")?.message}</span> : null}</label>
            <fieldset id="s4-checklist" tabIndex={-1} aria-invalid={issueFor("checklist")?.severity === "critical"} className={`${styles.checklist} ${validationClass("checklist")}`}><legend>Lista de cotejo · {checkedCount} de {currentEvidenceChecklist.length}</legend><p>Confirma todos los criterios de la ruta elegida. Si alguno no se cumple, corrige antes de enviar.</p>{currentEvidenceChecklist.map((item) => <label key={item}><input type="checkbox" checked={Boolean(checks[item])} onChange={(event) => { const next = { ...checks, [item]: event.target.checked }; setChecks(next); setProgressState({ kind: "idle" }); if (currentEvidenceChecklist.every((criterion) => next[criterion])) setValidationIssues((current) => current.filter((issue) => issue.key !== "checklist")); }} /><span>{item}</span></label>)}{issueFor("checklist") ? <span className={styles.validationMessage}>{issueFor("checklist")?.message}</span> : null}</fieldset>
            <p className={styles.privacyNote}><strong>Antes de guardar:</strong> usa el mismo correo de la asistencia y no incluyas nombres, matrículas, diagnósticos ni otros datos personales del alumnado.</p>
            {validationIssues.length ? <div className={styles.validationSummary} role="alert"><h3>{validationIssues.some((issue) => issue.severity === "critical") ? "No se puede acreditar todavía" : "Hay información complementaria pendiente"}</h3><p>{validationIssues.some((issue) => issue.severity === "critical") ? "Corrige los requisitos críticos enumerados. Tu avance quedó conservado." : "Puedes completar estos datos o guardar la evidencia con las advertencias visibles."}</p><ol>{validationIssues.map((issue) => <li key={`${issue.key}-${issue.severity}`} data-severity={issue.severity}><button type="button" onClick={() => focusIssue(issue)}><strong>{issue.section} → {issue.label}</strong><span>{issue.message}</span></button></li>)}</ol><div className={styles.inlineActions}>{validationIssues.some((issue) => issue.severity === "critical") ? <><button type="button" className={styles.secondaryButton} onClick={() => persistProgress()}>Guardar avance</button><button type="button" className={styles.primaryButton} onClick={() => focusIssue(validationIssues.find((issue) => issue.severity === "critical")!)}>Ir al primer requisito crítico</button></> : <><button type="button" className={styles.secondaryButton} onClick={() => focusIssue(validationIssues[0])}>Volver y completar</button><button type="button" className={styles.primaryButton} onClick={() => void attemptEvidence(true)}>Guardar evidencia con advertencias</button></>}</div></div> : null}
            <div className={styles.inlineActions}><button className={styles.secondaryButton} type="button" onClick={() => persistProgress()}>Guardar avance sin acreditar</button><button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Guardando evidencia…" : "Guardar evidencia S4"}</button></div>
            <StatusBanner state={progressState} />
            <StatusBanner state={evidenceState} />
            <p className={styles.draftNote}>Tu borrador se mantiene solo en este dispositivo. La evidencia queda registrada cuando aparece el código de confirmación.</p>
          </form>
          <EvidencePdfDownload session="S4" email={evidence.email} pdfAccessCode={evidenceState.pdfAccessCode} />
        </section>

        <section className={styles.section} id="recursos">
          <SectionHeading eyebrow="Transferencia" title="Actividad semanal, recursos y contingencia" description="La actividad semanal se realiza fuera de los 90 minutos y no modifica la duración oficial." />
          <div className={styles.resourceGrid}>
            <article><span>Actividad semanal</span><h3>Retroalimentar, observar y ajustar</h3><ol><li>Elige una evidencia segura y anonimizada.</li><li>Define propósito y dos criterios.</li><li>Genera un borrador de retroalimentación.</li><li>Registra qué conservaste, corregiste o retiraste.</li><li>Escribe el siguiente paso que propondrás.</li></ol></article>
            <article>
              <span>Materiales</span>
              <h3>Descargas de Sesión 4</h3>
              <p>Materiales editables y versiones listas para imprimir.</p>
              <div className={styles.downloads}>
                <a href="/recursos/sesion-4/presentacion-principal-s4.pptx">Presentación principal editable</a>
                <a href="/recursos/sesion-4/cuadernillo-principal-s4.pdf">Cuadernillo principal PDF</a>
                <a href="/recursos/sesion-4/cuadernillo-preparacion-s4.pdf">Cuadernillo para principiantes</a>
                <a href="/recursos/sesion-4/hoja-trabajo-s4.docx">Hoja de trabajo editable</a>
                <a href="/recursos/sesion-4/banco-prompts-s4.pdf">Prompts, casos y ejemplos</a>
                <a href="/recursos/sesion-4/recursos-contingencia-s4.pdf">Contingencia y recursos del aula</a>
                <a href="/recursos/sesion-4/fundamentacion-s4.pdf">Fundamentación y bibliografía</a>
              </div>
            </article>
            <article><span>Contingencia</span><h3>La sesión continúa sin herramienta externa</h3><p>Usa el borrador simulado, trabaja en parejas y registra la revisión en esta plataforma. Si falla el envío, conserva el borrador local e intenta nuevamente.</p></article>
          </div>
          <div className={styles.faq}>{faq.map(([question, answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div>
        </section>

        <section className={styles.section} id="adicionales">
          <SectionHeading eyebrow="Opcionales" title="ACTIVIDADES ADICIONALES" description="Utilízalas solo si existe tiempo disponible. No sustituyen actividades obligatorias ni afectan la evidencia principal." />
          <div className={styles.resourceGrid}>{additionalActivities.map((item) => <article key={item.title}><span>{item.time}</span><h3>{item.title}</h3><p><strong>Propósito:</strong> {item.purpose}</p><p><strong>Instrucción:</strong> {item.instruction}</p><p><strong>Interacción:</strong> {item.interaction}</p><p><strong>Retroalimentación:</strong> {item.feedback}</p></article>)}</div>
        </section>

        <section className={styles.section}>
          <SectionHeading eyebrow="Opciones del ponente" title="PROPUESTAS PARA ENRIQUECER LA SESIÓN" description="Son propuestas de diseño AULA-IA, no requisitos ni resultados de investigación." />
          <div className={styles.infoGrid}>
            <article><h3>Galería anónima</h3><p>Comparar dos retroalimentaciones sin autoría y justificar cuál usa mejor la evidencia.</p></article>
            <article><h3>Revisión en parejas</h3><p>Intercambiar solo propósito, criterios y retroalimentación; nunca documentos ni datos personales del alumnado.</p></article>
            <article><h3>Transferencia entre niveles</h3><p>Adaptar el siguiente paso a otro nivel educativo modificando razonamiento, apoyo y evidencia esperada.</p></article>
          </div>
        </section>

        <section className={styles.section} id="fuentes">
          <SectionHeading eyebrow="Fundamentación discreta" title="Fuentes oficiales consultadas" description="Despliega esta sección solo si deseas cotejar los principios o las funciones de las herramientas." />
          <details className={styles.detailsCard}><summary>Mostrar fuentes y alcance de cada una</summary><div className={styles.sourceList}>{sourceLinks.map((item) => <article key={item.url}><div><strong>{item.label}</strong><p>{item.support}</p></div><a href={item.url} target="_blank" rel="noreferrer">Consultar fuente ↗</a></article>)}</div></details>
        </section>
      </div>

      <SessionNavigation current={4} position="bottom" />
      <footer className={styles.footer}><div><strong>AULA-IA · Sesión 4</strong><p>Evaluación con evidencia, retroalimentación y decisión docente.</p></div><div><a href="/">Sesión 1</a><a href="/sesion-2">Sesión 2</a><a href="/sesion-3">Sesión 3</a><a href="/sesion-4/preparacion">Preparación S4</a><a href="/sesion-5">Sesión 5</a><a href="#contenido">Volver arriba</a></div></footer>
    </main>
  );
}
