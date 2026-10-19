"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./session-two.module.css";
import SessionNavigation from "./session-navigation";
import {
  cases,
  contingencyFeedback,
  evaluationMoments,
  momentQuestions,
  prepAgenda,
  sessionFourTitle,
  sourceLinks,
} from "./session-four-data";

type SaveState = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
  code?: string;
};

const IDENTITY_KEY = "aula-ia-s4-identity";
const PREP_DRAFT_KEY = "aula-ia-s4-prep-draft";

const prepChecks = [
  {
    text: "La retroalimentación cita un fragmento del producto antes de valorar.",
    answer: "coherente",
    feedback: "La valoración puede rastrearse a una evidencia observable.",
  },
  {
    text: "El mensaje dice ‘eres poco creativo’ sin explicar qué aparece en el producto.",
    answer: "revisar",
    feedback: "Atribuye una característica personal y no ofrece evidencia ni siguiente paso.",
  },
  {
    text: "El siguiente paso puede realizarse en el tiempo disponible y responde al propósito.",
    answer: "coherente",
    feedback: "La acción propuesta es pertinente y viable.",
  },
] as const;

const calibrationRubric = [
  "Inicial: expresa una idea, pero todavía no la vincula con evidencia observable.",
  "En proceso: utiliza evidencia, aunque la relación, precisión o límite requiere ajuste.",
  "Logrado: relaciona propósito, evidencia y conclusión, y reconoce lo que no puede afirmar.",
] as const;

const calibrationSamples = [
  {
    id: "basica-historia",
    label: "Ejemplo 1 · Educación básica · Historia",
    evidence: "Las dos personas recuerdan la biblioteca de manera distinta: una dice que allí conversaban y la otra que no todas podían asistir. Por eso la primera experiencia fue mejor.",
    aiLevel: "En proceso",
    aiFeedback: "Identificas una diferencia y recuperas información de ambos testimonios. Revisa la frase ‘fue mejor’: la evidencia permite comparar experiencias, pero no jerarquizarlas. Escribe una conclusión limitada a lo que cada testimonio afirma.",
  },
  {
    id: "media-filosofia",
    label: "Ejemplo 2 · Media superior · Filosofía",
    evidence: "La decisión del personaje es injusta porque no escucha a todos y eso está mal.",
    aiLevel: "Inicial",
    aiFeedback: "Tu postura es clara. Para sostenerla, incorpora una acción o un fragmento del caso y explica con qué criterio consideras injusta la decisión.",
  },
  {
    id: "superior-humanidades",
    label: "Ejemplo 3 · Educación superior · Humanidades",
    evidence: "El fragmento permite inferir que el autor cuestiona la versión dominante, pero no demuestra la intención de todos los protagonistas. Para sostener esa conclusión haría falta contrastar otra fuente de la época.",
    aiLevel: "Logrado",
    aiFeedback: "Distingues evidencia, inferencia y límite, y propones una fuente adicional pertinente. Como siguiente paso, precisa qué dato buscarías en esa fuente para contrastar tu interpretación.",
  },
] as const;

type CalibrationSampleId = (typeof calibrationSamples)[number]["id"];
type CalibrationResponse = { level: string; feedback: string; decision: string; justification: string };

const initialCalibrationResponses = Object.fromEntries(
  calibrationSamples.map((sample) => [sample.id, { level: "", feedback: "", decision: "", justification: "" }]),
) as Record<CalibrationSampleId, CalibrationResponse>;

function buildPrepPrompt(
  item: (typeof cases)[number],
  momentKey: (typeof evaluationMoments)[number]["key"],
  criteria: string,
) {
  const moment = evaluationMoments.find((entry) => entry.key === momentKey) ?? evaluationMoments[1];
  return `Ayúdame a elaborar un BORRADOR de retroalimentación. La persona docente tomará la decisión final.

NIVEL Y ASIGNATURA
${item.level} · ${item.subject}

PROPÓSITO
${item.learningPurpose}

MOMENTO DE EVALUACIÓN
${moment.label}: ${moment.description}

CRITERIOS
${criteria || "PROPUESTA: identifica dos criterios observables relacionados con el propósito."}

EVIDENCIA DE PRÁCTICA
${item.source}
FIN DE LA EVIDENCIA

Presenta:
1. un logro respaldado por un fragmento;
2. un aspecto por revisar sin atribuir rasgos personales;
3. un siguiente paso concreto;
4. una nota sobre qué debe comprobar la persona docente.

No inventes información. Si la evidencia no permite afirmar algo, escribe INFORMACIÓN INSUFICIENTE.`;
}

