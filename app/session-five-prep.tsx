"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { type FormEvent, useEffect, useState } from "react";
import EvidencePdfDownload from "./evidence-pdf-download";
import SessionNavigation from "./session-navigation";
import styles from "./session-two.module.css";
import {
  expectedPrepMetrics,
  instruments,
  prepAgenda,
  prepChecklist,
  prepContext,
  prepContingency,
  prepDataset,
  prepInterpretation,
  prepTotalMinutes,
  sessionFiveSimulationNotice,
  sourceLinks,
} from "./session-five-data";

type SaveState = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
  code?: string;
  pdfAccessCode?: string;
};

type PrepStructure = "tabla" | "markdown";
type PrepOutput = "word" | "pdf";

const IDENTITY_KEY = "aula-ia-s5-prep-identity";
const DRAFT_KEY = "aula-ia-s5-prep-draft";

function buildPrepInstrumentPrompt(criteria: readonly string[], structure: PrepStructure, output: PrepOutput) {
  const structureText = structure === "tabla"
    ? "Tabla de cotejo con una fila por indicador y columnas Sí, Aún no y No observable."
    : "Markdown estructurado con encabezados, lista numerada de indicadores y valores Sí, Aún no y No observable.";
  const outputText = output === "word"
    ? "Documento Word editable."
    : "Documento editable preparado para exportarse después como PDF imprimible; no presentes el PDF como editable.";
  return `Actúa como asistente de diseño de instrumentos educativos. Produce un BORRADOR para revisión docente.

CASO FICTICIO
Nivel y asignatura: ${prepContext.level} · ${prepContext.subject}
Propósito: ${prepContext.learningPurpose}
Producto: ${prepContext.evidenceProduct}

CONFIGURACIÓN CONTROLADA
Estructura: ${structureText}
Salida: ${outputText}
FIN CONFIGURACIÓN

INDICADORES CONTROLADOS
${criteria.map((criterion, index) => `K${index + 1}. ${criterion}`).join("\n")}
FIN INDICADORES

ENCARGO
1. Construye una lista de cotejo clara y aplicable con esos cuatro indicadores.
2. Conserva los valores Sí, Aún no y No observable.
3. Añade una instrucción breve de aplicación y una nota sobre lo que el instrumento no permite afirmar.
4. No inventes datos, causas, calificaciones ni diagnósticos del alumnado.
5. Marca la salida como BORRADOR para aceptar, adaptar o rechazar.`;
}

function updatePrepInstrumentPrompt(current: string, criteria: readonly string[], structure: PrepStructure, output: PrepOutput) {
  const generated = buildPrepInstrumentPrompt(criteria, structure, output);
  if (!current.trim()) return generated;
  const configuration = generated.match(/CONFIGURACIÓN CONTROLADA[\s\S]*?FIN CONFIGURACIÓN/)?.[0] ?? "";
  const indicators = generated.match(/INDICADORES CONTROLADOS[\s\S]*?FIN INDICADORES/)?.[0] ?? "";
  const withConfiguration = /CONFIGURACIÓN CONTROLADA[\s\S]*?FIN CONFIGURACIÓN/.test(current)
    ? current.replace(/CONFIGURACIÓN CONTROLADA[\s\S]*?FIN CONFIGURACIÓN/, configuration)
    : `${configuration}\n\n${current}`;
  return /INDICADORES CONTROLADOS[\s\S]*?FIN INDICADORES/.test(withConfiguration)
    ? withConfiguration.replace(/INDICADORES CONTROLADOS[\s\S]*?FIN INDICADORES/, indicators)
    : `${indicators}\n\n${withConfiguration}`;
}

function buildPrepAnalysisPrompt(finding: string, teachingAction: string, newEvidence: string) {
  return `Actúa como asistente de análisis educativo. Redacta un BORRADOR prudente para revisión docente.

TABLERO FICTICIO
- 8 participantes.
- 7 entregas y 1 registro sin evidencia.
- K1: 6/7; K2: 5/7; K3: 4/7; K4: 6/7.
- Los datos faltantes no se convierten en cero.

APORTES CONTROLADOS
Hallazgo observable: ${finding || "Pendiente de completar por el participante."}
Acción docente: ${teachingAction || "Pendiente de completar por el participante."}
Nueva evidencia: ${newEvidence || "Pendiente de completar por el participante."}
FIN APORTES

ENCARGO
1. Integra los tres aportes en un borrador breve y prudente.
2. Separa dato observado, interpretación provisional, acción docente y nueva evidencia.
3. Conserva los denominadores y reconoce el registro faltante.
4. No atribuyas causas, no etiquetes personas y no presentes un dictamen automático.
5. Termina con una invitación explícita a aceptar, adaptar o rechazar con justificación.`;
}

