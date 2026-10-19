"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import EvidencePdfDownload from "./evidence-pdf-download";
import SessionNavigation from "./session-navigation";
import styles from "./session-two.module.css";
import {
  cases,
  claimCheck,
  courseSource,
  digitalQuestions,
  evidenceChecklist,
  faq,
  mainAgenda,
  prepPrompt,
  promptLevels,
  sessionTwoTitle,
} from "./session-two-data";

type SaveState = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
  code?: string;
  pdfAccessCode?: string;
};

type DiagnosticResult = {
  identifiedLevel: string;
  recommendedRoute: string;
  recommendationMessage: string;
  confirmationCode: string;
};

type EvidenceDraft = {
  email: string;
  productTitle: string;
  purpose: string;
  pedagogicalContext: string;
  sources: string;
  prompt: string;
  aiResult: string;
  teacherReview: string;
  detectedRisk: string;
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

const DRAFT_KEY = "aula-ia-s2-evidence-draft";
const IDENTITY_KEY = "aula-ia-s2-identity";
const CHECKS_KEY = "aula-ia-s2-evidence-checks";
const PROGRESS_KEY = "aula-ia-s2-progress";
const IMPACT_KEY = "aula-ia-s2-configuration-impacts";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildCasePrompt(item: (typeof cases)[number]) {
  return `Trabaja únicamente con la FUENTE.\n\nCONTEXTO PEDAGÓGICO\nNivel: ${item.level}.\nPropósito: ${item.purpose}\n\nENCARGO\nCrea: ${item.product}\nDistingue con la etiqueta PROPUESTA lo que tú agregues. Si una conclusión no está sustentada, escribe REQUIERE VERIFICACIÓN. No uses datos personales.\n\nFUENTE\n${item.source}\nFIN DE LA FUENTE`;
}

const initialEvidence: EvidenceDraft = {
  email: "",
  productTitle: "Microrecurso docente fundamentado",
  purpose: cases[0].purpose,
  pedagogicalContext: `${cases[0].level}; actividad breve; contexto general sin datos personales.`,
  sources: cases[0].title,
  prompt: buildCasePrompt(cases[0]),
  aiResult: "",
  teacherReview: "",
  detectedRisk: "",
  adjustment: "",
};

const pieceQuestions = [
  { text: "Fragmento de un texto autorizado que aporta información", answer: "fuente" },
  { text: "Nivel, área, propósito, tiempo y recursos disponibles", answer: "contexto" },
  { text: "Producto, formato, extensión y límites solicitados", answer: "encargo" },
  { text: "Comprobación de fidelidad, utilidad y riesgos", answer: "revision" },
] as const;

const fielQuestions = [
  { text: "La definición generada contradice el fragmento.", answer: "Fidelidad" },
  { text: "La actividad dura 45 minutos, pero se pidieron 15.", answer: "Encaje" },
  { text: "El recurso es atractivo, pero no practica el propósito.", answer: "Intención" },
  { text: "Una recomendación inventada aparece como dato institucional.", answer: "Límites" },
] as const;

async function postSessionTwo(payload: Record<string, unknown>) {
  const response = await fetch("/api/session-two", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "No fue posible guardar la respuesta.");
  return result;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
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

export function SessionTwo() {
  const [diagnostic, setDiagnostic] = useState({ fullName: "", email: "", answers: Array(13).fill("") as string[] });
  const [diagnosticState, setDiagnosticState] = useState<SaveState>({ kind: "idle" });
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [attendance, setAttendance] = useState({ fullName: "", email: "", institution: "", role: "Docente", consent: false });
  const [attendanceState, setAttendanceState] = useState<SaveState>({ kind: "idle" });
  const [registeredAttendanceEmail, setRegisteredAttendanceEmail] = useState("");
  const [selectedCase, setSelectedCase] = useState<(typeof cases)[number]["key"]>("basica");
  const [evidence, setEvidence] = useState<EvidenceDraft>(initialEvidence);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState("");
  const [pieceAnswers, setPieceAnswers] = useState<string[]>(Array(pieceQuestions.length).fill(""));
  const [pieceScore, setPieceScore] = useState<number | null>(null);
  const [claimAnswers, setClaimAnswers] = useState<string[]>(Array(claimCheck.length).fill(""));
  const [claimScore, setClaimScore] = useState<number | null>(null);
  const [fielAnswers, setFielAnswers] = useState<string[]>(Array(fielQuestions.length).fill(""));
  const [fielScore, setFielScore] = useState<number | null>(null);
  const [progressState, setProgressState] = useState<SaveState>({ kind: "idle" });
  const [validationIssues, setValidationIssues] = useState<EvidenceIssue[]>([]);
  const [configurationImpacts, setConfigurationImpacts] = useState<EvidenceIssue[]>([]);

  const currentCase = cases.find((item) => item.key === selectedCase) ?? cases[0];
  const totalMinutes = mainAgenda.reduce((sum, item) => sum + item.minutes, 0);
  const activeMinutes = mainAgenda.filter((item) => item.active).reduce((sum, item) => sum + item.minutes, 0);
  const checkedCount = Object.values(checks).filter(Boolean).length;

  const casePrompt = useMemo(
    () => buildCasePrompt(currentCase),
    [currentCase],
  );

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
        setDiagnostic((current) => ({ ...current, fullName: identity.fullName || "", email: linkedEmail }));
        setAttendance((current) => ({ ...current, fullName: identity.fullName || "", email: linkedEmail, institution: identity.institution || "", role: identity.role || "Docente" }));
        setEvidence({ ...initialEvidence, ...saved, email: linkedEmail });
        setChecks(savedChecks);
        if (Array.isArray(savedImpacts)) { setConfigurationImpacts(savedImpacts); setValidationIssues(savedImpacts); }
        if (savedProgress.savedAt) setProgressState({ kind: "success", message: `Avance local recuperado (${savedProgress.savedAt}). Aún no es una evidencia acreditada.` });
      } catch {
        // Un borrador corrupto no debe impedir el uso de la sesión.
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

  function persistProgress(message = "Tu avance quedó guardado en este dispositivo. No genera folio ni acredita la sesión hasta completar los requisitos críticos.") {
    const savedAt = new Date().toLocaleString("es-MX");
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(evidence));
      localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ savedAt, email: evidence.email.trim().toLowerCase(), status: "avance-local" }));
      setProgressState({ kind: "success", message });
    } catch {
      setProgressState({ kind: "error", message: "No fue posible confirmar el guardado local. Mantén esta página abierta mientras corriges los pendientes." });
    }
  }

  function collectEvidenceIssues() {
    const issues: EvidenceIssue[] = [];
    const add = (key: keyof EvidenceDraft, fieldId: string, label: string, minimum: number, severity: EvidenceIssue["severity"]) => {
      const length = String(evidence[key] || "").trim().length;
      if (length < minimum) issues.push({ key, fieldId, section: severity === "critical" ? "Evidencia" : "Información complementaria", label, severity, message: `${label}: escribe al menos ${minimum} caracteres; actualmente hay ${length}.` });
    };
    const email = evidence.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) issues.push({ key: "email", fieldId: "s2-email", section: "Vinculación", label: "Correo usado en la asistencia", severity: "critical", message: "Escribe un correo válido." });
    else if (registeredAttendanceEmail && email !== registeredAttendanceEmail) issues.push({ key: "email", fieldId: "s2-email", section: "Vinculación", label: "Correo usado en la asistencia", severity: "critical", message: "Debe coincidir con la asistencia principal registrada." });
    add("productTitle", "s2-title", "Título del producto", 5, "warning");
    add("purpose", "s2-purpose", "Propósito docente", 10, "critical");
    add("pedagogicalContext", "s2-context", "Contexto pedagógico", 20, "critical");
    add("sources", "s2-sources", "Fuente o fragmento utilizado", 5, "critical");
    add("prompt", "s2-prompt", "Prompt principal", 30, "critical");
    add("aiResult", "s2-result", "Resultado de IA o contingencia", 30, "critical");
    add("teacherReview", "s2-review", "Revisión docente", 20, "critical");
    add("detectedRisk", "s2-risk", "Riesgo o limitación", 10, "critical");
    add("adjustment", "s2-adjustment", "Ajuste realizado", 15, "critical");
    const missing = evidenceChecklist.filter((item) => !checks[item]);
    if (checkedCount < 4) issues.push({ key: "checklist", fieldId: "s2-checklist", section: "Lista de cotejo", label: "Cuatro confirmaciones mínimas", severity: "critical", message: `Faltan ${4 - checkedCount} confirmaciones para llegar al mínimo de 4. Pendientes disponibles: ${missing.join(" · ")}` });
    for (const impact of configurationImpacts) if (!issues.some((issue) => issue.key === impact.key)) issues.push(impact);
    return issues;
  }

  function focusIssue(issue: EvidenceIssue) { window.requestAnimationFrame(() => { const element = document.getElementById(issue.fieldId); element?.scrollIntoView({ behavior: "smooth", block: "center" }); element?.focus({ preventScroll: true }); }); }
  function issueFor(key: EvidenceIssue["key"]) { return validationIssues.find((issue) => issue.key === key); }
  function validationClass(key: EvidenceIssue["key"]) { const issue = issueFor(key); return !issue ? "" : issue.severity === "critical" ? styles.validationFieldError : styles.validationFieldWarning; }

  function rememberIdentity(data: { fullName: string; email: string; institution?: string; role?: string }) {
    const linked = { ...data, email: data.email.trim().toLowerCase() };
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(linked));
    setRegisteredAttendanceEmail(linked.email);
    setEvidence((current) => ({ ...current, email: linked.email }));
  }

  async function handleDiagnostic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDiagnosticState({ kind: "loading", message: "Analizando tus respuestas para recomendarte una ruta…" });
    try {
      const answers = Object.fromEntries(diagnostic.answers.map((value, index) => [`H${index + 1}`, value]));
      const result = await postSessionTwo({ action: "digital_diagnostic", fullName: diagnostic.fullName, email: diagnostic.email, answers });
      const next = result as unknown as DiagnosticResult;
      setDiagnosticResult(next);
      rememberIdentity({ fullName: diagnostic.fullName, email: diagnostic.email });
      setDiagnosticState({ kind: "success", message: "Orientación completada. No es una calificación.", code: next.confirmationCode });
    } catch (error) {
      setDiagnosticState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar la orientación." });
    }
  }

  async function handleAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttendanceState({ kind: "loading", message: "Registrando tu asistencia principal…" });
    try {
      const result = await postSessionTwo({ action: "s2_main_attendance", ...attendance });
      rememberIdentity(attendance);
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
    if (critical.length) { setEvidenceState({ kind: "error", message: `No podemos acreditar todavía: hay ${critical.length} requisitos críticos. Están enumerados y resaltados.` }); focusIssue(critical[0]); return; }
    if (warnings.length && !acceptWarnings) { setEvidenceState({ kind: "idle" }); focusIssue(warnings[0]); return; }
    setEvidenceState({ kind: "loading", message: "Guardando evidencia de la Sesión 2… No cierres esta página." });
    try {
      const checklist = Object.fromEntries(evidenceChecklist.map((item) => [item, Boolean(checks[item])]));
      const result = await postSessionTwo({ action: "s2_evidence", ...evidence, checklist });
      const syncNote = result.sheetSync === "synced" ? " También quedó reflejada en la hoja institucional." : " El registro principal quedó protegido en la plataforma; la copia institucional podrá sincronizarse en cuanto el enlace esté disponible.";
      setEvidenceState({
        kind: "success",
        message: `${typeof result.message === "string" ? result.message : "Evidencia guardada."}${syncNote}`,
        code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined,
        pdfAccessCode: typeof result.pdfAccessCode === "string" ? result.pdfAccessCode : undefined,
      });
      setValidationIssues([]);
      setConfigurationImpacts([]);
    } catch (error) {
      setEvidenceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar. Tu borrador permanece en este dispositivo." });
    }
  }

  async function handleCopy(label: string, text: string) {
    try {
      await copyText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 2500);
    } catch {
      setCopied("error");
    }
  }

  function chooseCase(key: (typeof cases)[number]["key"]) {
    const item = cases.find((candidate) => candidate.key === key) ?? cases[0];
    if (item.key === currentCase.key) return;
    if (evidenceChecklist.some((criterion) => checks[criterion]) && !window.confirm("Cambiar de caso conservará tus textos, pero desmarcará la lista de cotejo para que la confirmes con la nueva fuente. ¿Deseas continuar?")) return;
    const impacts: EvidenceIssue[] = [
      { key: "aiResult", fieldId: "s2-result", section: "Cambio de caso", label: "Resultado de IA o contingencia", severity: "critical", origin: "configuration", message: "El texto se conservó; revísalo con la nueva fuente." },
      { key: "teacherReview", fieldId: "s2-review", section: "Cambio de caso", label: "Revisión docente", severity: "critical", origin: "configuration", message: "La revisión se conservó; confirma que corresponda al caso elegido." },
      { key: "detectedRisk", fieldId: "s2-risk", section: "Cambio de caso", label: "Riesgo o limitación", severity: "critical", origin: "configuration", message: "El riesgo se conservó; vuelve a comprobarlo." },
      { key: "adjustment", fieldId: "s2-adjustment", section: "Cambio de caso", label: "Ajuste realizado", severity: "critical", origin: "configuration", message: "El ajuste se conservó; revísalo antes de acreditar." },
    ];
    setSelectedCase(key);
    setChecks({});
    setConfigurationImpacts(impacts);
    setValidationIssues([...impacts, { key: "checklist", fieldId: "s2-checklist", section: "Lista de cotejo", label: "Cuatro confirmaciones mínimas", severity: "critical", message: "El cambio de caso requiere confirmar de nuevo al menos 4 criterios." }]);
    updateEvidence({
      sources: item.title,
      purpose: item.purpose,
      pedagogicalContext: `${item.level}; actividad breve; contexto general sin datos personales.`,
      prompt: buildCasePrompt(item),
    });
  }

  return (
    <main className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="AULA-IA, volver a la Sesión 1">
          <span aria-hidden="true">AI</span>
          <span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span>
        </a>
        <nav aria-label="Navegación de la Sesión 2">
          <a href="#agenda">Agenda</a>
          <a href="#demostracion">Demostración</a>
          <a href="#laboratorio">Laboratorio</a>
          <a href="#evidencia">Evidencia</a>
          <a href="/sesion-3">Sesión 3</a>
        </nav>
      </header>
      <SessionNavigation current={2} position="top" />

      <div id="contenido">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Sesión 2 de 6 · Ruta principal</p>
            <h1>{sessionTwoTitle}</h1>
            <p className={styles.lede}>Convierte una fuente identificable en un recurso docente contextualizado, revisable y seguro.</p>
            <div className={styles.metrics} aria-label="Duración de la sesión">
              <span><strong>{totalMinutes}</strong> minutos exactos</span>
              <span><strong>{activeMinutes}</strong> minutos de aplicación</span>
              <span><strong>1</strong> evidencia acreditable</span>
            </div>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#registro-principal">Entrar a la sesión principal</a>
              <a className={styles.secondaryButton} href="/sesion-2/preparacion">Necesito preparación paso a paso</a>
            </div>
            <p className={styles.microcopy}>No se suben archivos. Usarás texto de práctica, abrirás la IA en otra pestaña y pegarás aquí el resultado.</p>
          </div>
          <figure className={styles.heroImage}>
            <img src="/recursos/sesion-2/ilustracion-fuentes-ia.png" alt="Docente comparando documentos y conexiones de fuentes antes de usar inteligencia artificial" width="1536" height="1024" />
            <figcaption>Fuente, contexto y revisión antes de decidir.</figcaption>
          </figure>
        </section>

        <section className={styles.routeStrip} aria-label="Rutas disponibles">
          <div><span>Ruta opcional previa</span><strong>Preparación · 60 min</strong><p>Navegación, copiar, pegar y guardar. Registra avance, pero no acredita.</p><a href="/sesion-2/preparacion">Abrir preparación</a></div>
          <div className={styles.routeActive}><span>Ruta oficial</span><strong>Principal · 90 min</strong><p>Demostración, laboratorio, revisión y evidencia. Sí cuenta para acreditación.</p><a href="#registro-principal">Continuar aquí</a></div>
        </section>

        <section className={styles.section} id="orientacion">
          <SectionHeading eyebrow="Orientación inicial" title="Elige una ruta con tranquilidad" description="Estas 13 preguntas identifican qué apoyos pueden ayudarte. No califican ni impiden entrar a ninguna ruta." />
          <details className={styles.detailsCard}>
            <summary>Responder diagnóstico de habilidades digitales</summary>
            <form className={styles.form} onSubmit={handleDiagnostic}>
              <div className={styles.twoColumns}>
                <label>Nombre completo<input required value={diagnostic.fullName} onChange={(event) => setDiagnostic({ ...diagnostic, fullName: event.target.value })} autoComplete="name" /></label>
                <label>Correo electrónico<input required type="email" value={diagnostic.email} onChange={(event) => setDiagnostic({ ...diagnostic, email: event.target.value })} autoComplete="email" /></label>
              </div>
              <div className={styles.questionGrid}>
                {digitalQuestions.map((question, index) => (
                  <label key={question} className={styles.questionCard}>
                    <span><b>{index + 1}.</b> {question}</span>
                    <select required value={diagnostic.answers[index]} onChange={(event) => {
                      const answers = [...diagnostic.answers];
                      answers[index] = event.target.value;
                      setDiagnostic({ ...diagnostic, answers });
                    }}>
                      <option value="">Selecciona</option>
                      {index === 12 ? <><option value="si">Sí</option><option value="a_veces">A veces</option><option value="no">No</option></> : <><option value="si">Sí, puedo hacerlo</option><option value="con_ayuda">Con ayuda</option><option value="todavia_no">Todavía no</option></>}
                    </select>
                  </label>
                ))}
              </div>
              <button className={styles.primaryButton} type="submit" disabled={diagnosticState.kind === "loading"}>{diagnosticState.kind === "loading" ? "Analizando…" : "Ver mi recomendación"}</button>
              <StatusBanner state={diagnosticState} />
              {diagnosticResult ? (
                <div className={styles.recommendation}>
                  <p className={styles.eyebrow}>Recomendación personalizada</p>
                  <h3>{diagnosticResult.recommendedRoute === "preparatoria" ? "Empieza por la preparación" : diagnosticResult.recommendedRoute === "principal" ? "Puedes entrar a la ruta principal" : "Tú eliges la ruta"}</h3>
                  <p>{diagnosticResult.recommendationMessage}</p>
                  <div className={styles.inlineActions}><a href="/sesion-2/preparacion">Abrir preparación</a><a href="#registro-principal">Ir a la principal</a></div>
                </div>
              ) : null}
            </form>
          </details>
        </section>

        <section className={styles.section} id="agenda">
          <SectionHeading eyebrow="Ruta comprobable" title="90 minutos exactos; 70 de trabajo aplicado" description="La teoría ocupa 15 minutos. La demostración, producción, revisión y registro ocupan el resto del trabajo sustantivo." />
          <ol className={styles.agenda}>
            {mainAgenda.map((item) => (
              <li key={item.time} className={item.active ? styles.agendaActive : ""}>
                <span>{item.time} min</span><div><strong>{item.label}</strong><p>{item.detail}</p></div>{item.active ? <em>Aplicación</em> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.section} ${styles.quoteSection}`}>
          <blockquote>“Sin fuente hay una respuesta; con fuente, contexto y revisión puede haber una decisión pedagógica.”</blockquote>
          <p>— Frase original AULA-IA</p>
          <details><summary>Pregunta para debatir durante 2 minutos</summary><p>¿Qué parte de una respuesta de IA podemos sostener con evidencia y qué parte todavía debemos comprobar?</p></details>
        </section>

        <section className={styles.section} id="microcontenido">
          <SectionHeading eyebrow="Microcontenido · 15 minutos" title="Una cadena visible evita decisiones a ciegas" description="Un documento no se convierte automáticamente en una fuente suficiente. Hay que seleccionar, contextualizar y revisar." />
          <div className={styles.chain} aria-label="Cadena de trabajo">
            {[
              ["1", "Fuente", "Texto público, propio o autorizado"],
              ["2", "Contexto", "Nivel, propósito, tiempo y recursos"],
              ["3", "Encargo", "Producto, formato y límites"],
              ["4", "Resultado", "Salida generada, no verdad automática"],
              ["5", "Revisión", "Sustento, propuesta y verificación"],
              ["6", "Ajuste", "Usar, corregir o descartar"],
            ].map(([number, title, copy]) => <div key={number}><span>{number}</span><strong>{title}</strong><p>{copy}</p></div>)}
          </div>
          <div className={styles.infoGrid}>
            <article><h3>Fuente pertinente</h3><p>Está identificada, aporta al propósito, puede usarse y permite localizar el apoyo de una afirmación.</p></article>
            <article><h3>Contexto seguro</h3><p>Describe necesidades generales sin nombres, correos, calificaciones, diagnósticos ni expedientes.</p></article>
            <article><h3>Trazabilidad</h3><p>Distingue lo tomado de la fuente, lo propuesto por la IA y lo que aún requiere comprobarse.</p></article>
          </div>
          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 1 · ¿Qué pieza es?</p><h3>Clasifica cada elemento</h3><p>Reintenta sin penalización. El objetivo es reconocer la función de cada bloque.</p></div>
            <div className={styles.quizList}>
              {pieceQuestions.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={pieceAnswers[index]} onChange={(event) => { const next = [...pieceAnswers]; next[index] = event.target.value; setPieceAnswers(next); setPieceScore(null); }}><option value="">Elige</option><option value="fuente">Fuente</option><option value="contexto">Contexto</option><option value="encargo">Encargo</option><option value="revision">Revisión</option></select></label>)}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => setPieceScore(pieceQuestions.filter((item, index) => item.answer === pieceAnswers[index]).length)}>Comprobar</button>
            {pieceScore !== null ? <p className={styles.quizResult} role="status">{pieceScore} de {pieceQuestions.length} correctas. {pieceScore === pieceQuestions.length ? "Ya puedes avanzar." : "Revisa las funciones y vuelve a intentarlo."}</p> : null}
          </div>
        </section>

        <section className={styles.section} id="demostracion">
          <SectionHeading eyebrow="Demostración · 20 minutos" title="Compara una petición genérica con una petición sustentada" description="No gana la respuesta más larga: gana la que podemos rastrear, aplicar y revisar." />
          <div className={styles.demoGrid}>
            <article className={styles.genericCard}><span>Petición genérica</span><h3>“Haz una actividad de lectura.”</h3><ul><li>No identifica una fuente.</li><li>No define nivel ni propósito.</li><li>No limita datos inventados.</li><li>Es difícil de auditar.</li></ul></article>
            <article className={styles.groundedCard}><span>Petición sustentada</span><h3>Fuente + contexto + encargo + límites</h3><ul><li>Delimita qué información usar.</li><li>Explica para quién y para qué.</li><li>Marca propuestas y vacíos.</li><li>Facilita la revisión docente.</li></ul></article>
          </div>
          <div className={styles.sourcePanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Fuente de práctica integrada</p><h3>Jornada de lectura · caso simulado</h3></div><button type="button" onClick={() => handleCopy("fuente", courseSource)}>{copied === "fuente" ? "Copiada" : "Copiar fuente"}</button></div>
            <pre>{courseSource}</pre>
          </div>
          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt de demostración</p><h3>Cuatro preguntas verificables</h3></div><button type="button" onClick={() => handleCopy("demo", prepPrompt)}>{copied === "demo" ? "Copiado" : "Copiar prompt"}</button></div>
            <pre>{prepPrompt}</pre>
          </div>
          <ToolLinks />
          <p className={styles.note}>Las funciones visibles cambian según cuenta, región y fecha. La práctica esencial funciona pegando la fuente en cualquier chat disponible; NotebookLM es una opción de anclaje, no una garantía de exactitud.</p>
          <details className={styles.sampleAnswer}><summary>No tengo acceso a una IA: usar respuesta de muestra</summary><p><strong>Propósito:</strong> organizar una recomendación grupal de lectura basada en el texto consultado.</p><p><strong>Momentos:</strong> 10 minutos de lectura, 15 de conversación, 15 de recomendación y 5 de cierre.</p><p><strong>Dato que no se registra:</strong> nombres, calificaciones o información personal.</p><p><strong>Vacío:</strong> la fuente no indica qué textos seleccionará cada docente.</p></details>
        </section>

        <section className={styles.section} id="laboratorio">
          <SectionHeading eyebrow="Laboratorio · 30 minutos" title="Produce un microrecurso y conserva su rastro" description="Elige un caso, copia el prompt, trabaja en otra pestaña y regresa para revisar. No subas documentos." />
          <div className={styles.caseTabs} role="group" aria-label="Casos espejo">
            {cases.map((item) => <button type="button" key={item.key} aria-pressed={selectedCase === item.key} onClick={() => chooseCase(item.key)}><span>{item.level}</span><strong>{item.title}</strong></button>)}
          </div>
          <article className={styles.caseCard}>
            <div><p className={styles.eyebrow}>{currentCase.level}</p><h3>{currentCase.title}</h3><p>{currentCase.purpose}</p><p><strong>Producto:</strong> {currentCase.product}</p></div>
            <details><summary>Leer fuente del caso</summary><pre>{currentCase.source}</pre></details>
          </article>
          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt construido</p><h3>Adáptalo antes de enviarlo</h3></div><button type="button" onClick={() => handleCopy("caso", casePrompt)}>{copied === "caso" ? "Copiado" : "Copiar prompt"}</button></div>
            <pre>{casePrompt}</pre>
          </div>
          <div className={styles.levelGrid}>
            {promptLevels.map((item) => <article key={item.level}><span>{item.level}</span><p>{item.prompt}</p><button type="button" onClick={() => handleCopy(item.level, item.prompt)}>{copied === item.level ? "Copiado" : "Copiar variante"}</button></article>)}
          </div>
          <ToolLinks />

          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 2 · Semáforo de trazabilidad</p><h3>¿Qué clase de afirmación es?</h3><p>El color acompaña la etiqueta, pero no es la única señal.</p></div>
            <div className={styles.quizList}>
              {claimCheck.map((item, index) => <label key={item.id}><span>{item.statement}</span><select value={claimAnswers[index]} onChange={(event) => { const next = [...claimAnswers]; next[index] = event.target.value; setClaimAnswers(next); setClaimScore(null); }}><option value="">Elige</option><option value="sustentada">Sustentada por la fuente</option><option value="inferencia">Inferencia o propuesta</option><option value="no_sustentada">No sustentada; verificar o retirar</option></select>{claimScore !== null ? <small>{claimAnswers[index] === item.correct ? "Correcto. " : "Revisa. "}{item.feedback}</small> : null}</label>)}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => setClaimScore(claimCheck.filter((item, index) => item.correct === claimAnswers[index]).length)}>Comprobar clasificación</button>
            {claimScore !== null ? <p className={styles.quizResult} role="status">{claimScore} de {claimCheck.length} correctas. Puedes corregir y reintentar.</p> : null}
          </div>

          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 3 · FIEL</p><h3>Elige el criterio decisivo</h3><p>Fidelidad, Intención pedagógica, Encaje y Límites trabajan juntos.</p></div>
            <div className={styles.quizList}>
              {fielQuestions.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={fielAnswers[index]} onChange={(event) => { const next = [...fielAnswers]; next[index] = event.target.value; setFielAnswers(next); setFielScore(null); }}><option value="">Elige</option><option value="Fidelidad">Fidelidad</option><option value="Intención">Intención pedagógica</option><option value="Encaje">Encaje</option><option value="Límites">Límites</option></select></label>)}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => setFielScore(fielQuestions.filter((item, index) => item.answer === fielAnswers[index]).length)}>Comprobar FIEL</button>
            {fielScore !== null ? <p className={styles.quizResult} role="status">{fielScore} de {fielQuestions.length} correctas. {fielScore === fielQuestions.length ? "Aplica ahora FIEL a tu producto." : "Revisa el criterio que describe cada problema."}</p> : null}
          </div>
        </section>

        <section className={styles.section} id="registro-principal">
          <SectionHeading eyebrow="Asistencia oficial" title="Registra tu entrada a la Sesión 2 principal" description="La preparación tiene un registro distinto. Para acreditar esta sesión necesitas este registro y la evidencia final." />
          <form className={`${styles.form} ${styles.cardForm}`} onSubmit={handleAttendance}>
            <div className={styles.twoColumns}>
              <label>Nombre completo<input required value={attendance.fullName} onChange={(event) => setAttendance({ ...attendance, fullName: event.target.value })} autoComplete="name" /></label>
              <label>Correo electrónico<input required type="email" value={attendance.email} onChange={(event) => setAttendance({ ...attendance, email: event.target.value })} autoComplete="email" /></label>
              <label>Institución<input required value={attendance.institution} onChange={(event) => setAttendance({ ...attendance, institution: event.target.value })} autoComplete="organization" /></label>
              <label>Función<select required value={attendance.role} onChange={(event) => setAttendance({ ...attendance, role: event.target.value })}><option>Docente</option><option>Directivo</option><option>Apoyo técnico-pedagógico</option><option>Estudiante normalista</option><option>Otra función educativa</option></select></label>
            </div>
            <label className={styles.consent}><input type="checkbox" checked={attendance.consent} onChange={(event) => setAttendance({ ...attendance, consent: event.target.checked })} /> <span>Acepto que estos datos se utilicen para asistencia, seguimiento del curso y acreditación. No se mostrarán al grupo.</span></label>
            <button className={styles.primaryButton} type="submit" disabled={attendanceState.kind === "loading"}>{attendanceState.kind === "loading" ? "Registrando…" : "Registrar asistencia principal"}</button>
            <StatusBanner state={attendanceState} />
          </form>
        </section>

        <section className={styles.section} id="evidencia">
          <SectionHeading eyebrow="Evidencia acreditable · 10 minutos" title="Microrecurso docente fundamentado y contextualizado" description="Pega aquí lo producido, documenta tu revisión y espera el código de confirmación. El borrador se conserva localmente en este dispositivo." />
          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence} noValidate>
            <div className={styles.twoColumns}>
              <label className={validationClass("email")}>Correo usado en la asistencia<input id="s2-email" aria-invalid={issueFor("email")?.severity === "critical"} type="email" value={evidence.email} onChange={(event) => updateEvidence({ email: event.target.value })} />{issueFor("email") ? <span className={styles.validationMessage}>{issueFor("email")?.message}</span> : null}</label>
              <label className={validationClass("productTitle")}>Título del producto<input id="s2-title" aria-invalid={Boolean(issueFor("productTitle"))} value={evidence.productTitle} onChange={(event) => updateEvidence({ productTitle: event.target.value })} />{issueFor("productTitle") ? <span className={styles.validationMessage}>{issueFor("productTitle")?.message}</span> : null}</label>
            </div>
            <label className={validationClass("purpose")}>Propósito docente<textarea id="s2-purpose" aria-invalid={Boolean(issueFor("purpose"))} rows={3} value={evidence.purpose} onChange={(event) => updateEvidence({ purpose: event.target.value })} placeholder="¿Qué aprendizaje buscas favorecer?" />{issueFor("purpose") ? <span className={styles.validationMessage}>{issueFor("purpose")?.message}</span> : null}</label>
            <label className={validationClass("pedagogicalContext")}>Contexto pedagógico sin datos personales<textarea id="s2-context" aria-invalid={Boolean(issueFor("pedagogicalContext"))} rows={4} value={evidence.pedagogicalContext} onChange={(event) => updateEvidence({ pedagogicalContext: event.target.value })} placeholder="Nivel, área, duración, recursos y necesidad general." />{issueFor("pedagogicalContext") ? <span className={styles.validationMessage}>{issueFor("pedagogicalContext")?.message}</span> : null}</label>
            <label className={validationClass("sources")}>Fuente o fragmento utilizado<textarea id="s2-sources" aria-invalid={Boolean(issueFor("sources"))} rows={5} value={evidence.sources} onChange={(event) => updateEvidence({ sources: event.target.value })} placeholder="Identifica la fuente y pega solo el fragmento pertinente y autorizado." />{issueFor("sources") ? <span className={styles.validationMessage}>{issueFor("sources")?.message}</span> : null}</label>
            <label className={validationClass("prompt")}>Prompt principal<textarea id="s2-prompt" aria-invalid={Boolean(issueFor("prompt"))} rows={9} value={evidence.prompt} onChange={(event) => updateEvidence({ prompt: event.target.value })} />{issueFor("prompt") ? <span className={styles.validationMessage}>{issueFor("prompt")?.message}</span> : null}</label>
            <label className={validationClass("aiResult")}>Resultado de la IA o respuesta de contingencia<textarea id="s2-result" aria-invalid={Boolean(issueFor("aiResult"))} rows={9} value={evidence.aiResult} onChange={(event) => updateEvidence({ aiResult: event.target.value })} placeholder="Pega el microrecurso; no incluyas datos personales." />{issueFor("aiResult") ? <span className={styles.validationMessage}>{issueFor("aiResult")?.message}</span> : null}</label>
            <label className={validationClass("teacherReview")}>Revisión docente<textarea id="s2-review" aria-invalid={Boolean(issueFor("teacherReview"))} rows={6} value={evidence.teacherReview} onChange={(event) => updateEvidence({ teacherReview: event.target.value })} placeholder="Distingue: parte sustentada, propuesta pedagógica, elemento por verificar y reflexión ‘Mi producto mejoró cuando…’." />{issueFor("teacherReview") ? <span className={styles.validationMessage}>{issueFor("teacherReview")?.message}</span> : null}</label>
            <div className={styles.twoColumns}>
              <label className={validationClass("detectedRisk")}>Riesgo o limitación detectada<textarea id="s2-risk" aria-invalid={Boolean(issueFor("detectedRisk"))} rows={4} value={evidence.detectedRisk} onChange={(event) => updateEvidence({ detectedRisk: event.target.value })} />{issueFor("detectedRisk") ? <span className={styles.validationMessage}>{issueFor("detectedRisk")?.message}</span> : null}</label>
              <label className={validationClass("adjustment")}>Ajuste realizado<textarea id="s2-adjustment" aria-invalid={Boolean(issueFor("adjustment"))} rows={4} value={evidence.adjustment} onChange={(event) => updateEvidence({ adjustment: event.target.value })} />{issueFor("adjustment") ? <span className={styles.validationMessage}>{issueFor("adjustment")?.message}</span> : null}</label>
            </div>

            <fieldset id="s2-checklist" tabIndex={-1} aria-invalid={Boolean(issueFor("checklist"))} className={`${styles.checklist} ${validationClass("checklist")}`}>
              <legend>Lista de cotejo · {checkedCount} de {evidenceChecklist.length} confirmados</legend>
              <p>Marca solo lo que puedas sostener. Puedes regresar a corregir antes de guardar.</p>
              {evidenceChecklist.map((item) => <label key={item}><input type="checkbox" checked={Boolean(checks[item])} onChange={(event) => { const next = { ...checks, [item]: event.target.checked }; setChecks(next); setProgressState({ kind: "idle" }); if (Object.values(next).filter(Boolean).length >= 4) setValidationIssues((current) => current.filter((issue) => issue.key !== "checklist")); }} /><span>{item}</span></label>)}
              {issueFor("checklist") ? <span className={styles.validationMessage}>{issueFor("checklist")?.message}</span> : null}
            </fieldset>
            <div className={styles.privacyNote}><strong>Antes de enviar:</strong> confirma que no pegaste nombres, correos, calificaciones, diagnósticos, fotografías, expedientes ni enlaces privados.</div>
            {validationIssues.length ? <div className={styles.validationSummary} role="alert"><h3>{validationIssues.some((issue) => issue.severity === "critical") ? "No se puede acreditar todavía" : "Hay información complementaria pendiente"}</h3><p>{validationIssues.some((issue) => issue.severity === "critical") ? "Corrige los requisitos críticos enumerados. Tu avance quedó conservado." : "Puedes completar estos datos o guardar la evidencia con las advertencias visibles."}</p><ol>{validationIssues.map((issue) => <li key={`${issue.key}-${issue.severity}`} data-severity={issue.severity}><button type="button" onClick={() => focusIssue(issue)}><strong>{issue.section} → {issue.label}</strong><span>{issue.message}</span></button></li>)}</ol><div className={styles.inlineActions}>{validationIssues.some((issue) => issue.severity === "critical") ? <><button type="button" className={styles.secondaryButton} onClick={() => persistProgress()}>Guardar avance</button><button type="button" className={styles.primaryButton} onClick={() => focusIssue(validationIssues.find((issue) => issue.severity === "critical")!)}>Ir al primer requisito crítico</button></> : <><button type="button" className={styles.secondaryButton} onClick={() => focusIssue(validationIssues[0])}>Volver y completar</button><button type="button" className={styles.primaryButton} onClick={() => void attemptEvidence(true)}>Guardar evidencia con advertencias</button></>}</div></div> : null}
            <div className={styles.inlineActions}><button className={styles.secondaryButton} type="button" onClick={() => persistProgress()}>Guardar avance sin acreditar</button><button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Guardando evidencia…" : "Guardar evidencia S2"}</button></div>
            <StatusBanner state={progressState} />
            <StatusBanner state={evidenceState} />
            <p className={styles.draftNote}>Borrador local: se actualiza al escribir. Para privacidad, usa un dispositivo personal o borra el borrador después de confirmar.</p>
            {evidenceState.kind === "success" ? <button type="button" className={styles.textButton} onClick={() => { localStorage.removeItem(DRAFT_KEY); setEvidence(initialEvidence); setChecks({}); }}>Borrar borrador de este dispositivo</button> : null}
          </form>
          <EvidencePdfDownload session="S2" email={evidence.email} pdfAccessCode={evidenceState.pdfAccessCode} />
        </section>

        <section className={styles.section} id="recursos">
          <SectionHeading eyebrow="Transferencia" title="Recursos para continuar" description="La actividad semanal se realiza fuera de los 90 minutos y no altera la duración oficial de la sesión." />
          <div className={styles.resourceGrid}>
            <article><span>Actividad semanal</span><h3>Antes y después: una fuente cambia mi recurso</h3><ol><li>Elige una fuente pública, propia o autorizada.</li><li>Compara una petición breve con otra contextualizada.</li><li>Aplica FIEL y decide usar, ajustar o descartar.</li></ol></article>
            <article><span>Materiales</span><h3>Descargas editables</h3><p>Cuadernillo, hoja de trabajo, banco de prompts y tarjetas de contingencia.</p><div className={styles.downloads}><a href="/recursos/sesion-2/cuadernillo-principal-s2.pdf">Cuadernillo PDF</a><a href="/recursos/sesion-2/hoja-trabajo-s2.docx">Hoja editable</a><a href="/recursos/sesion-2/banco-prompts-s2.pdf">Banco de prompts</a></div></article>
            <article><span>Idea clave</span><h3>La IA no sustituye la fuente</h3><p>La salida generada es un producto para revisar. Las afirmaciones importantes necesitan fuentes identificables y pertinentes.</p></article>
          </div>
          <details className={styles.detailsCard}><summary>Preguntas frecuentes</summary><div className={styles.faq}>{faq.map(([question, answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div></details>
          <details className={styles.detailsCard}><summary>Actividades opcionales si sobra tiempo</summary><ul><li><strong>Cirugía de una afirmación:</strong> decidir si conservar, marcar, verificar o eliminar.</li><li><strong>El mismo fragmento, tres niveles:</strong> adaptar sin perder la idea central.</li><li><strong>Abogado de la fuente:</strong> exigir apoyo a tres afirmaciones convincentes.</li></ul></details>
        </section>
      </div>

      <SessionNavigation current={2} position="bottom" />
      <footer className={styles.footer}>
        <div><strong>AULA-IA · Sesión 2</strong><p>Formación docente crítica, práctica y contextualizada.</p></div>
        <div><a href="/">Sesión 1</a><a href="/sesion-2/preparacion">Preparación S2</a><a href="/sesion-3">Sesión 3</a><a href="#contenido">Volver arriba</a></div>
      </footer>
    </main>
  );
}