async function postSessionFour(payload: Record<string, unknown>) {
  const response = await fetch("/api/session-four", {
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
  return <div className={`${styles.status} ${styles[`status_${state.kind}`]}`} role={state.kind === "error" ? "alert" : "status"} aria-live="polite"><strong>{state.kind === "loading" ? "Procesando…" : state.kind === "success" ? "Listo" : "Revisa"}</strong><span>{state.message}</span>{state.code ? <span className={styles.code}>Código: {state.code}</span> : null}</div>;
}

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}

export function SessionFourPrep() {
  const [registration, setRegistration] = useState({ fullName: "", email: "", institution: "", role: "Docente", consent: false });
  const [registrationState, setRegistrationState] = useState<SaveState>({ kind: "idle" });
  const [selectedCase, setSelectedCase] = useState<(typeof cases)[number]["key"]>(cases[0].key);
  const [moment, setMoment] = useState<(typeof evaluationMoments)[number]["key"]>("formativa");
  const [criteria, setCriteria] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [evidenceAnalysis, setEvidenceAnalysis] = useState("");
  const [feedback, setFeedback] = useState("");
  const [review, setReview] = useState("");
  const [momentAnswers, setMomentAnswers] = useState<string[]>(Array(momentQuestions.length).fill(""));
  const [momentScore, setMomentScore] = useState<number | null>(null);
  const [checkAnswers, setCheckAnswers] = useState<string[]>(Array(prepChecks.length).fill(""));
  const [checkScore, setCheckScore] = useState<number | null>(null);
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [copied, setCopied] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [calibrationResponses, setCalibrationResponses] = useState(initialCalibrationResponses);

  const currentCase = cases.find((item) => item.key === selectedCase) ?? cases[0];
  const totalMinutes = prepAgenda.reduce((sum, item) => sum + item.minutes, 0);
  const prepPrompt = useMemo(() => buildPrepPrompt(currentCase, moment, criteria), [criteria, currentCase, moment]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const identity = JSON.parse(localStorage.getItem(IDENTITY_KEY) || "{}") as Record<string, string>;
        const saved = JSON.parse(localStorage.getItem(PREP_DRAFT_KEY) || "{}") as Record<string, string>;
        setRegistration((current) => ({ ...current, fullName: identity.fullName || "", email: identity.email || "", institution: identity.institution || "", role: identity.role || "Docente" }));
        const item = cases.find((candidate) => candidate.key === saved.selectedCase) ?? cases[0];
        const savedMoment = evaluationMoments.find((entry) => entry.key === saved.moment)?.key ?? "formativa";
        setSelectedCase(item.key);
        setMoment(savedMoment);
        setCriteria(saved.criteria || "");
        setAiDraft(saved.aiDraft || "");
        setEvidenceAnalysis(saved.evidenceAnalysis || "");
        setFeedback(saved.feedback || "");
        setReview(saved.review || "");
      } catch {
        // La preparación continúa aunque el borrador local no pueda recuperarse.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PREP_DRAFT_KEY, JSON.stringify({ selectedCase, moment, criteria, aiDraft, evidenceAnalysis, feedback, review }));
  }, [aiDraft, criteria, evidenceAnalysis, feedback, hydrated, moment, review, selectedCase]);

  function chooseCase(key: (typeof cases)[number]["key"]) {
    setSelectedCase(key);
    setCriteria("");
    setAiDraft("");
    setEvidenceAnalysis("");
    setFeedback("");
    setReview("");
    setEvidenceState({ kind: "idle" });
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationState({ kind: "loading", message: "Registrando tu entrada a la preparación…" });
    try {
      const response = await postSessionFour({ action: "leveling_attendance", ...registration });
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(registration));
      setRegistrationState({ kind: "success", message: typeof response.message === "string" ? response.message : "Entrada registrada.", code: typeof response.confirmationCode === "string" ? response.confirmationCode : undefined });
    } catch (error) {
      setRegistrationState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible registrar la entrada." });
    }
  }

  async function handleEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvidenceState({ kind: "loading", message: "Guardando tu recorrido de preparación…" });
    try {
      const response = await postSessionFour({
        action: "leveling_activity",
        email: registration.email,
        activity: "evidencia-preparatoria",
        evidenceType: "practica-guiada",
        response: {
          caseKey: selectedCase,
          educationalLevel: currentCase.level,
          subject: currentCase.subject,
          evaluationMoment: moment,
          purpose: currentCase.learningPurpose,
          criteria,
          prompt: prepPrompt,
          aiDraft,
          evidenceAnalysis,
          feedback,
          review,
          momentScore,
          checkScore,
        },
        result: "Retroalimentación guiada con evidencia, criterio, siguiente paso y revisión docente",
        completed: true,
      });
      const syncNote = response.sheetSync === "synced"
        ? " También se reflejó en el registro institucional de nivelación."
        : response.sheetSync === "failed"
          ? " El avance quedó protegido en la plataforma, pero la réplica institucional requiere revisión."
          : " El avance quedó protegido en la plataforma; la conexión institucional no está configurada en este entorno.";
      setEvidenceState({ kind: "success", message: `${typeof response.message === "string" ? response.message : "Preparación registrada."} Este registro no acredita la sesión principal.${syncNote}`, code: typeof response.confirmationCode === "string" ? response.confirmationCode : undefined });
    } catch (error) {
      setEvidenceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible registrar. Tu borrador permanece en este dispositivo." });
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prepPrompt);
      setCopied("prompt");
      window.setTimeout(() => setCopied(""), 2500);
    } catch {
      setCopied("error");
    }
  }

  function updateCalibration(id: CalibrationSampleId, field: keyof CalibrationResponse, value: string) {
    setCalibrationResponses((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  return (
    <main className={`${styles.shell} ${styles.prepShell} ${styles.sessionFourShell}`}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}><a className={styles.brand} href="/" aria-label="AULA-IA, volver al inicio"><span aria-hidden="true">AI</span><span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span></a><nav aria-label="Navegación de preparación"><a href="/">Inicio</a><a href="/sesion-3">Sesión 3</a><a href="#agenda">Agenda</a><a href="#practica">Práctica</a><a href="/sesion-4">Sesión principal</a></nav></header>
      <SessionNavigation current={4} position="top" />

      <div id="contenido">
        <section className={`${styles.hero} ${styles.prepHero}`}>
          <div className={styles.heroCopy}><p className={styles.eyebrow}>Sesión 4 · Preparación para principiantes</p><h1>Leer una evidencia antes de opinar</h1><p className={styles.lede}>Practica los conceptos básicos antes de entrar a “{sessionFourTitle}”. El recorrido muestra cómo convertir una observación en retroalimentación útil.</p><div className={styles.metrics}><span><strong>{totalMinutes}</strong> minutos exactos</span><span><strong>45</strong> minutos de demostración, práctica y revisión</span><span><strong>1</strong> ruta guiada</span></div><div className={styles.heroActions}><a className={styles.primaryButton} href="#registro-prep">Comenzar preparación</a><a className={styles.secondaryButton} href="/sesion-4">Ya puedo ir a la principal</a></div></div>
          <div className={styles.prepMap} aria-label="Recorrido de preparación"><span>1. Propósito</span><span>2. Evidencia</span><span>3. Criterio</span><span>4. Logro</span><span>5. Siguiente paso</span><span>6. Revisión</span></div>
        </section>

        <aside className={styles.nonAccreditable}><strong>Importante:</strong> esta hora registra avance, pero no cuenta para la acreditación. Al terminar, entra a la sesión principal y registra nuevamente tu asistencia.</aside>

        <section className={styles.prepMaterial} aria-labelledby="material-preparacion-s4">
          <div><h2 id="material-preparacion-s4">Material de preparación para principiantes</h2><p>La presentación editable acompaña exclusivamente esta ruta de nivelación.</p></div>
          <a className={styles.secondaryButton} href="/recursos/sesion-4/presentacion-preparacion-s4.pptx">Descargar presentación editable para principiantes</a>
        </section>

        <section className={styles.section} id="registro-prep">
          <Heading eyebrow="Paso 1" title="Registra tu entrada a la preparación" description="Este registro se guarda separado de la asistencia oficial de la Sesión 4." />
          <form className={`${styles.form} ${styles.cardForm}`} onSubmit={handleRegistration}>
            <div className={styles.twoColumns}><label>Nombre completo<input required value={registration.fullName} onChange={(event) => setRegistration({ ...registration, fullName: event.target.value })} autoComplete="name" /></label><label>Correo electrónico<input required type="email" value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} autoComplete="email" /></label><label>Institución<input required value={registration.institution} onChange={(event) => setRegistration({ ...registration, institution: event.target.value })} autoComplete="organization" /></label><label>Función<select value={registration.role} onChange={(event) => setRegistration({ ...registration, role: event.target.value })}><option>Docente</option><option>Directivo</option><option>Apoyo técnico-pedagógico</option><option>Estudiante normalista</option><option>Otra función educativa</option></select></label></div>
            <label className={styles.consent}><input type="checkbox" checked={registration.consent} onChange={(event) => setRegistration({ ...registration, consent: event.target.checked })} /><span>Acepto el uso de estos datos para registrar mi participación en la preparación. No se mostrarán al grupo.</span></label>
            <button className={styles.primaryButton} type="submit" disabled={registrationState.kind === "loading"}>{registrationState.kind === "loading" ? "Registrando…" : "Registrar entrada"}</button><StatusBanner state={registrationState} />
          </form>
        </section>

        <section className={styles.section} id="agenda"><Heading eyebrow="Una hora acompañada" title="60 minutos exactos" description="Cada bloque conserva una acción central y una alternativa si la herramienta externa no está disponible." /><ol className={styles.agenda}>{prepAgenda.map((item) => <li key={item.time} className={item.minutes >= 10 ? styles.agendaActive : ""}><span>{item.time} min</span><div><strong>{item.label}</strong><p>{item.detail}</p></div>{item.minutes >= 10 ? <em>Práctica</em> : null}</li>)}</ol></section>

        <section className={styles.section}>
          <Heading eyebrow="Tres momentos · 10 minutos" title="Primero decide para qué necesitas la información" description="Diagnóstica, formativa y sumativa no son sinónimos; se distinguen por el momento y el uso de la información." />
          <div className={styles.infoGrid}>{evaluationMoments.map((item) => <article key={item.key}><h3>{item.label}</h3><p>{item.description}</p></article>)}</div>
          <div className={styles.interaction}><div><p className={styles.eyebrow}>Interacción 1</p><h3>Clasifica tres ejemplos</h3><p>Selecciona y comprueba.</p></div><div className={styles.quizList}>{momentQuestions.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={momentAnswers[index]} onChange={(event) => { const next = [...momentAnswers]; next[index] = event.target.value; setMomentAnswers(next); setMomentScore(null); }}><option value="">Selecciona</option>{evaluationMoments.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select>{momentScore !== null ? <small>{item.feedback}</small> : null}</label>)}</div><button type="button" className={styles.secondaryButton} onClick={() => setMomentScore(momentQuestions.filter((item, index) => item.answer === momentAnswers[index]).length)}>Comprobar respuestas</button>{momentScore !== null ? <p className={styles.quizResult} role="status">{momentScore} de {momentQuestions.length} correctas.</p> : null}</div>
        </section>

        <section className={styles.section} id="practica">
          <Heading eyebrow="Demostración acompañada · 15 minutos" title="Evidencia + criterio + siguiente paso" description="Elige un caso general. La plataforma arma una instrucción básica y ofrece una respuesta de contingencia." />
          <div className={styles.caseTabs} role="group" aria-label="Casos de preparación">{cases.map((item) => <button key={item.key} type="button" aria-pressed={selectedCase === item.key} onClick={() => chooseCase(item.key)}><strong>{item.level}</strong><span>{item.subject}</span></button>)}</div>
          <div className={styles.caseCard}><div><p className={styles.eyebrow}>Caso elegido</p><h3>{currentCase.title}</h3><p>{currentCase.learningPurpose}</p><p>{currentCase.context}</p></div><details open><summary>Leer evidencia simulada</summary><pre>{currentCase.source}</pre></details></div>
          <div className={styles.form}><label>Momento de evaluación<select value={moment} onChange={(event) => { setMoment(event.target.value as (typeof evaluationMoments)[number]["key"]); setAiDraft(""); setEvidenceAnalysis(""); setFeedback(""); setReview(""); }}><option value="diagnostica">Diagnóstica</option><option value="formativa">Formativa</option><option value="sumativa">Sumativa</option></select></label><label>Dos criterios observables<textarea rows={4} value={criteria} onChange={(event) => setCriteria(event.target.value)} placeholder="1. Usa un fragmento para apoyar la comparación. 2. Limita la conclusión a la evidencia disponible." /></label></div>
          <div className={styles.promptPanel}><div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt guiado</p><h3>Propósito + evidencia + criterios</h3></div><button type="button" onClick={handleCopy}>{copied === "prompt" ? "Copiado" : "Copiar prompt"}</button></div><pre>{prepPrompt}</pre></div>
          <div className={styles.toolLinks}><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Abrir ChatGPT ↗</a><a href="https://gemini.google.com/" target="_blank" rel="noreferrer">Abrir Gemini ↗</a></div>
          <details className={styles.sampleAnswer}><summary>No tengo acceso a una IA: usar borrador de práctica</summary><pre>{contingencyFeedback}</pre></details>

          <div className={styles.interaction}><div><p className={styles.eyebrow}>Interacción 2 · Construcción guiada · 20 minutos</p><h3>Redacta una retroalimentación suficiente</h3><p>Esta preparación utiliza una ruta básica. En la principal podrás elegir otras dificultades.</p></div><div className={styles.form}><label>Borrador de IA o respuesta integrada<textarea rows={7} value={aiDraft} onChange={(event) => setAiDraft(event.target.value)} /></label><label>Lo que la evidencia permite afirmar y lo que no<textarea rows={5} value={evidenceAnalysis} onChange={(event) => setEvidenceAnalysis(event.target.value)} /></label><label>Tu retroalimentación: logro + evidencia + siguiente paso<textarea rows={7} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label><label>Una mejora que realizaste al borrador<textarea rows={4} value={review} onChange={(event) => setReview(event.target.value)} /></label></div></div>

          <div className={styles.interaction}><div><p className={styles.eyebrow}>Interacción 3 · Revisión CAVIA ligera · 5 minutos</p><h3>¿Coherente o requiere revisión?</h3><p>La explicación muestra el criterio aplicado.</p></div><div className={styles.quizList}>{prepChecks.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={checkAnswers[index]} onChange={(event) => { const next = [...checkAnswers]; next[index] = event.target.value; setCheckAnswers(next); setCheckScore(null); }}><option value="">Selecciona</option><option value="coherente">Coherente</option><option value="revisar">Requiere revisión</option></select>{checkScore !== null ? <small>{item.feedback}</small> : null}</label>)}</div><button type="button" className={styles.secondaryButton} onClick={() => setCheckScore(prepChecks.filter((item, index) => item.answer === checkAnswers[index]).length)}>Comprobar criterios</button>{checkScore !== null ? <p className={styles.quizResult} role="status">{checkScore} de {prepChecks.length} correctas. {checkScore === prepChecks.length ? "Revisa ahora tu propia retroalimentación." : "Lee el criterio y vuelve a decidir."}</p> : null}</div>
          <details className={styles.detailsCard}><summary>Consultar fuentes sobre agencia docente e inclusión</summary><p>La persona docente conserva la decisión profesional y adapta la retroalimentación al contexto, al progreso y a opciones razonables de participación.</p><div className={styles.inlineActions}><a href={sourceLinks[0].url} target="_blank" rel="noreferrer">UNESCO · marco docente ↗</a><a href={sourceLinks[5].url} target="_blank" rel="noreferrer">CAST · retroalimentación accionable ↗</a></div></details>
        </section>

        <section className={styles.section} id="evidencia">
          <Heading eyebrow="Registro y transición · 5 minutos" title="Guarda tu recorrido y continúa" description="No acredita la Sesión 4. Registra que completaste evidencia, criterios, retroalimentación y revisión." />
          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence}><div className={styles.summaryBox}><p><strong>Caso:</strong> {currentCase.level} · {currentCase.subject}</p><p><strong>Momento:</strong> {evaluationMoments.find((entry) => entry.key === moment)?.label}</p><p><strong>Criterios:</strong> {criteria || "Pendiente"}</p><p><strong>Retroalimentación:</strong> {feedback || "Pendiente"}</p><p><strong>Revisión:</strong> {review || "Pendiente"}</p></div><p className={styles.privacyNote}><strong>Comprueba:</strong> registraste primero tu entrada, utilizaste el mismo correo y no incluiste datos personales del alumnado.</p><button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Guardando preparación…" : "Guardar preparación"}</button><StatusBanner state={evidenceState} />{evidenceState.kind === "success" ? <div className={styles.transitionCard}><p className={styles.eyebrow}>Preparación terminada</p><h3>Ahora entra a la Sesión 4 principal</h3><p>Volverás a registrar tu asistencia; esa ruta contiene la evidencia acreditable y tres opciones de dificultad.</p><a className={styles.primaryButton} href="/sesion-4#registro-principal">Abrir sesión principal</a></div> : null}</form>
        </section>

        <section className={styles.section} id="actividad-opcional-calibracion">
          <Heading eyebrow="ACTIVIDAD ADICIONAL · OPCIONAL · 15–20 MINUTOS" title="Calibrar antes de retroalimentar" description="Realízala solo si queda tiempo. Es una actividad de respaldo fuera de los 60 minutos oficiales: no sustituye, reorganiza ni condiciona la preparación ni el ingreso a la sesión principal." />
          <div className={styles.recommendation}>
            <h3>Rúbrica simple de tres niveles</h3>
            <ul>{calibrationRubric.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
            <p><strong>Ruta sugerida:</strong> trabaja dos ejemplos; usa el tercero únicamente si todavía hay tiempo. Primero decide sin consultar la propuesta de IA.</p>
          </div>
          <div className={styles.calibrationGrid}>
            {calibrationSamples.map((sample) => {
              const response = calibrationResponses[sample.id];
              return (
                <article className={styles.calibrationCard} key={sample.id}>
                  <div>
                    <p className={styles.eyebrow}>EJEMPLO SIMULADO AULA-IA</p>
                    <h3>{sample.label}</h3>
                    <blockquote>{sample.evidence}</blockquote>
                  </div>
                  <div className={styles.form}>
                    <label>Nivel que asignas con la rúbrica<select value={response.level} onChange={(event) => updateCalibration(sample.id, "level", event.target.value)}><option value="">Selecciona</option><option>Inicial</option><option>En proceso</option><option>Logrado</option></select></label>
                    <label>Tu retroalimentación breve<textarea rows={4} value={response.feedback} onChange={(event) => updateCalibration(sample.id, "feedback", event.target.value)} placeholder="Reconoce un logro, cita evidencia y propone un siguiente paso." /></label>
                    <details><summary>Comparar con la propuesta de IA</summary><p><strong>Nivel propuesto:</strong> {sample.aiLevel}</p><p><strong>Retroalimentación propuesta:</strong> {sample.aiFeedback}</p></details>
                    <label>Decisión docente sobre la propuesta<select value={response.decision} onChange={(event) => updateCalibration(sample.id, "decision", event.target.value)}><option value="">Selecciona después de comparar</option><option value="aceptar">Aceptar</option><option value="adaptar">Adaptar</option><option value="rechazar">Rechazar</option></select></label>
                    <label>Justifica tu decisión<textarea rows={3} value={response.justification} onChange={(event) => updateCalibration(sample.id, "justification", event.target.value)} placeholder="Explica qué conservarías, cambiarías o retirarías y por qué." /></label>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <SessionNavigation current={4} position="bottom" />
      <footer className={styles.footer}><div><strong>AULA-IA · Preparación S4</strong><p>Acompañamiento metodológico, sin funciones de pago obligatorias.</p></div><div><a href="/">Sesión 1</a><a href="/sesion-2">Sesión 2</a><a href="/sesion-3">Sesión 3</a><a href="/sesion-4">Sesión 4 principal</a><a href="/sesion-5">Sesión 5</a><a href="#contenido">Volver arriba</a></div></footer>
    </main>
  );
}