function updatePrepAnalysisPrompt(current: string, finding: string, teachingAction: string, newEvidence: string) {
  const generated = buildPrepAnalysisPrompt(finding, teachingAction, newEvidence);
  if (!current.trim()) return generated;
  const contributions = generated.match(/APORTES CONTROLADOS[\s\S]*?FIN APORTES/)?.[0] ?? "";
  return /APORTES CONTROLADOS[\s\S]*?FIN APORTES/.test(current)
    ? current.replace(/APORTES CONTROLADOS[\s\S]*?FIN APORTES/, contributions)
    : `${contributions}\n\n${current}`;
}

function ToolLinks() {
  return <div className={styles.toolLinks} aria-label="Herramientas externas opcionales"><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Abrir ChatGPT ↗</a><a href="https://gemini.google.com/" target="_blank" rel="noreferrer">Abrir Gemini ↗</a><a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer">Abrir NotebookLM ↗</a></div>;
}

async function postSessionFive(payload: Record<string, unknown>) {
  const response = await fetch("/api/session-five", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "No fue posible guardar la respuesta.");
  return result;
}

function StatusBanner({ state }: { state: SaveState }) {
  if (state.kind === "idle") return null;
  return <div className={`${styles.status} ${styles[`status_${state.kind}`]}`} role={state.kind === "error" ? "alert" : "status"} aria-live="polite"><strong>{state.kind === "loading" ? "Procesando…" : state.kind === "success" ? "Listo" : "Revisa"}</strong><span>{state.message}</span>{state.code ? <span className={styles.code}>Folio: {state.code}</span> : null}</div>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}

