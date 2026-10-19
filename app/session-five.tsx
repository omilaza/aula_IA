"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { type FormEvent, useEffect, useState } from "react";
import EvidencePdfDownload from "./evidence-pdf-download";
import SessionNavigation from "./session-navigation";
import { hasWrittenContent } from "./session-five-validation";
import styles from "./session-two.module.css";
import {
  additionalActivities,
  analysisContingency,
  assessmentCycle,
  buildAnalysisPrompt,
  buildInstrumentPrompt,
  defaultSequence,
  difficultyContent,
  difficultyEvidenceChecklist,
  difficultyLevels,
  difficultyPromptRequirements,
  expectedDashboardMetrics,
  faq,
  instrumentContingency,
  instruments,
  mainActiveMinutes,
  mainAgenda,
  mainTotalMinutes,
  sequences,
  sessionFiveSimulationNotice,
  sessionFiveTitle,
  sourceLinks,
  studentResults,
  type DifficultyKey,
  type InstrumentKey,
  type SessionFiveCaseKey,
} from "./session-five-data";

type SaveState = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
  code?: string;
  pdfAccessCode?: string;
};

type EvidenceDraft = {
  email: string;
  sequenceKey: string;
  sequenceTitle: string;
  educationalLevel: string;
  subject: string;
  difficultyLevel: DifficultyKey;
  instrumentType: InstrumentKey;
  learningPurpose: string;
  pedagogicalContext: string;
  sourceCase: string;
  instrumentDesign: string;
  criteriaDescriptors: string;
  prompt: string;
  aiDraft: string;
  datasetSummary: string;
  findings: string;
  groupComparison: string;
  teacherDecision: string;
  limitations: string;
  adaptation: string;
};

type EvidenceIssue = {
  key: keyof EvidenceDraft | "checklist";
  fieldId: string;
  section: string;
  label: string;
  message: string;
  severity: "critical" | "warning";
};

const DRAFT_KEY = "aula-ia-s5-evidence-draft";
const IDENTITY_KEY = "aula-ia-s5-identity";
const CHECKS_KEY = "aula-ia-s5-route-checks";
const PROGRESS_KEY = "aula-ia-s5-progress";
const LEGACY_IMPACT_KEY = "aula-ia-s5-configuration-impacts";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const defaultInstrument = instruments[0];
const defaultDifficulty = difficultyLevels[0];

function dashboardSummary() {
  const metrics = expectedDashboardMetrics;
  return `50 participantes ficticios; ${metrics.submitted} evidencias; ${metrics.participationRate}% de entrega; promedio general ${metrics.overallAverage?.toFixed(2)} de 4. G1: ${metrics.groups.G1.average?.toFixed(2)}; G2: ${metrics.groups.G2.average?.toFixed(2)}; G3: ${metrics.groups.G3.average?.toFixed(2)}. Dos registros sin evidencia se conservan como datos faltantes.`;
}

function initialDraft(): EvidenceDraft {
  return {
    email: "",
    sequenceKey: defaultSequence.key,
    sequenceTitle: defaultSequence.title,
    educationalLevel: defaultSequence.level,
    subject: defaultSequence.subject,
    difficultyLevel: defaultDifficulty.key,
    instrumentType: defaultInstrument.key,
    learningPurpose: defaultSequence.learningPurpose,
    pedagogicalContext: defaultSequence.context,
    sourceCase: defaultSequence.sourceMaterial,
    instrumentDesign: "",
    criteriaDescriptors: defaultSequence.criteria.join("\n"),
    prompt: buildInstrumentPrompt(defaultSequence, defaultInstrument, defaultDifficulty.key),
    aiDraft: "",
    datasetSummary: dashboardSummary(),
    findings: "",
    groupComparison: "",
    teacherDecision: "",
    limitations: "",
    adaptation: "",
  };
}

function buildOwnSequencePrompt(
  draft: EvidenceDraft,
  instrument: (typeof instruments)[number],
  difficulty: DifficultyKey,
) {
  const requirements = difficultyPromptRequirements[difficulty]
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
  return `Actúa como asistente de diseño de instrumentos. Produce un BORRADOR para revisión docente.

SECUENCIA PROPIA · SIN DATOS PERSONALES
Nivel: ${draft.educationalLevel}
Asignatura: ${draft.subject}
Título: ${draft.sequenceTitle}
Propósito: ${draft.learningPurpose}
Contexto, producto y momentos: ${draft.pedagogicalContext}
Fuente o referencia autorizada: ${draft.sourceCase}

INSTRUMENTO
${instrument.label}. Uso: ${instrument.bestFor}
Evita este riesgo: ${instrument.risk}

RUTA ${difficulty.toUpperCase()}
${requirements}

Construye el instrumento, explica cómo aplicarlo, declara dos límites y propone una opción de acceso. No inventes datos del alumnado ni asignes una calificación final.`;
}

function buildOwnAnalysisPrompt(
  draft: EvidenceDraft,
  instrument: (typeof instruments)[number],
) {
  return `Actúa como analista de evidencias educativas. Trabaja únicamente con los 50 registros ficticios proporcionados en esta sesión.

SECUENCIA PROPIA · SIN DATOS PERSONALES
Nivel: ${draft.educationalLevel}
Asignatura: ${draft.subject}
Título: ${draft.sequenceTitle}
Propósito: ${draft.learningPurpose}
Instrumento aplicado: ${instrument.label}
Criterios: ${draft.criteriaDescriptors}

1. Resume entrega y desempeño por grupo.
2. Separa observaciones, inferencias y datos que faltan.
3. Identifica un patrón común y una diferencia entre grupos.
4. Propón una decisión docente y la evidencia que permitiría verificarla.
5. Declara límites: no inventes causas, perfiles ni calificaciones individuales.`;
}