export function SessionFivePrep() {
  const [attendance, setAttendance] = useState({ fullName: "", email: "", institution: "", role: "Docente", consent: false });
  const [attendanceState, setAttendanceState] = useState<SaveState>({ kind: "idle" });
  const [criteria, setCriteria] = useState<string[]>(prepChecklist.map((item) => item.replace(/^K\d · /, "")));
  const [structure, setStructure] = useState<PrepStructure>("tabla");
  const [output, setOutput] = useState<PrepOutput>("word");
  const [finding, setFinding] = useState("");
  const [teachingAction, setTeachingAction] = useState("");
  const [newEvidence, setNewEvidence] = useState("");
  const [instrumentPrompt, setInstrumentPrompt] = useState(() => buildPrepInstrumentPrompt(prepChecklist.map((item) => item.replace(/^K\d · /, "")), "tabla", "word"));
  const [analysisPrompt, setAnalysisPrompt] = useState(() => buildPrepAnalysisPrompt("", "", ""));
  const [aiDraft, setAiDraft] = useState("");
  const [aiDecision, setAiDecision] = useState("adaptar");
  const [justification, setJustification] = useState("");
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [copied, setCopied] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const identity = JSON.parse(localStorage.getItem(IDENTITY_KEY) || "{}") as Partial<typeof attendance>;
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as Record<string, unknown>;
        const loadedCriteria = Array.isArray(draft.criteria) && draft.criteria.length === 4 ? draft.criteria.map(String) : prepChecklist.map((item) => item.replace(/^K\d · /, ""));
        const loadedStructure: PrepStructure = draft.structure === "markdown" ? "markdown" : "tabla";
        const loadedOutput: PrepOutput = draft.output === "pdf" ? "pdf" : "word";
        const loadedFinding = typeof draft.finding === "string" ? draft.finding : "";
        const loadedTeachingAction = typeof draft.teachingAction === "string" ? draft.teachingAction : "";
        const loadedNewEvidence = typeof draft.newEvidence === "string" ? draft.newEvidence : "";
        setAttendance((current) => ({ ...current, fullName: String(identity.fullName || ""), email: String(identity.email || ""), institution: String(identity.institution || ""), role: String(identity.role || "Docente") }));
        setCriteria(loadedCriteria);
        setStructure(loadedStructure);
        setOutput(loadedOutput);
        setFinding(loadedFinding);
        setTeachingAction(loadedTeachingAction);
        setNewEvidence(loadedNewEvidence);
        setInstrumentPrompt(updatePrepInstrumentPrompt(typeof draft.instrumentPrompt === "string" ? draft.instrumentPrompt : "", loadedCriteria, loadedStructure, loadedOutput));
        setAnalysisPrompt(updatePrepAnalysisPrompt(typeof draft.analysisPrompt === "string" ? draft.analysisPrompt : "", loadedFinding, loadedTeachingAction, loadedNewEvidence));
        setAiDraft(typeof draft.aiDraft === "string" ? draft.aiDraft : "");
        setAiDecision(typeof draft.aiDecision === "string" ? draft.aiDecision : "adaptar");
        setJustification(typeof draft.justification === "string" ? draft.justification : "");
      } catch {
        // Un borrador local dañado no interrumpe la ruta.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ criteria, structure, output, finding, teachingAction, newEvidence, instrumentPrompt, analysisPrompt, aiDraft, aiDecision, justification }));
  }, [criteria, structure, output, finding, teachingAction, newEvidence, instrumentPrompt, analysisPrompt, aiDraft, aiDecision, justification, hydrated]);

  function invalidateSaved() {
    if (evidenceState.kind === "success") setEvidenceState({ kind: "idle" });
  }

  function changeCriterion(index: number, value: string) {
    invalidateSaved();
    const next = [...criteria];
    next[index] = value;
    setCriteria(next);
    setInstrumentPrompt((current) => updatePrepInstrumentPrompt(current, next, structure, output));
  }

  function changeStructure(value: PrepStructure) {
    invalidateSaved();
    setStructure(value);
    setInstrumentPrompt((current) => updatePrepInstrumentPrompt(current, criteria, value, output));
  }

  function changeOutput(value: PrepOutput) {
    invalidateSaved();
    setOutput(value);
    setInstrumentPrompt((current) => updatePrepInstrumentPrompt(current, criteria, structure, value));
  }

  function changeFinding(value: string) {
    invalidateSaved();
    setFinding(value);
    setAnalysisPrompt((current) => updatePrepAnalysisPrompt(current, value, teachingAction, newEvidence));
  }

  function changeTeachingAction(value: string) {
    invalidateSaved();
    setTeachingAction(value);
    setAnalysisPrompt((current) => updatePrepAnalysisPrompt(current, finding, value, newEvidence));
  }

  function changeNewEvidence(value: string) {
    invalidateSaved();
    setNewEvidence(value);
    setAnalysisPrompt((current) => updatePrepAnalysisPrompt(current, finding, teachingAction, value));
  }

  async function copyPrompt(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  async function handleAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttendanceState({ kind: "loading", message: "Registrando tu entrada a la preparación…" });
    try {
      const result = await postSessionFive({ action: "leveling_attendance", ...attendance });
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(attendance));
      setAttendanceState({ kind: "success", message: typeof result.message === "string" ? result.message : "Entrada registrada.", code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined });
    } catch (error) {
      setAttendanceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible registrar la entrada." });
    }
  }

  async function handleEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (criteria.some((criterion) => criterion.trim().length < 8)) {
      setEvidenceState({ kind: "error", message: "Escribe cuatro criterios observables antes de guardar." });
      return;
    }
    if (aiDraft.trim().length < 20) {
      setEvidenceState({ kind: "error", message: "Incluye el borrador de IA o usa la respuesta de contingencia antes de guardar." });
      return;
    }
    setEvidenceState({ kind: "loading", message: "Guardando la nivelación y preparando el folio…" });
    try {
      const result = await postSessionFive({
        action: "leveling_activity",
        email: attendance.email,
        activity: "nivelacion-instrumentos",
        evidenceType: "instrumento-y-analisis",
        response: { scenario: prepContext.title, instrument: "lista_cotejo", criteria, structure, output, instrumentPrompt, dataset: "8 participantes, 7 entregas y 1 dato faltante", finding, teachingAction, newEvidence, analysisPrompt, aiDraft, aiDecision, justification },
        result: `Hallazgo: ${finding}\nAcción docente: ${teachingAction}\nNueva evidencia: ${newEvidence}\nDecisión sobre IA: ${aiDecision}. ${justification}`,
        completed: true,
      });
      const syncNote = result.sheetSync === "synced" ? " También se reflejó en la hoja institucional." : result.sheetSync === "failed" ? " El registro quedó protegido en la plataforma; la réplica institucional requiere revisión." : " El registro quedó protegido en la plataforma; la conexión institucional no está configurada en este entorno.";
      setEvidenceState({ kind: "success", message: `${typeof result.message === "string" ? result.message : "Preparación guardada."}${syncNote}`, code: typeof result.confirmationCode === "string" ? result.confirmationCode : undefined, pdfAccessCode: typeof result.pdfAccessCode === "string" ? result.pdfAccessCode : undefined });
    } catch (error) {
      setEvidenceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar. El borrador permanece en este dispositivo." });
    }
  }

  return (
    <main className={`${styles.shell} ${styles.sessionFiveShell} ${styles.prepShell}`}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="AULA-IA, volver al inicio"><span aria-hidden="true">AI</span><span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span></a>
        <nav aria-label="Navegación de preparación S5"><a href="#agenda">Agenda</a><a href="#mini-lab-1">Instrumento</a><a href="#mini-lab-2">Resultados</a><a href="#registro">Evidencia</a><a href="/sesion-5">Sesión principal</a></nav>
      </header>
      <SessionNavigation current={5} position="top" />

      <div id="contenido">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Preparación S5 · Principiantes</p>
            <h1>Del criterio a una decisión sencilla</h1>
            <p className={styles.lede}>En 60 minutos construirás una lista de cotejo, leerás ocho resultados ficticios y decidirás qué conservar o cambiar de una propuesta de IA.</p>
            <div className={styles.metrics}><span><strong>{prepTotalMinutes}</strong> minutos exactos</span><span><strong>8</strong> resultados ficticios</span><span><strong>1</strong> instrumento guiado</span></div>
            <div className={styles.heroActions}><a className={styles.primaryButton} href="#entrada">Registrar entrada</a><a className={styles.secondaryButton} href="/sesion-5">Ya puedo entrar a la principal</a></div>
            <p className={styles.microcopy}>Esta preparación se registra, pero no acredita el curso ni sustituye la asistencia y evidencia de la sesión principal.</p>
          </div>
          <figure className={styles.heroImage}><img src="/recursos/sesion-5/hero-instrumentos-evidencias-s5.png" alt="Docentes comparan evidencias anónimas con una lista de cotejo y un tablero sencillo" width="1536" height="1024" /><figcaption>Aprende la mecánica con un caso distinto antes de la ruta principal.</figcaption></figure>
        </section>

        <p className={styles.nonAccreditable}><strong>Ruta no acreditable:</strong> {sessionFiveSimulationNotice} Al finalizar debes registrarte de nuevo en la Sesión 5 principal.</p>

        <section className={styles.section} id="entrada">
          <SectionHeading eyebrow="Registro independiente" title="Confirma tu entrada a la preparación" description="Usa el mismo correo que utilizarás después en la sesión principal." />
          <form className={`${styles.form} ${styles.cardForm}`} onSubmit={handleAttendance}>
            <div className={styles.twoColumns}>
              <label>Nombre completo<input required value={attendance.fullName} onChange={(event) => setAttendance({ ...attendance, fullName: event.target.value })} autoComplete="name" /></label>
              <label>Correo electrónico<input required type="email" value={attendance.email} onChange={(event) => setAttendance({ ...attendance, email: event.target.value })} autoComplete="email" /></label>
              <label>Institución<input required value={attendance.institution} onChange={(event) => setAttendance({ ...attendance, institution: event.target.value })} autoComplete="organization" /></label>
              <label>Función<select value={attendance.role} onChange={(event) => setAttendance({ ...attendance, role: event.target.value })}><option>Docente</option><option>Directivo</option><option>Apoyo técnico-pedagógico</option><option>Estudiante normalista</option><option>Otra función educativa</option></select></label>
            </div>
            <label className={styles.consent}><input type="checkbox" checked={attendance.consent} onChange={(event) => setAttendance({ ...attendance, consent: event.target.checked })} /><span>Acepto el uso de estos datos para registrar mi nivelación y seguimiento. No se mostrarán al grupo.</span></label>
            <button className={styles.primaryButton} type="submit" disabled={attendanceState.kind === "loading"}>{attendanceState.kind === "loading" ? "Registrando…" : "Registrar entrada a preparación"}</button>
            <StatusBanner state={attendanceState} />
          </form>
        </section>

        <section className={styles.section} id="agenda">
          <SectionHeading eyebrow="Ruta guiada" title="60 minutos exactos" description="Cada bloque prepara una acción de la sesión principal sin repetir sus casos ni su nivel de exigencia." />
          <ol className={styles.agenda}>{prepAgenda.map((item) => <li key={item.time}><span>{item.time} min</span><div><strong>{item.label}</strong><p>{item.detail}</p></div></li>)}</ol>
        </section>

        <section className={styles.section}>
          <SectionHeading eyebrow="Cuatro ideas" title="Evidencia, criterio, instrumento y decisión" description="Una evidencia es el producto; el criterio indica qué observar; el instrumento organiza el registro; la decisión define el siguiente paso." />
          <div className={styles.prepMap} aria-label="Relación entre evidencia, criterio, instrumento y decisión"><span>1 · Evidencia<br />Párrafo de 100 palabras</span><span>2 · Criterio<br />Relación entre dato e idea</span><span>3 · Instrumento<br />Lista de cotejo</span><span>4 · Decisión<br />Modelar y volver a observar</span></div>
          <div className={styles.infoGrid}>{instruments.map((item) => <article key={item.key}><h3>{item.label}</h3><p>{item.purpose}</p><p><strong>Útil para:</strong> {item.bestFor}</p><p><strong>Cuidado:</strong> {item.risk}</p></article>)}</div>
        </section>

        <section className={styles.section} id="mini-lab-1">
          <SectionHeading eyebrow="Minilaboratorio 1 · 15 minutos" title="Prueba con IA una lista de cotejo de cuatro indicadores" description={`${prepContext.level} · ${prepContext.subject}. ${prepContext.context}`} />
          <div className={styles.caseCard}><div><h3>{prepContext.title}</h3><p><strong>Propósito:</strong> {prepContext.learningPurpose}</p><p><strong>Producto:</strong> {prepContext.evidenceProduct}</p></div><details open><summary>Por qué usar lista de cotejo</summary><p>Se necesita comprobar la presencia de cuatro elementos observables. La lista no describe por sí sola la calidad global del párrafo.</p><p><strong>Valores:</strong> Sí · Aún no · No observable.</p></details></div>
          <div className={`${styles.interaction} ${styles.form}`}>{criteria.map((criterion, index) => <label key={index}>K{index + 1} · Indicador observable<input value={criterion} onChange={(event) => changeCriterion(index, event.target.value)} /></label>)}</div>
          <div className={`${styles.interaction} ${styles.form}`}>
            <div className={styles.twoColumns}>
              <label>Estructura<select value={structure} onChange={(event) => changeStructure(event.target.value as PrepStructure)}><option value="tabla">Tabla de cotejo</option><option value="markdown">Markdown estructurado</option></select></label>
              <label>Salida<select value={output} onChange={(event) => changeOutput(event.target.value as PrepOutput)}><option value="word">Word editable</option><option value="pdf">PDF imprimible</option></select></label>
            </div>
            <p className={styles.note}><strong>Salida PDF:</strong> la IA debe producir primero contenido para un documento editable; después se exporta como PDF imprimible. El PDF no se presenta como formato editable.</p>
          </div>
          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt base editable</p><h3>Lista de cotejo · {structure === "tabla" ? "tabla" : "Markdown"} · {output === "word" ? "Word" : "PDF"}</h3></div><button type="button" onClick={() => void copyPrompt("instrumento", instrumentPrompt)}>{copied === "instrumento" ? "Copiado" : "Copiar prompt"}</button></div>
            <textarea aria-label="Prompt editable del Minilaboratorio 1" rows={18} value={instrumentPrompt} onChange={(event) => { invalidateSaved(); setInstrumentPrompt(event.target.value); }} />
          </div>
          <ToolLinks />
        </section>

        <section className={styles.section} id="mini-lab-2">
          <SectionHeading eyebrow="Minilaboratorio 2 · 10 minutos" title="Interpreta ocho resultados ficticios" description="Los vacíos significan que no hay evidencia. No conviertas una ausencia de entrega en un resultado de cero." />
          <div className={styles.dashboardShell}>
            <h3>Tablero guiado · 8 resultados</h3><p>Caso separado de la sesión principal.</p>
            <div className={styles.metricGrid}><div className={styles.metricCard}><span>Participantes</span><strong>{expectedPrepMetrics.total}</strong></div><div className={styles.metricCard}><span>Entregas</span><strong>{expectedPrepMetrics.submitted}</strong></div><div className={styles.metricCard}><span>Entrega</span><strong>{expectedPrepMetrics.participationRate}%</strong></div><div className={styles.metricCard}><span>Prioridad</span><strong>K3</strong></div></div>
            <div className={styles.chartPanel}><h4>Logros observados por indicador</h4><div className={styles.barChart}>{(["k1", "k2", "k3", "k4"] as const).map((key) => <div className={styles.barRow} key={key}><span>{key.toUpperCase()}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${(expectedPrepMetrics.achieved[key] / expectedPrepMetrics.observable[key]) * 100}%` }} /></div><strong>{expectedPrepMetrics.achieved[key]}/7</strong></div>)}</div></div>
          </div>
          <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>ID ficticio</th><th>K1</th><th>K2</th><th>K3</th><th>K4</th><th>Entrega</th></tr></thead><tbody>{prepDataset.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.k1 === null ? "—" : item.k1 ? "Sí" : "Aún no"}</td><td>{item.k2 === null ? "—" : item.k2 ? "Sí" : "Aún no"}</td><td>{item.k3 === null ? "—" : item.k3 ? "Sí" : "Aún no"}</td><td>{item.k4 === null ? "—" : item.k4 ? "Sí" : "Aún no"}</td><td>{item.submitted ? "Sí" : "No"}</td></tr>)}</tbody></table></div>
          <details className={styles.sampleAnswer}><summary>Ver respuesta orientativa</summary><p>{prepInterpretation}</p></details>
          <div className={`${styles.interaction} ${styles.form}`}>
            <label>Un hallazgo observable<textarea rows={4} value={finding} onChange={(event) => changeFinding(event.target.value)} placeholder="Incluye numerador y denominador; no atribuyas causas." /></label>
            <label>Una acción docente<textarea rows={4} value={teachingAction} onChange={(event) => changeTeachingAction(event.target.value)} /></label>
            <label>Una nueva evidencia para verificar la decisión<textarea rows={4} value={newEvidence} onChange={(event) => changeNewEvidence(event.target.value)} /></label>
          </div>
          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt vivo y editable</p><h3>8 participantes · 7 entregas · 1 dato faltante</h3></div><button type="button" onClick={() => void copyPrompt("analisis", analysisPrompt)}>{copied === "analisis" ? "Copiado" : "Copiar prompt"}</button></div>
            <textarea aria-label="Prompt editable del Minilaboratorio 2" rows={18} value={analysisPrompt} onChange={(event) => { invalidateSaved(); setAnalysisPrompt(event.target.value); }} />
          </div>
          <ToolLinks />
        </section>

        <section className={styles.section}>
          <SectionHeading eyebrow="Revisión · 5 minutos" title="Acepta, adapta o rechaza el borrador generado" description="Pega debajo la respuesta obtenida con el prompt vivo y justifica tu decisión. Si no usaste IA, la contingencia sigue disponible como ejemplo y punto de partida." />
          <details className={styles.detailsCard} open><summary>Ejemplo y punto de partida sin IA · contingencia AULA-IA</summary><pre>{prepContingency}</pre></details>
          <div className={`${styles.interaction} ${styles.form}`}>
            <label>Borrador de IA o contingencia<textarea rows={8} value={aiDraft} onChange={(event) => { invalidateSaved(); setAiDraft(event.target.value); }} /><button type="button" className={styles.secondaryButton} onClick={() => { invalidateSaved(); setAiDraft(prepContingency); }}>Usar respuesta de contingencia</button></label>
            <label>Decisión<select value={aiDecision} onChange={(event) => { invalidateSaved(); setAiDecision(event.target.value); }}><option value="aceptar">Aceptar</option><option value="adaptar">Adaptar</option><option value="rechazar">Rechazar</option></select></label>
            <label>Justificación breve<textarea rows={4} value={justification} onChange={(event) => { invalidateSaved(); setJustification(event.target.value); }} /></label>
          </div>
        </section>

        <section className={styles.section} id="registro">
          <SectionHeading eyebrow="Evidencia de nivelación · 3 minutos" title="Guarda tu lista, hallazgo y decisión" description="Este registro es independiente y no acreditable. Después deberás registrar nuevamente la asistencia principal." />
          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence}>
            <div className={styles.summaryBox}><p><strong>Caso:</strong> {prepContext.title}</p><p><strong>Instrumento:</strong> Lista de cotejo</p><p><strong>Criterios:</strong> {criteria.filter((item) => item.trim()).length} de 4</p><p><strong>Decisión IA:</strong> {aiDecision}</p></div>
            <label>Correo usado en la entrada<input required type="email" value={attendance.email} onChange={(event) => setAttendance({ ...attendance, email: event.target.value })} /></label>
            <label>Hallazgo observable<textarea required minLength={25} rows={4} value={finding} onChange={(event) => changeFinding(event.target.value)} /></label>
            <label>Acción docente<textarea required minLength={20} rows={4} value={teachingAction} onChange={(event) => changeTeachingAction(event.target.value)} /></label>
            <label>Nueva evidencia para verificar la decisión<textarea required minLength={20} rows={4} value={newEvidence} onChange={(event) => changeNewEvidence(event.target.value)} /></label>
            <label>Justificación de aceptar, adaptar o rechazar<textarea required minLength={20} rows={4} value={justification} onChange={(event) => setJustification(event.target.value)} /></label>
            <p className={styles.privacyCallout}><strong>Comprueba:</strong> registraste primero tu entrada, usaste el mismo correo y trabajaste únicamente con datos ficticios.</p>
            <button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Guardando…" : "Guardar preparación S5"}</button>
            <StatusBanner state={evidenceState} />
            {evidenceState.kind === "success" ? <div className={styles.transitionCard}><p className={styles.eyebrow}>Preparación terminada</p><h3>Ahora entra a la Sesión 5 principal</h3><p>Registra nuevamente tu asistencia y elige una ruta de dificultad. La evidencia principal sí cuenta para acreditación.</p><a className={styles.primaryButton} href="/sesion-5#registro-principal">Abrir sesión principal</a></div> : null}
          </form>
          <EvidencePdfDownload session="S5P" email={attendance.email} pdfAccessCode={evidenceState.pdfAccessCode} />
        </section>

        <section className={styles.section}>
          <SectionHeading eyebrow="Opcional · fuera de los 60 minutos" title="Calibración rápida" description="Si queda tiempo, dos participantes aplican la lista a tres párrafos ficticios y comparan dónde discrepan. Después afinan un indicador, sin reemplazar la práctica obligatoria." />
          <details className={styles.detailsCard}><summary>Fuentes consultadas</summary><div className={styles.sourceList}>{sourceLinks.map((item) => <article key={item.url}><div><strong>{item.label}</strong><p>{item.support}</p></div><a href={item.url} target="_blank" rel="noreferrer">Consultar fuente ↗</a></article>)}</div></details>
        </section>
      </div>

      <SessionNavigation current={5} position="bottom" />
      <footer className={styles.footer}><div><strong>AULA-IA · Preparación S5</strong><p>Lista de cotejo, resultados ficticios y decisión docente.</p></div><div><a href="/">Sesión 1</a><a href="/sesion-4">Sesión 4</a><a href="/sesion-5">Sesión 5 principal</a><span>Sesión 6 · Próximamente</span><a href="#contenido">Volver arriba</a></div></footer>
    </main>
  );
}