async function postSessionFive(payload: Record<string, unknown>) {
  const response = await fetch("/api/session-five", {
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
    <div className={`${styles.status} ${styles[`status_${state.kind}`]}`} role={state.kind === "error" ? "alert" : "status"} aria-live="polite">
      <strong>{state.kind === "loading" ? "Procesando…" : state.kind === "success" ? "Listo" : "Revisa"}</strong>
      <span>{state.message}</span>
      {state.code ? <span className={styles.code}>Folio: {state.code}</span> : null}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}

function ToolLinks() {
  return (
    <div className={styles.toolLinks} aria-label="Herramientas externas opcionales">
      <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Abrir ChatGPT ↗</a>
      <a href="https://gemini.google.com/" target="_blank" rel="noreferrer">Abrir Gemini ↗</a>
      <a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer">Abrir NotebookLM ↗</a>
    </div>
  );
}

const participantMaterials = [
  {
    label: "Presentaciones",
    title: "Preparación y sesión principal",
    description: "Diapositivas verificadas para seguir ambas rutas de la Sesión 5.",
    links: [
      ["Preparación · PDF", "/recursos/sesion-5/presentacion-preparacion-s5.pdf"],
      ["Principal · PDF", "/recursos/sesion-5/presentacion-principal-s5.pdf"],
    ],
  },
  {
    label: "Guion de ejercicios",
    title: "Cuadernillos de trabajo",
    description: "Recorridos de preparación y principal para acompañar los laboratorios.",
    links: [
      ["Preparación · PDF", "/recursos/sesion-5/cuadernillo-preparacion-s5.pdf"],
      ["Principal · PDF", "/recursos/sesion-5/cuadernillo-principal-s5.pdf"],
    ],
  },
  {
    label: "Editables",
    title: "Hoja de trabajo",
    description: "Formato para registrar criterios, hallazgos, decisiones y nueva evidencia.",
    links: [
      ["Word editable", "/recursos/sesion-5/hoja-trabajo-s5.docx"],
      ["PDF imprimible", "/recursos/sesion-5/hoja-trabajo-s5.pdf"],
    ],
  },
  {
    label: "Prompts",
    title: "Banco de prompts, casos y ejercicios",
    description: "Prompts de apoyo ya incluidos en el paquete verificado de la sesión.",
    links: [
      ["Word editable", "/recursos/sesion-5/banco-prompts-s5.docx"],
      ["PDF imprimible", "/recursos/sesion-5/banco-prompts-s5.pdf"],
    ],
  },
  {
    label: "Instrumentos",
    title: "Plantillas de evaluación",
    description: "Plantillas de los instrumentos trabajados, listas para adaptar con revisión docente.",
    links: [
      ["Word editable", "/recursos/sesion-5/plantillas-instrumentos-s5.docx"],
      ["PDF imprimible", "/recursos/sesion-5/plantillas-instrumentos-s5.pdf"],
    ],
  },
  {
    label: "Datos ficticios",
    title: "Hoja de 50 registros",
    description: "Conjunto anónimo y simulado utilizado por el tablero del Laboratorio 2.",
    links: [["Descargar CSV", "/recursos/sesion-5/datos-ficticios-50-s5.csv"]],
  },
] as const;

export function SessionFive() {
  const [attendance, setAttendance] = useState({ fullName: "", email: "", institution: "", role: "Docente", consent: false });
  const [attendanceState, setAttendanceState] = useState<SaveState>({ kind: "idle" });
  const [registeredAttendanceEmail, setRegisteredAttendanceEmail] = useState("");
  const [selectedSequence, setSelectedSequence] = useState<SessionFiveCaseKey>(defaultSequence.key);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentKey>(defaultInstrument.key);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyKey>(defaultDifficulty.key);
  const [useOwnSequence, setUseOwnSequence] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceDraft>(initialDraft);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [copied, setCopied] = useState("");
  const [notice, setNotice] = useState("");
  const [progressState, setProgressState] = useState<SaveState>({ kind: "idle" });
  const [validationIssues, setValidationIssues] = useState<EvidenceIssue[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const currentSequence = sequences.find((item) => item.key === selectedSequence) ?? defaultSequence;
  const currentInstrument = instruments.find((item) => item.key === selectedInstrument) ?? defaultInstrument;
  const currentDifficulty = difficultyLevels.find((item) => item.key === selectedDifficulty) ?? defaultDifficulty;
  const currentChecklist = difficultyEvidenceChecklist[selectedDifficulty];
  const checkedCount = currentChecklist.filter((item) => checks[item]).length;
  const analysisPrompt = useOwnSequence
    ? buildOwnAnalysisPrompt(evidence, currentInstrument)
    : buildAnalysisPrompt(currentSequence, currentInstrument);
  const instrumentPrompt = useOwnSequence
    ? buildOwnSequencePrompt(evidence, currentInstrument, selectedDifficulty)
    : buildInstrumentPrompt(currentSequence, currentInstrument, selectedDifficulty);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const identity = JSON.parse(localStorage.getItem(IDENTITY_KEY) || "{}") as Partial<typeof attendance>;
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as Partial<EvidenceDraft>;
        const savedChecks = JSON.parse(localStorage.getItem(CHECKS_KEY) || "{}") as Record<string, boolean>;
        const savedProgress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") as { savedAt?: string };
        localStorage.removeItem(LEGACY_IMPACT_KEY);
        const identityEmail = String(identity.email || "").trim().toLowerCase();
        const savedEmail = String(saved.email || "").trim().toLowerCase();
        const linkedEmail = EMAIL_PATTERN.test(identityEmail) ? identityEmail : savedEmail;
        setAttendance((current) => ({ ...current, fullName: identity.fullName || "", email: linkedEmail, institution: identity.institution || "", role: identity.role || "Docente" }));
        const merged = { ...initialDraft(), ...saved, email: linkedEmail };
        setEvidence(merged);
        const matchedSequence = sequences.find((item) => item.key === merged.sequenceKey);
        const matchedInstrument = instruments.find((item) => item.key === merged.instrumentType);
        const matchedDifficulty = difficultyLevels.find((item) => item.key === merged.difficultyLevel);
        if (matchedSequence) setSelectedSequence(matchedSequence.key);
        else if (merged.sequenceKey === "propia") setUseOwnSequence(true);
        if (matchedInstrument) setSelectedInstrument(matchedInstrument.key);
        if (matchedDifficulty) setSelectedDifficulty(matchedDifficulty.key);
        setChecks(savedChecks);
        if (savedProgress.savedAt) {
          setProgressState({ kind: "success", message: `Avance local recuperado (${savedProgress.savedAt}). Aún no es una evidencia acreditada.` });
        }
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

  function invalidateSavedEvidence() {
    if (evidenceState.kind === "success") {
      setEvidenceState({ kind: "idle" });
      setNotice("Cambiaste el producto después de guardarlo. Envía de nuevo para obtener un folio y PDF actualizados.");
    }
  }

  function updateEvidence(patch: Partial<EvidenceDraft>) {
    invalidateSavedEvidence();
    const changedKeys = new Set(Object.keys(patch));
    setValidationIssues((current) => current.filter((issue) => !changedKeys.has(issue.key)));
    setProgressState({ kind: "idle" });
    setEvidence((current) => ({ ...current, ...patch }));
  }

  function authoritativeDraft() {
    return {
      ...evidence,
      email: evidence.email.trim().toLowerCase(),
      sequenceKey: useOwnSequence ? "propia" : currentSequence.key,
      sequenceTitle: useOwnSequence ? evidence.sequenceTitle : currentSequence.title,
      educationalLevel: useOwnSequence ? evidence.educationalLevel : currentSequence.level,
      subject: useOwnSequence ? evidence.subject : currentSequence.subject,
      difficultyLevel: selectedDifficulty,
      instrumentType: selectedInstrument,
      prompt: instrumentPrompt,
    };
  }

  function persistProgress(message = "Tu avance quedó guardado en este dispositivo. No genera folio ni acredita la sesión hasta completar los campos obligatorios vacíos.") {
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
    const addTextIssue = (
      key: keyof EvidenceDraft,
      fieldId: string,
      section: string,
      label: string,
      severity: EvidenceIssue["severity"],
    ) => {
      const value = String(evidence[key] ?? "").trim();
      if (hasWrittenContent(value)) return;
      issues.push({
        key,
        fieldId,
        section,
        label,
        severity,
        message: `${label}: este campo está vacío.`,
      });
    };

    const email = evidence.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      issues.push({ key: "email", fieldId: "s5-evidence-email", section: "Vinculación", label: "Correo usado en la asistencia", severity: "critical", message: "Correo usado en la asistencia: escribe un correo válido." });
    } else if (registeredAttendanceEmail && email !== registeredAttendanceEmail) {
      issues.push({ key: "email", fieldId: "s5-evidence-email", section: "Vinculación", label: "Correo usado en la asistencia", severity: "critical", message: "Correo usado en la asistencia: debe coincidir con el registro principal que acabas de realizar." });
    }

    if (useOwnSequence) {
      addTextIssue("sequenceTitle", "s5-sequence-title", "Secuencia propia", "Título de la secuencia", "critical");
      addTextIssue("subject", "s5-subject", "Secuencia propia", "Asignatura", "critical");
      addTextIssue("learningPurpose", "s5-learning-purpose", "Secuencia propia", "Propósito de aprendizaje", "critical");
      addTextIssue("pedagogicalContext", "s5-pedagogical-context", "Secuencia propia", "Contexto, producto y momentos", "critical");
    } else {
      addTextIssue("learningPurpose", "s5-learning-purpose", "Información complementaria", "Propósito de aprendizaje", "warning");
      addTextIssue("pedagogicalContext", "s5-pedagogical-context", "Información complementaria", "Contexto, producto y momentos", "warning");
    }
    addTextIssue("sourceCase", "s5-source-case", "Información complementaria", "Fuente o caso de referencia", "warning");

    addTextIssue("aiDraft", "s5-ai-draft", "Instrumento", "Borrador de IA o contingencia", "critical");
    addTextIssue("instrumentDesign", "s5-instrument-design", "Instrumento", "Instrumento final revisado", "critical");
    addTextIssue("criteriaDescriptors", "s5-criteria", "Instrumento", "Criterios, niveles o valores observables", "critical");
    addTextIssue("datasetSummary", "s5-dataset-summary", "Análisis de evidencias", "Resumen de datos y denominadores", "critical");
    addTextIssue("findings", "s5-findings", "Análisis de evidencias", "Hallazgos y pregunta pendiente", "critical");
    addTextIssue("groupComparison", "s5-group-comparison", "Análisis de evidencias", "Comparación de los tres grupos", "critical");
    addTextIssue("limitations", "s5-limitations", "Análisis de evidencias", "Datos faltantes y límites", "critical");
    addTextIssue("teacherDecision", "s5-teacher-decision", "Decisión docente", "Decisión docente, retroalimentación y evidencia de seguimiento", "critical");
    addTextIssue("adaptation", "s5-adaptation", "Decisión docente", "Adaptación o apoyo", "critical");

    const missingChecks = currentChecklist.filter((item) => !checks[item]);
    if (missingChecks.length) {
      issues.push({
        key: "checklist",
        fieldId: "s5-route-checklist",
        section: `Ruta ${currentDifficulty.label}`,
        label: `Preguntas de revisión (${currentChecklist.length})`,
        severity: "critical",
        message: `Ruta ${currentDifficulty.label}: faltan ${missingChecks.length} de ${currentChecklist.length} casillas: ${missingChecks.join(" · ")}`,
      });
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
    const issue = issueFor(key);
    if (!issue) return "";
    return issue.severity === "critical" ? styles.validationFieldError : styles.validationFieldWarning;
  }

  function chooseSequence(key: SessionFiveCaseKey) {
    const item = sequences.find((candidate) => candidate.key === key) ?? defaultSequence;
    if (!useOwnSequence && item.key === currentSequence.key) return;
    const canonicalContext = `${currentSequence.context}\nProducto: ${currentSequence.evidenceProduct}\nMomentos: ${currentSequence.moments.map((moment) => `${moment.label} ${moment.minutes} min`).join(", ")}.`;
    const metadataWasEdited = useOwnSequence || evidence.learningPurpose !== currentSequence.learningPurpose || evidence.pedagogicalContext !== canonicalContext || evidence.sourceCase !== currentSequence.sourceMaterial;
    if (metadataWasEdited && !window.confirm("Cambiar de secuencia sustituirá el título, propósito, contexto y fuente por los del caso elegido. Los productos de los laboratorios y las casillas se conservarán. ¿Deseas continuar?")) return;
    setSelectedSequence(item.key);
    setUseOwnSequence(false);
    setValidationIssues([]);
    setProgressState({ kind: "idle" });
    setEvidenceState({ kind: "idle" });
    setEvidence((current) => ({
      ...current,
      sequenceKey: item.key,
      sequenceTitle: item.title,
      educationalLevel: item.level,
      subject: item.subject,
      learningPurpose: item.learningPurpose,
      pedagogicalContext: `${item.context}\nProducto: ${item.evidenceProduct}\nMomentos: ${item.moments.map((moment) => `${moment.label} ${moment.minutes} min`).join(", ")}.`,
      sourceCase: item.sourceMaterial,
      prompt: buildInstrumentPrompt(item, currentInstrument, selectedDifficulty),
    }));
    setNotice("Secuencia actualizada. Tus productos y casillas se conservaron; al guardar solo se señalarán campos realmente vacíos.");
  }

  function chooseInstrument(key: InstrumentKey) {
    const item = instruments.find((candidate) => candidate.key === key) ?? defaultInstrument;
    if (item.key === selectedInstrument) return;
    setSelectedInstrument(item.key);
    setValidationIssues([]);
    setProgressState({ kind: "idle" });
    setEvidenceState({ kind: "idle" });
    setEvidence((current) => ({ ...current, instrumentType: item.key, prompt: useOwnSequence ? buildOwnSequencePrompt(current, item, selectedDifficulty) : buildInstrumentPrompt(currentSequence, item, selectedDifficulty) }));
    setNotice(`Instrumento seleccionado: ${item.label}. Tus textos y casillas se conservaron; puedes seguir comparando hasta elegir el que te convenga.`);
  }

  function chooseDifficulty(key: DifficultyKey) {
    if (key === selectedDifficulty) return;
    const nextDifficulty = difficultyLevels.find((item) => item.key === key) ?? defaultDifficulty;
    setSelectedDifficulty(key);
    setEvidenceState({ kind: "idle" });
    setProgressState({ kind: "idle" });
    setEvidence((current) => ({ ...current, difficultyLevel: key, prompt: useOwnSequence ? buildOwnSequencePrompt(current, currentInstrument, key) : buildInstrumentPrompt(currentSequence, currentInstrument, key) }));
    setValidationIssues((current) => current.filter((issue) => issue.key !== "checklist"));
    setNotice(`Ruta ${nextDifficulty.label} actualizada. Las respuestas y casillas compartidas se conservaron; los faltantes reales se mostrarán al guardar.`);
  }

  function startOwnSequence() {
    if (useOwnSequence) return;
    setUseOwnSequence(true);
    setValidationIssues([]);
    setProgressState({ kind: "idle" });
    setEvidenceState({ kind: "idle" });
    setEvidence((current) => ({ ...current, sequenceKey: "propia", sourceCase: current.sourceCase.trim() || "Secuencia propia autorizada, sin datos personales del alumnado.", prompt: buildOwnSequencePrompt(current, currentInstrument, selectedDifficulty) }));
    setNotice("Se conservaron tus textos y casillas como punto de partida. Completa únicamente los campos que dejes vacíos.");
  }

  async function handleAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttendanceState({ kind: "loading", message: "Registrando tu asistencia a la Sesión 5 principal…" });
    try {
      const normalizedEmail = attendance.email.trim().toLowerCase();
      const linkedAttendance = { ...attendance, email: normalizedEmail };
      const result = await postSessionFive({ action: "s5_main_attendance", ...linkedAttendance });
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(linkedAttendance));
      setAttendance(linkedAttendance);
      setRegisteredAttendanceEmail(normalizedEmail);
      setEvidence((current) => ({ ...current, email: normalizedEmail }));
      setAttendanceState({ kind: "success", message: typeof result.message === "string" ? result.message : "Asistencia registrada.", code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined });
    } catch (error) {
      setAttendanceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible registrar la asistencia." });
    }
  }

  async function handleEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await attemptEvidence();
  }

  async function attemptEvidence() {
    persistProgress("La información escrita quedó conservada como avance local mientras se valida la acreditación.");
    const issues = collectEvidenceIssues();
    const critical = issues.filter((issue) => issue.severity === "critical");
    const warnings = issues.filter((issue) => issue.severity === "warning");
    setValidationIssues(issues);
    if (critical.length) {
      setEvidenceState({ kind: "error", message: `Falta completar ${critical.length} campo${critical.length === 1 ? "" : "s"} obligatorio${critical.length === 1 ? "" : "s"}. Te mostramos cuál${critical.length === 1 ? "" : "es"} y dónde está${critical.length === 1 ? "" : "n"}; todo lo demás se conservó.` });
      focusIssue(critical[0]);
      return;
    }
    const evidenceEmail = evidence.email.trim().toLowerCase();
    const submission = {
      ...authoritativeDraft(),
      email: evidenceEmail,
      checklist: Object.fromEntries(currentChecklist.map((item) => [item, Boolean(checks[item])])),
    };
    setEvidenceState({ kind: "loading", message: "Guardando instrumento, análisis y decisión… No cierres esta página." });
    try {
      const result = await postSessionFive({ action: "s5_evidence", ...submission });
      const syncNote = result.sheetSync === "synced"
        ? " También quedó reflejada en la hoja institucional."
        : result.sheetSync === "failed"
          ? " La evidencia quedó protegida en la plataforma; la réplica institucional requiere revisión."
          : " La evidencia quedó protegida en la plataforma; la conexión institucional no está configurada en este entorno.";
      const warningNote = warnings.length ? ` Se guardó aunque ${warnings.length} campo${warnings.length === 1 ? "" : "s"} complementario${warnings.length === 1 ? "" : "s"} quedó${warnings.length === 1 ? "" : "aron"} vacío${warnings.length === 1 ? "" : "s"}.` : "";
      setEvidenceState({ kind: "success", message: `${typeof result.message === "string" ? result.message : "Evidencia guardada."}${warningNote}${syncNote}`, code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined, pdfAccessCode: typeof result.pdfAccessCode === "string" ? result.pdfAccessCode : undefined });
      setValidationIssues([]);
      setNotice("");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "No fue posible generar la evidencia.";
      setEvidenceState({ kind: "error", message: `La información quedó conservada como avance, pero ocurrió un problema al generar la evidencia: ${detail}` });
    }
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("error");
    }
  }

  function downloadCsv() {
    const header = "id,grupo,k1,k2,k3,k4,entrega,nivel";
    const rows = studentResults.map((item) => [item.id, item.group, item.k1 ?? "", item.k2 ?? "", item.k3 ?? "", item.k4 ?? "", item.submitted ? "Sí" : "No", item.level].join(","));
    const blob = new Blob([`\uFEFF${[header, ...rows].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "AULA-IA_S5_50-resultados-ficticios.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const metrics = expectedDashboardMetrics;

  return (
    <main className={`${styles.shell} ${styles.sessionFiveShell}`}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="AULA-IA, volver al inicio"><span aria-hidden="true">AI</span><span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span></a>
        <nav aria-label="Navegación de Sesión 5"><a href="/sesion-4">Sesión 4</a><a href="#laboratorio-1">Laboratorio 1</a><a href="#laboratorio-2">Laboratorio 2</a><a href="#materiales">Materiales</a><a href="#evidencia">Evidencia</a><a href="/sesion-5/preparacion">Principiantes</a></nav>
      </header>
      <SessionNavigation current={5} position="top" />

      <div id="contenido">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Sesión 5 de 6 · Ruta principal</p>
            <h1>Del instrumento a una decisión verificable</h1>
            <p className={styles.lede}>{sessionFiveTitle}. Diseña con criterios observables, lee patrones sin inventar causas y conserva la decisión profesional en manos docentes.</p>
            <div className={styles.metrics}><span><strong>{mainTotalMinutes}</strong> minutos exactos</span><span><strong>{mainActiveMinutes}</strong> de aplicación</span><span><strong>50</strong> registros ficticios</span><span><strong>2</strong> laboratorios enlazados</span></div>
            <div className={styles.heroActions}><a className={styles.primaryButton} href="#registro-principal">Registrar asistencia</a><a className={styles.secondaryButton} href="/sesion-5/preparacion">Abrir preparación</a></div>
            <p className={styles.microcopy}>{sessionFiveSimulationNotice}</p>
          </div>
          <figure className={styles.heroImage}><img src="/recursos/sesion-5/hero-instrumentos-evidencias-s5.png" alt="Docentes relacionan evidencias anónimas, instrumentos y un tablero para decidir el siguiente paso" width="1536" height="1024" /><figcaption>La IA ayuda a organizar; la evidencia, el contexto y el juicio docente sostienen la decisión.</figcaption></figure>
        </section>

        <section className={styles.routeStrip} aria-label="Rutas disponibles">
          <div><span>Ruta de apoyo</span><strong>Principiantes · 60 min</strong><p>Lista de cotejo, ocho resultados ficticios y evidencia de nivelación no acreditable.</p><a href="/sesion-5/preparacion">Abrir preparación</a></div>
          <div className={styles.routeActive}><span>Ruta oficial</span><strong>Principal · 90 min</strong><p>Cinco instrumentos, cuatro secuencias, tablero de 50 resultados y evidencia acreditable.</p><a href="#registro-principal">Continuar aquí</a></div>
        </section>

        <section className={styles.section} id="registro-principal">
          <SectionHeading eyebrow="Asistencia oficial" title="Registra tu entrada a la Sesión 5 principal" description="La preparación tiene su propio registro. Utiliza el mismo correo para vincular asistencia, evidencia, folio y PDF." />
          <form className={`${styles.form} ${styles.cardForm}`} onSubmit={handleAttendance}>
            <div className={styles.twoColumns}>
              <label>Nombre completo<input required value={attendance.fullName} onChange={(event) => setAttendance({ ...attendance, fullName: event.target.value })} autoComplete="name" /></label>
              <label>Correo electrónico<input required type="email" value={attendance.email} onChange={(event) => setAttendance({ ...attendance, email: event.target.value })} autoComplete="email" /></label>
              <label>Institución<input required value={attendance.institution} onChange={(event) => setAttendance({ ...attendance, institution: event.target.value })} autoComplete="organization" /></label>
              <label>Función<select value={attendance.role} onChange={(event) => setAttendance({ ...attendance, role: event.target.value })}><option>Docente</option><option>Directivo</option><option>Apoyo técnico-pedagógico</option><option>Estudiante normalista</option><option>Otra función educativa</option></select></label>
            </div>
            <label className={styles.consent}><input type="checkbox" checked={attendance.consent} onChange={(event) => setAttendance({ ...attendance, consent: event.target.checked })} /><span>Acepto el uso de estos datos para asistencia, seguimiento y acreditación. No se mostrarán al grupo.</span></label>
            <button className={styles.primaryButton} type="submit" disabled={attendanceState.kind === "loading"}>{attendanceState.kind === "loading" ? "Registrando…" : "Registrar asistencia principal"}</button>
            <StatusBanner state={attendanceState} />
          </form>
        </section>

        <section className={styles.section} id="agenda">
          <SectionHeading eyebrow="Ruta comprobable" title="90 minutos exactos; 75 de trabajo aplicado" description="La explicación ocupa 15 minutos. El resto se dedica a comparar, construir, analizar, revisar y producir evidencia." />
          <ol className={styles.agenda}>{mainAgenda.map((item) => <li key={item.time} className={item.active ? styles.agendaActive : ""}><span>{item.time} min</span><div><strong>{item.label}</strong><p>{item.detail}</p></div>{item.active ? <em>Aplicación</em> : null}</li>)}</ol>
        </section>

        <section className={`${styles.section} ${styles.quoteSection}`}>
          <p className={styles.eyebrow}>Frase detonadora · propuesta AULA-IA</p>
          <blockquote>“Un promedio resume; una decisión docente necesita volver a la evidencia.”</blockquote>
          <details><summary>Pregunta para dialogar</summary><p>¿Qué información pierde una tabla cuando transforma productos complejos en una sola cifra y qué debe revisar la persona docente antes de actuar?</p></details>
        </section>

        <section className={styles.section}>
          <SectionHeading eyebrow="Ciclo de trabajo" title="La decisión no termina el proceso: genera nueva evidencia" description="La IA puede apoyar el borrador del instrumento y el análisis. La trazabilidad y la responsabilidad permanecen en la revisión docente." />
          <div className={styles.cycleMap} aria-label="Ciclo de secuencia, evidencia, instrumento, datos, patrón, retroalimentación, decisión docente y nueva evidencia">
            {assessmentCycle.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><p>{index === 6 ? "Elegir y justificar una acción" : index === 7 ? "Comprobar el efecto del ajuste" : "Conservar trazabilidad"}</p></div>)}
          </div>
        </section>

        <section className={styles.section} id="laboratorio-1">
          <SectionHeading eyebrow="Laboratorio 1 · 22 minutos" title="Deriva un instrumento de una secuencia, no de una plantilla vacía" description="Elige una secuencia ficticia completa o registra una propia sin datos personales. Si tu secuencia todavía no está lista, el botón de contingencia carga un caso simulado." />
          <div className={styles.caseTabs} role="group" aria-label="Secuencias ficticias por nivel">
            {sequences.map((item) => <button key={item.key} type="button" aria-pressed={!useOwnSequence && selectedSequence === item.key} onClick={() => chooseSequence(item.key)}><span>{item.level} · {item.grade}</span><strong>{item.subject} · {item.title}</strong></button>)}
          </div>
          <div className={styles.inlineActions}><button type="button" className={styles.secondaryButton} onClick={startOwnSequence}>Usar mi propia secuencia</button><button type="button" className={styles.secondaryButton} onClick={() => chooseSequence(defaultSequence.key)}>No tengo una secuencia completa: cargar caso simulado</button></div>

          {useOwnSequence ? (
            <div className={`${styles.ownSequencePanel} ${styles.form}`}>
              <h3>Secuencia propia · sin datos del alumnado</h3>
              <div className={styles.twoColumns}>
                <label>Nivel educativo<select value={evidence.educationalLevel} onChange={(event) => updateEvidence({ educationalLevel: event.target.value })}><option>Educación básica</option><option>Secundaria</option><option>Educación media superior</option><option>Educación superior</option></select></label>
                <label>Asignatura general<input value={evidence.subject} onChange={(event) => updateEvidence({ subject: event.target.value })} placeholder="Historia, Filosofía, Lengua…" /></label>
                <label>Título<input value={evidence.sequenceTitle} onChange={(event) => updateEvidence({ sequenceTitle: event.target.value })} /></label>
                <label>Propósito observable<input value={evidence.learningPurpose} onChange={(event) => updateEvidence({ learningPurpose: event.target.value })} /></label>
              </div>
              <label>Contexto, duración, producto e inicio/desarrollo/cierre<textarea rows={6} value={evidence.pedagogicalContext} onChange={(event) => updateEvidence({ pedagogicalContext: event.target.value })} /></label>
              <label>Fuente o caso autorizado<textarea rows={4} value={evidence.sourceCase} onChange={(event) => updateEvidence({ sourceCase: event.target.value })} /></label>
              <label>Criterios observables<textarea rows={5} value={evidence.criteriaDescriptors} onChange={(event) => updateEvidence({ criteriaDescriptors: event.target.value })} /></label>
            </div>
          ) : (
            <div className={styles.caseCard}>
              <div><p className={styles.eyebrow}>Secuencia seleccionada · ficticia</p><h3>{currentSequence.title}</h3><p><strong>Propósito:</strong> {currentSequence.learningPurpose}</p><p><strong>Producto:</strong> {currentSequence.evidenceProduct}</p><p><strong>Diagnóstico:</strong> {currentSequence.diagnosticStartingPoint}</p><p><strong>Inclusión:</strong> {currentSequence.inclusion.join(" · ")}</p></div>
              <div><details open><summary>Inicio, desarrollo y cierre completos</summary>{currentSequence.moments.map((moment) => <article key={moment.label}><p><strong>{moment.label} · {moment.minutes} min</strong></p><p><strong>Docente:</strong> {moment.teacherActions}</p><p><strong>Alumnado:</strong> {moment.studentActions}</p><p><strong>Evidencia:</strong> {moment.evidence}</p></article>)}</details><details><summary>Fuente ficticia y límites</summary><pre>{currentSequence.sourceMaterial}</pre></details></div>
            </div>
          )}

          <h3>Compara y elige uno de cinco instrumentos</h3>
          <div className={styles.instrumentGrid} role="group" aria-label="Tipos de instrumento">
            {instruments.map((item, index) => <button key={item.key} type="button" className={`${styles.instrumentCard} ${selectedInstrument === item.key ? styles.instrumentSelected : ""}`} aria-pressed={selectedInstrument === item.key} onClick={() => chooseInstrument(item.key)}><span>{index + 1}</span><strong>{item.label}</strong><p>{item.bestFor}</p><small>Riesgo: {item.risk}</small></button>)}
          </div>

          <div className={styles.levelGrid} role="group" aria-label="Dificultad opcional">
            {difficultyLevels.map((item) => <article key={item.key}><span>{item.label}</span><h3>{item.description}</h3><p>{item.requirement}</p><button type="button" aria-pressed={selectedDifficulty === item.key} onClick={() => chooseDifficulty(item.key)}>{selectedDifficulty === item.key ? "Ruta elegida" : "Elegir esta ruta"}</button></article>)}
          </div>
          {notice ? <p className={styles.note} role="status">{notice}</p> : null}

          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt del Laboratorio 1</p><h3>{useOwnSequence ? "Secuencia propia" : currentSequence.level} · {currentInstrument.label} · {currentDifficulty.label}</h3></div><button type="button" onClick={() => void copyText("instrumento", instrumentPrompt)}>{copied === "instrumento" ? "Copiado" : "Copiar prompt"}</button></div>
            <pre>{instrumentPrompt}</pre>
          </div>
          <ToolLinks />
          <details className={styles.sampleAnswer}><summary>No tengo acceso a una IA: cargar instrumento completo de contingencia</summary><pre>{instrumentContingency}</pre><button type="button" className={styles.secondaryButton} onClick={() => updateEvidence({ aiDraft: instrumentContingency })}>Usar este borrador</button></details>
          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Producción del instrumento</p><h3>Conserva el borrador y documenta el ajuste humano</h3><p>El instrumento final debe poder aplicarse, producir datos interpretables y declarar lo que no permite afirmar.</p></div>
            <div className={styles.form}>
              <label>Evidencias observables: criterios y descriptores finales<textarea rows={7} value={evidence.criteriaDescriptors} onChange={(event) => updateEvidence({ criteriaDescriptors: event.target.value })} placeholder="Criterio, niveles o valores, evidencia observable…" /></label>
              <label>Borrador de contingencia o de IA<textarea rows={10} value={evidence.aiDraft} onChange={(event) => updateEvidence({ aiDraft: event.target.value })} /></label>
              <label>Instrumento final revisado<textarea rows={12} value={evidence.instrumentDesign} onChange={(event) => updateEvidence({ instrumentDesign: event.target.value })} placeholder="Incluye protocolo de aplicación, instrumento, límites y opción de acceso." /></label>
            </div>
          </div>
        </section>

        <section className={styles.section} id="laboratorio-2">
          <SectionHeading eyebrow="Laboratorio 2 · 18 minutos" title="Analiza los mismos criterios en 50 resultados ficticios" description="El tablero conserva la secuencia y el instrumento del Laboratorio 1. Los vacíos son datos faltantes, no ceros; las diferencias describen patrones, no causas." />
          <div className={styles.linkedLab}><p className={styles.eyebrow}>Laboratorios enlazados</p><h3>{useOwnSequence ? evidence.sequenceTitle || "Secuencia propia" : currentSequence.title} → {currentInstrument.label}</h3><p>Los indicadores K1–K4 se leen con los criterios registrados arriba. Si cambias la secuencia o el instrumento, los textos compatibles se conservan y los campos que requieren revisión se señalan de inmediato.</p></div>

          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt del Laboratorio 2</p><h3>Análisis prudente del conjunto ficticio</h3></div><button type="button" onClick={() => void copyText("analisis", analysisPrompt)}>{copied === "analisis" ? "Copiado" : "Copiar prompt"}</button></div>
            <pre>{analysisPrompt}</pre>
          </div>

          <div className={styles.dashboardShell} aria-label="Tablero de 50 resultados ficticios">
            <h3>Tablero AULA-IA · tres grupos ficticios</h3><p>La vista resume; la decisión requiere volver al instrumento y a las evidencias.</p>
            <div className={styles.metricGrid}>
              <div className={styles.metricCard}><span>Participantes</span><strong>{metrics.total}</strong></div>
              <div className={styles.metricCard}><span>Evidencias</span><strong>{metrics.submitted}</strong></div>
              <div className={styles.metricCard}><span>Entrega</span><strong>{metrics.participationRate}%</strong></div>
              <div className={styles.metricCard}><span>Promedio / 4</span><strong>{metrics.overallAverage?.toFixed(2)}</strong></div>
            </div>
            <div className={styles.dashboardGrid}>
              <article className={styles.chartPanel}><h4>Promedio por grupo</h4><div className={styles.barChart}>{(["G1", "G2", "G3"] as const).map((group) => <div className={styles.barRow} key={group}><span>{group}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${((metrics.groups[group].average || 0) / 4) * 100}%` }} /></div><strong>{metrics.groups[group].average?.toFixed(2)}</strong></div>)}</div></article>
              <article className={styles.chartPanel}><h4>Promedio por criterio</h4><div className={styles.barChart}>{(["k1", "k2", "k3", "k4"] as const).map((key) => <div className={styles.barRow} key={key}><span>{key.toUpperCase()}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${((metrics.criterionAverages[key] || 0) / 4) * 100}%` }} /></div><strong>{metrics.criterionAverages[key]?.toFixed(2)}</strong></div>)}</div></article>
            </div>
            <article className={styles.chartPanel}><h4>Distribución de niveles</h4><div className={styles.levelDistribution}>{Object.entries(metrics.distribution).map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></article>
          </div>

          <div className={styles.decisionGrid}>
            <article><h3>Hallazgo</h3><p>K1 tiene el promedio más bajo. G1 y G3 muestran una diferencia de {metrics.groupGap?.toFixed(2)} puntos.</p></article>
            <article><h3>No permite afirmar</h3><p>El tablero no demuestra por qué existe la diferencia ni permite etiquetar capacidades individuales.</p></article>
            <article><h3>Decisión comprobable</h3><p>Modelar K1, ofrecer práctica guiada y recoger una evidencia breve de seguimiento.</p></article>
          </div>

          <div className={styles.inlineActions}><button type="button" className={styles.secondaryButton} onClick={downloadCsv}>Descargar hoja CSV ficticia</button><button type="button" className={styles.secondaryButton} onClick={() => updateEvidence({ aiDraft: `${evidence.aiDraft}\n\n${analysisContingency}`.trim() })}>Agregar análisis de contingencia al borrador</button></div>
          <details className={styles.detailsCard}><summary>Ver los 50 registros ficticios</summary><div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>ID anónimo</th><th>Grupo</th><th>K1</th><th>K2</th><th>K3</th><th>K4</th><th>Entrega</th><th>Nivel</th></tr></thead><tbody>{studentResults.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.group}</td><td>{item.k1 ?? "—"}</td><td>{item.k2 ?? "—"}</td><td>{item.k3 ?? "—"}</td><td>{item.k4 ?? "—"}</td><td>{item.submitted ? "Sí" : "No"}</td><td>{item.level}</td></tr>)}</tbody></table></div></details>

          <div className={`${styles.interaction} ${styles.form}`}>
            <label>Resumen del conjunto y denominadores<textarea rows={5} value={evidence.datasetSummary} onChange={(event) => updateEvidence({ datasetSummary: event.target.value })} /></label>
            <label>Hallazgos observables y pregunta pendiente<textarea rows={6} value={evidence.findings} onChange={(event) => updateEvidence({ findings: event.target.value })} placeholder="Separa dato, interpretación provisional y pregunta pendiente." /></label>
            <label>Comparación de G1, G2 y G3 sin atribuir causas<textarea rows={5} value={evidence.groupComparison} onChange={(event) => updateEvidence({ groupComparison: event.target.value })} /></label>
            <label>Datos faltantes, calidad y límites del análisis<textarea rows={5} value={evidence.limitations} onChange={(event) => updateEvidence({ limitations: event.target.value })} /></label>
            <label>Decisión docente: aceptar, adaptar o rechazar; reenseñanza y nueva evidencia<textarea rows={7} value={evidence.teacherDecision} onChange={(event) => updateEvidence({ teacherDecision: event.target.value })} /></label>
            <label>Adaptación de acceso, participación o expresión<textarea rows={4} value={evidence.adaptation} onChange={(event) => updateEvidence({ adaptation: event.target.value })} /></label>
          </div>
        </section>

        <section className={styles.section} id="evidencia">
          <SectionHeading eyebrow="Evidencia acreditable · 5 minutos" title="Instrumento, análisis y decisión docente vinculados" description={`${difficultyContent[selectedDifficulty].finalInstruction} Confirma la lista correspondiente a una sola ruta y espera el folio.`} />
          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence} noValidate>
            <div className={styles.summaryBox}><p><strong>Secuencia:</strong> {evidence.sequenceTitle || "Pendiente"}</p><p><strong>Instrumento:</strong> {currentInstrument.label}</p><p><strong>Ruta:</strong> {currentDifficulty.label}</p><p><strong>Conjunto:</strong> 50 registros ficticios · tres grupos</p></div>
            <div className={styles.twoColumns}>
              <label className={validationClass("email")}>Correo usado en la asistencia<input id="s5-evidence-email" aria-invalid={issueFor("email")?.severity === "critical"} aria-describedby={issueFor("email") ? "s5-evidence-email-message" : undefined} type="email" value={evidence.email} onChange={(event) => updateEvidence({ email: event.target.value })} />{issueFor("email") ? <span id="s5-evidence-email-message" className={styles.validationMessage}>{issueFor("email")?.message}</span> : null}</label>
              <label className={validationClass("sequenceTitle")}>Título de la secuencia<input id="s5-sequence-title" aria-invalid={issueFor("sequenceTitle")?.severity === "critical"} value={useOwnSequence ? evidence.sequenceTitle : currentSequence.title} readOnly={!useOwnSequence} onChange={(event) => updateEvidence({ sequenceTitle: event.target.value })} />{issueFor("sequenceTitle") ? <span className={styles.validationMessage}>{issueFor("sequenceTitle")?.message}</span> : null}</label>
              <label>Nivel educativo<select value={evidence.educationalLevel} onChange={(event) => updateEvidence({ educationalLevel: event.target.value })}><option>Educación básica</option><option>Secundaria</option><option>Educación media superior</option><option>Educación superior</option></select></label>
              <label className={validationClass("subject")}>Asignatura<input id="s5-subject" aria-invalid={issueFor("subject")?.severity === "critical"} value={useOwnSequence ? evidence.subject : currentSequence.subject} readOnly={!useOwnSequence} onChange={(event) => updateEvidence({ subject: event.target.value })} />{issueFor("subject") ? <span className={styles.validationMessage}>{issueFor("subject")?.message}</span> : null}</label>
            </div>
            <label className={validationClass("learningPurpose")}>Propósito de aprendizaje<textarea id="s5-learning-purpose" aria-invalid={issueFor("learningPurpose")?.severity === "critical"} rows={4} value={evidence.learningPurpose} onChange={(event) => updateEvidence({ learningPurpose: event.target.value })} />{issueFor("learningPurpose") ? <span className={styles.validationMessage}>{issueFor("learningPurpose")?.message}</span> : null}</label>
            <label className={validationClass("pedagogicalContext")}>Contexto, producto y momentos de la secuencia<textarea id="s5-pedagogical-context" aria-invalid={issueFor("pedagogicalContext")?.severity === "critical"} rows={6} value={evidence.pedagogicalContext} onChange={(event) => updateEvidence({ pedagogicalContext: event.target.value })} />{issueFor("pedagogicalContext") ? <span className={styles.validationMessage}>{issueFor("pedagogicalContext")?.message}</span> : null}</label>
            <label className={validationClass("sourceCase")}>Fuente o caso de referencia<textarea id="s5-source-case" aria-invalid={issueFor("sourceCase")?.severity === "critical"} rows={5} value={evidence.sourceCase} onChange={(event) => updateEvidence({ sourceCase: event.target.value })} />{issueFor("sourceCase") ? <span className={styles.validationMessage}>{issueFor("sourceCase")?.message}</span> : null}</label>
            <label>Prompt del instrumento<textarea rows={8} value={instrumentPrompt} readOnly /></label>
            <label className={validationClass("aiDraft")}>Borradores de IA o contingencia<textarea id="s5-ai-draft" aria-invalid={issueFor("aiDraft")?.severity === "critical"} rows={9} value={evidence.aiDraft} onChange={(event) => updateEvidence({ aiDraft: event.target.value })} />{issueFor("aiDraft") ? <span className={styles.validationMessage}>{issueFor("aiDraft")?.message}</span> : null}</label>
            <label className={validationClass("instrumentDesign")}>Instrumento final revisado<textarea id="s5-instrument-design" aria-invalid={issueFor("instrumentDesign")?.severity === "critical"} rows={11} value={evidence.instrumentDesign} onChange={(event) => updateEvidence({ instrumentDesign: event.target.value })} />{issueFor("instrumentDesign") ? <span className={styles.validationMessage}>{issueFor("instrumentDesign")?.message}</span> : null}</label>
            <label className={validationClass("criteriaDescriptors")}>Criterios, niveles o valores observables<textarea id="s5-criteria" aria-invalid={issueFor("criteriaDescriptors")?.severity === "critical"} rows={7} value={evidence.criteriaDescriptors} onChange={(event) => updateEvidence({ criteriaDescriptors: event.target.value })} />{issueFor("criteriaDescriptors") ? <span className={styles.validationMessage}>{issueFor("criteriaDescriptors")?.message}</span> : null}</label>
            <label className={validationClass("datasetSummary")}>Resumen de datos y denominadores<textarea id="s5-dataset-summary" aria-invalid={issueFor("datasetSummary")?.severity === "critical"} rows={5} value={evidence.datasetSummary} onChange={(event) => updateEvidence({ datasetSummary: event.target.value })} />{issueFor("datasetSummary") ? <span className={styles.validationMessage}>{issueFor("datasetSummary")?.message}</span> : null}</label>
            <label className={validationClass("findings")}>Hallazgos y pregunta pendiente<textarea id="s5-findings" aria-invalid={issueFor("findings")?.severity === "critical"} rows={6} value={evidence.findings} onChange={(event) => updateEvidence({ findings: event.target.value })} />{issueFor("findings") ? <span className={styles.validationMessage}>{issueFor("findings")?.message}</span> : null}</label>
            <label className={validationClass("groupComparison")}>Comparación de los tres grupos<textarea id="s5-group-comparison" aria-invalid={issueFor("groupComparison")?.severity === "critical"} rows={5} value={evidence.groupComparison} onChange={(event) => updateEvidence({ groupComparison: event.target.value })} />{issueFor("groupComparison") ? <span className={styles.validationMessage}>{issueFor("groupComparison")?.message}</span> : null}</label>
            <label className={validationClass("limitations")}>Datos faltantes y límites<textarea id="s5-limitations" aria-invalid={issueFor("limitations")?.severity === "critical"} rows={5} value={evidence.limitations} onChange={(event) => updateEvidence({ limitations: event.target.value })} />{issueFor("limitations") ? <span className={styles.validationMessage}>{issueFor("limitations")?.message}</span> : null}</label>
            <label className={validationClass("teacherDecision")}>Decisión docente, retroalimentación y evidencia de seguimiento<textarea id="s5-teacher-decision" aria-invalid={issueFor("teacherDecision")?.severity === "critical"} rows={7} value={evidence.teacherDecision} onChange={(event) => updateEvidence({ teacherDecision: event.target.value })} />{issueFor("teacherDecision") ? <span className={styles.validationMessage}>{issueFor("teacherDecision")?.message}</span> : null}</label>
            <label className={validationClass("adaptation")}>Adaptación o apoyo<textarea id="s5-adaptation" aria-invalid={issueFor("adaptation")?.severity === "critical"} rows={4} value={evidence.adaptation} onChange={(event) => updateEvidence({ adaptation: event.target.value })} />{issueFor("adaptation") ? <span className={styles.validationMessage}>{issueFor("adaptation")?.message}</span> : null}</label>
            <fieldset id="s5-route-checklist" tabIndex={-1} aria-invalid={issueFor("checklist")?.severity === "critical"} className={`${styles.checklist} ${validationClass("checklist")}`}><legend>Preguntas de revisión · {checkedCount} de {currentChecklist.length}</legend><p>Confirma únicamente la ruta elegida. Al subir de ruta se conservan las respuestas que siguen aplicando.</p>{currentChecklist.map((item) => <label key={item}><input type="checkbox" checked={Boolean(checks[item])} onChange={(event) => { invalidateSavedEvidence(); const nextChecks = { ...checks, [item]: event.target.checked }; setChecks(nextChecks); setProgressState({ kind: "idle" }); if (currentChecklist.every((criterion) => nextChecks[criterion])) setValidationIssues((current) => current.filter((issue) => issue.key !== "checklist")); }} /><span>{item}</span></label>)}{issueFor("checklist") ? <span className={styles.validationMessage}>{issueFor("checklist")?.message}</span> : null}</fieldset>
            <p className={styles.privacyCallout}><strong>Privacidad:</strong> utiliza exclusivamente los datos ficticios incluidos o una secuencia sin nombres, matrículas, diagnósticos ni documentos identificables del alumnado.</p>
            {validationIssues.length ? <div className={styles.validationSummary} role="alert" aria-live="assertive"><h3>{validationIssues.some((issue) => issue.severity === "critical") ? "Faltan datos para guardar" : "Información complementaria vacía"}</h3><p>{validationIssues.some((issue) => issue.severity === "critical") ? "Completa únicamente los campos vacíos indicados. Todo lo que ya escribiste permanece guardado como avance." : "Estos campos no bloquean el guardado; puedes completarlos cuando lo necesites."}</p><ol>{validationIssues.map((issue) => <li key={`${issue.key}-${issue.severity}`} data-severity={issue.severity}><button type="button" onClick={() => focusIssue(issue)}><strong>{issue.section} → {issue.label}</strong><span>{issue.message}</span></button></li>)}</ol><div className={styles.inlineActions}>{validationIssues.some((issue) => issue.severity === "critical") ? <><button type="button" className={styles.secondaryButton} onClick={() => persistProgress()}>Guardar avance</button><button type="button" className={styles.primaryButton} onClick={() => focusIssue(validationIssues.find((issue) => issue.severity === "critical")!)}>Ir al primer campo vacío</button></> : <button type="button" className={styles.secondaryButton} onClick={() => focusIssue(validationIssues[0])}>Ir al campo vacío</button>}</div></div> : null}
            <div className={styles.inlineActions}><button className={styles.secondaryButton} type="button" onClick={() => persistProgress()}>Guardar avance sin acreditar</button><button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Guardando…" : "Guardar evidencia S5"}</button></div>
            <StatusBanner state={progressState} />
            <StatusBanner state={evidenceState} />
          </form>
          <EvidencePdfDownload session="S5" email={evidence.email} pdfAccessCode={evidenceState.pdfAccessCode} />
        </section>

        <section className={styles.section} id="materiales">
          <SectionHeading eyebrow="Materiales de apoyo" title="Descargas verificadas para participantes" description="Sólo se incluyen recursos de trabajo de la Sesión 5. El manual del instructor, el teleprompter, los planes de prueba y la evidencia técnica permanecen fuera de esta zona." />
          <div className={styles.resourceGrid}>{participantMaterials.map((item) => <article key={item.title}><span>{item.label}</span><h3>{item.title}</h3><p>{item.description}</p><div className={styles.downloads}>{item.links.map(([label, href]) => <a key={href} href={href} download>{label}</a>)}</div></article>)}</div>
        </section>

        <section className={styles.section} id="adicionales">
          <SectionHeading eyebrow="Fuera de los 90 minutos" title="ACTIVIDADES ADICIONALES" description="Son opciones si existe tiempo disponible; no sustituyen los dos laboratorios ni la evidencia acreditable." />
          <div className={styles.resourceGrid}>{additionalActivities.map((item) => <article key={item.title}><span>{item.time}</span><h3>{item.title}</h3><p><strong>Propósito:</strong> {item.purpose}</p><p><strong>Instrucción:</strong> {item.instruction}</p><p><strong>Interacción:</strong> {item.interaction}</p><p><strong>Retroalimentación:</strong> {item.feedback}</p></article>)}</div>
        </section>

        <section className={styles.section} id="fuentes">
          <SectionHeading eyebrow="Cotejo opcional" title="Fuentes oficiales y límites" description="Los vínculos se mantienen al final para no interrumpir la práctica. Las secuencias, los datos y la metodología AULA-IA se identifican como simulaciones o propuestas." />
          <details className={styles.detailsCard}><summary>Desplegar fuentes consultadas</summary><div className={styles.sourceList}>{sourceLinks.map((item) => <article key={item.url}><div><strong>{item.label}</strong><p>{item.support}</p></div><a href={item.url} target="_blank" rel="noreferrer">Consultar fuente ↗</a></article>)}</div></details>
          <details className={styles.detailsCard}><summary>Preguntas frecuentes</summary><div className={styles.faq}>{faq.map(([question, answer]) => <article key={question}><strong>{question}</strong><p>{answer}</p></article>)}</div></details>
          <div className={styles.futureCard}><div><p className={styles.eyebrow}>Cierre del curso</p><h3>Sesión 6 · Integración y producto final</h3><p>Recupera los productos anteriores, integra el proyecto final y revisa su congruencia antes de transferirlo a la práctica.</p></div><div className={styles.heroActions}><a className={styles.secondaryButton} href="/sesion-6">Abrir Sesión 6</a><a className={styles.primaryButton} href="/encuesta-satisfaccion">Encuesta de satisfacción del curso</a></div></div>
        </section>
      </div>

      <SessionNavigation current={5} position="bottom" />
      <footer className={styles.footer}><div><strong>AULA-IA · Sesión 5</strong><p>Instrumentos, evidencia, patrones y decisión docente.</p></div><div><a href="/">Sesión 1</a><a href="/sesion-4">Sesión 4</a><a href="/sesion-5/preparacion">Preparación S5</a><a href="/sesion-6">Sesión 6</a><a href="/encuesta-satisfaccion">Encuesta de satisfacción del curso</a><a href="#contenido">Volver arriba</a></div></footer>
    </main>
  );
}
