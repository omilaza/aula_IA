"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./session-two.module.css";
import SessionNavigation from "./session-navigation";
import {
  cases,
  orderSteps,
  prepAgenda,
  sessionThreeTitle,
  sourceLinks,
} from "./session-three-data";

type SaveState = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
  code?: string;
};

const IDENTITY_KEY = "aula-ia-s3-identity";
const PREP_DRAFT_KEY = "aula-ia-s3-prep-draft";

const prepChecks = [
  {
    text: "El propósito pide comparar, la actividad compara y la evidencia muestra semejanzas y diferencias.",
    answer: "coherente",
    feedback: "Las tres piezas observan la misma acción: comparar.",
  },
  {
    text: "El propósito pide argumentar, pero el cierre solo pregunta si la actividad gustó.",
    answer: "revisar",
    feedback: "La opinión sobre la actividad no permite observar la construcción de un argumento.",
  },
  {
    text: "La secuencia reserva 10 minutos de cierre dentro de una clase de 45 minutos.",
    answer: "coherente",
    feedback: "El tiempo puede ser viable si los demás momentos completan los 45 minutos.",
  },
] as const;

function buildPrepPrompt(item: (typeof cases)[number], purpose: string, context: string) {
  return `Ayúdame a elaborar un borrador de mini-secuencia. La persona docente tomará la decisión final.

NIVEL Y ASIGNATURA
${item.level} · ${item.subject}

PROPÓSITO
${purpose || item.learningPurpose}

CONTEXTO
${context || item.context}

CASO DE REFERENCIA
${item.source}
FIN DEL CASO

Organiza una propuesta con:
1. inicio;
2. desarrollo;
3. cierre;
4. tiempos que sumen la duración disponible;
5. evidencia breve del aprendizaje.

Marca como PROPUESTA cualquier elemento nuevo. Si el caso no permite afirmar algo, indica INFORMACIÓN INSUFICIENTE.`;
}

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

function StatusBanner({ state }: { state: SaveState }) {
  if (state.kind === "idle") return null;
  return (
    <div className={`${styles.status} ${styles[`status_${state.kind}`]}`} role={state.kind === "error" ? "alert" : "status"} aria-live="polite">
      <strong>{state.kind === "loading" ? "Procesando…" : state.kind === "success" ? "Listo" : "Revisa"}</strong>
      <span>{state.message}</span>
      {state.code ? <span className={styles.code}>Código: {state.code}</span> : null}
    </div>
  );
}

function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return <div className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}

export function SessionThreePrep() {
  const [registration, setRegistration] = useState({
    fullName: "",
    email: "",
    institution: "",
    role: "Docente",
    consent: false,
  });
  const [registrationState, setRegistrationState] = useState<SaveState>({ kind: "idle" });
  const [selectedCase, setSelectedCase] = useState<(typeof cases)[number]["key"]>("basica");
  const [purpose, setPurpose] = useState<string>(cases[0].learningPurpose);
  const [context, setContext] = useState<string>(cases[0].context);
  const [aiDraft, setAiDraft] = useState("");
  const [sequence, setSequence] = useState("");
  const [evidence, setEvidence] = useState("");
  const [review, setReview] = useState("");
  const [orderAnswers, setOrderAnswers] = useState<string[]>(Array(orderSteps.length).fill(""));
  const [orderScore, setOrderScore] = useState<number | null>(null);
  const [checkAnswers, setCheckAnswers] = useState<string[]>(Array(prepChecks.length).fill(""));
  const [checkScore, setCheckScore] = useState<number | null>(null);
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [copied, setCopied] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const currentCase = cases.find((item) => item.key === selectedCase) ?? cases[0];
  const totalMinutes = prepAgenda.reduce((sum, item) => sum + item.minutes, 0);
  const prepPrompt = useMemo(
    () => buildPrepPrompt(currentCase, purpose, context),
    [context, currentCase, purpose],
  );

  const orderedPractice = useMemo(
    () => [
      { text: orderSteps[3], position: "4" },
      { text: orderSteps[0], position: "1" },
      { text: orderSteps[4], position: "5" },
      { text: orderSteps[2], position: "3" },
      { text: orderSteps[1], position: "2" },
    ],
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const identity = JSON.parse(localStorage.getItem(IDENTITY_KEY) || "{}") as Record<string, string>;
        const saved = JSON.parse(localStorage.getItem(PREP_DRAFT_KEY) || "{}") as Record<string, string>;
        setRegistration((current) => ({
          ...current,
          fullName: identity.fullName || "",
          email: identity.email || "",
          institution: identity.institution || "",
          role: identity.role || "Docente",
        }));
        const item = cases.find((candidate) => candidate.key === saved.selectedCase) ?? cases[0];
        setSelectedCase(item.key);
        setPurpose(saved.purpose || item.learningPurpose);
        setContext(saved.context || item.context);
        setAiDraft(saved.aiDraft || "");
        setSequence(saved.sequence || "");
        setEvidence(saved.evidence || "");
        setReview(saved.review || "");
      } catch {
        // El recorrido continúa aunque no pueda recuperarse el borrador local.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PREP_DRAFT_KEY, JSON.stringify({
      selectedCase,
      purpose,
      context,
      aiDraft,
      sequence,
      evidence,
      review,
    }));
  }, [aiDraft, context, evidence, hydrated, purpose, review, selectedCase, sequence]);

  function chooseCase(key: (typeof cases)[number]["key"]) {
    const item = cases.find((candidate) => candidate.key === key) ?? cases[0];
    setSelectedCase(item.key);
    setPurpose(item.learningPurpose);
    setContext(item.context);
    setAiDraft("");
    setSequence("");
    setEvidence("");
    setReview("");
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationState({ kind: "loading", message: "Registrando tu entrada a la preparación…" });
    try {
      const response = await postSessionThree({ action: "leveling_attendance", ...registration });
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(registration));
      setRegistrationState({
        kind: "success",
        message: typeof response.message === "string" ? response.message : "Entrada registrada.",
        code: typeof response.confirmationCode === "string" ? response.confirmationCode : undefined,
      });
    } catch (error) {
      setRegistrationState({
        kind: "error",
        message: error instanceof Error ? error.message : "No fue posible registrar la entrada.",
      });
    }
  }

  async function handleEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvidenceState({ kind: "loading", message: "Guardando tu recorrido de preparación…" });
    try {
      const response = await postSessionThree({
        action: "leveling_activity",
        email: registration.email,
        activity: "evidencia-preparatoria",
        evidenceType: "practica-guiada",
        response: {
          caseKey: selectedCase,
          educationalLevel: currentCase.level,
          subject: currentCase.subject,
          purpose,
          context,
          prompt: prepPrompt,
          aiDraft,
          sequence,
          evidence,
          review,
          orderScore,
          checkScore,
        },
        result: "Mini-secuencia guiada con propósito, tres momentos, evidencia y revisión",
        completed: true,
      });
      const syncNote = " Guardado en la hoja institucional.";
      setEvidenceState({
        kind: "success",
        message: `${typeof response.message === "string" ? response.message : "Preparación registrada."} Este registro no acredita la sesión principal.${syncNote}`,
        code: typeof response.confirmationCode === "string" ? response.confirmationCode : undefined,
      });
    } catch (error) {
      setEvidenceState({
        kind: "error",
        message: error instanceof Error ? error.message : "No fue posible registrar. Tu borrador permanece en este dispositivo.",
      });
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

  return (
    <main className={`${styles.shell} ${styles.prepShell} ${styles.sessionThreeShell}`}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="AULA-IA, volver a la Sesión 1"><span aria-hidden="true">AI</span><span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span></a>
        <nav aria-label="Navegación de preparación"><a href="#agenda">Agenda</a><a href="#practica">Práctica</a><a href="#evidencia">Registro</a><a href="/sesion-3">Sesión principal</a></nav>
      </header>
      <SessionNavigation current={3} position="top" />

      <div id="contenido">
        <section className={`${styles.hero} ${styles.prepHero}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Sesión 3 · Preparación para principiantes</p>
            <h1>Construir una secuencia, paso a paso</h1>
            <p className={styles.lede}>Practica la metodología de diseño antes de entrar a “{sessionThreeTitle}”. El acompañamiento se concentra en conversar con la IA y revisar su propuesta.</p>
            <div className={styles.metrics}><span><strong>{totalMinutes}</strong> minutos exactos</span><span><strong>45</strong> minutos de demostración, práctica y revisión</span><span><strong>1</strong> ruta suficiente</span></div>
            <div className={styles.heroActions}><a className={styles.primaryButton} href="#registro-prep">Comenzar preparación</a><a className={styles.secondaryButton} href="/sesion-3">Ya puedo ir a la principal</a></div>
          </div>
          <div className={styles.prepMap} aria-label="Recorrido de preparación"><span>1. Propósito</span><span>2. Contexto</span><span>3. Actividades</span><span>4. Evidencia</span><span>5. Borrador IA</span><span>6. Revisión</span></div>
        </section>

        <aside className={styles.nonAccreditable}><strong>Importante:</strong> esta hora registra avance, pero no cuenta para la acreditación. Al terminar, entra a la sesión principal y registra nuevamente tu asistencia.</aside>

        <section className={styles.section} id="registro-prep">
          <Heading eyebrow="Paso 1" title="Registra tu entrada a la preparación" description="Este registro se guarda separado de la asistencia oficial de la Sesión 3." />
          <form className={`${styles.form} ${styles.cardForm}`} onSubmit={handleRegistration}>
            <div className={styles.twoColumns}>
              <label>Nombre completo<input required value={registration.fullName} onChange={(event) => setRegistration({ ...registration, fullName: event.target.value })} autoComplete="name" /></label>
              <label>Correo electrónico<input required type="email" value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} autoComplete="email" /></label>
              <label>Institución<input required value={registration.institution} onChange={(event) => setRegistration({ ...registration, institution: event.target.value })} autoComplete="organization" /></label>
              <label>Función<select value={registration.role} onChange={(event) => setRegistration({ ...registration, role: event.target.value })}><option>Docente</option><option>Directivo</option><option>Apoyo técnico-pedagógico</option><option>Estudiante normalista</option><option>Otra función educativa</option></select></label>
            </div>
            <label className={styles.consent}><input type="checkbox" checked={registration.consent} onChange={(event) => setRegistration({ ...registration, consent: event.target.checked })} /><span>Acepto el uso de estos datos para registrar mi participación en la preparación. No se mostrarán al grupo.</span></label>
            <button className={styles.primaryButton} type="submit" disabled={registrationState.kind === "loading"}>{registrationState.kind === "loading" ? "Registrando…" : "Registrar entrada"}</button>
            <StatusBanner state={registrationState} />
          </form>
        </section>

        <section className={styles.section} id="agenda">
          <Heading eyebrow="Una hora acompañada" title="60 minutos exactos" description="Cada bloque mantiene una acción central y una alternativa si la herramienta externa no está disponible." />
          <ol className={styles.agenda}>{prepAgenda.map((item) => <li key={item.time} className={item.minutes >= 10 ? styles.agendaActive : ""}><span>{item.time} min</span><div><strong>{item.label}</strong><p>{item.detail}</p></div>{item.minutes >= 10 ? <em>Práctica</em> : null}</li>)}</ol>
        </section>

        <section className={styles.section}>
          <Heading eyebrow="Propósito, actividad y evidencia · 10 minutos" title="Primero ordena las decisiones" description="La dificultad no está en encontrar botones: está en seguir un proceso y comprobar que cada paso responda al anterior." />
          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 1 · Ordenar pasos</p><h3>Construye el recorrido</h3><p>Asigna del 1 al 5 y comprueba. Puedes reintentar.</p></div>
            <div className={styles.quizList}>{orderedPractice.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={orderAnswers[index]} onChange={(event) => { const next = [...orderAnswers]; next[index] = event.target.value; setOrderAnswers(next); setOrderScore(null); }}><option value="">Posición</option>{orderSteps.map((_, optionIndex) => <option key={optionIndex} value={String(optionIndex + 1)}>{optionIndex + 1}</option>)}</select></label>)}</div>
            <button type="button" className={styles.secondaryButton} onClick={() => setOrderScore(orderAnswers.filter((answer, index) => answer === orderedPractice[index].position).length)}>Comprobar orden</button>
            {orderScore !== null ? <p className={styles.quizResult} role="status">{orderScore} de {orderSteps.length} pasos en su lugar. {orderScore === orderSteps.length ? "El procedimiento está completo; ahora úsalo con un caso." : "El propósito se define antes de pedir el borrador y la revisión ocurre al final."}</p> : null}
          </div>
        </section>

        <section className={styles.section} id="practica">
          <Heading eyebrow="Demostración acompañada · 15 minutos" title="Del propósito al prompt" description="Elige un caso general, observa cómo se completa el encargo y utiliza la respuesta integrada si no tienes acceso a otra herramienta." />
          <div className={styles.caseTabs} role="group" aria-label="Casos de preparación">
            {cases.map((item) => <button key={item.key} type="button" aria-pressed={selectedCase === item.key} onClick={() => chooseCase(item.key)}><strong>{item.level}</strong><span>{item.subject}</span></button>)}
          </div>
          <div className={styles.caseCard}>
            <div><p className={styles.eyebrow}>Caso elegido</p><h3>{currentCase.title}</h3><p>{currentCase.learningPurpose}</p><p>{currentCase.context}</p></div>
            <details open><summary>Leer caso simulado</summary><pre>{currentCase.source}</pre></details>
          </div>
          <div className={styles.promptPanel}>
            <div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Prompt guiado</p><h3>Propósito + contexto + producto</h3></div><button type="button" onClick={() => handleCopy("prompt", prepPrompt)}>{copied === "prompt" ? "Copiado" : "Copiar prompt"}</button></div>
            <pre>{prepPrompt}</pre>
          </div>
          <div className={styles.toolLinks}><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Abrir ChatGPT ↗</a><a href="https://gemini.google.com/" target="_blank" rel="noreferrer">Abrir Gemini ↗</a></div>
          <details className={styles.sampleAnswer}><summary>No tengo acceso a una IA: usar borrador de práctica</summary><p><strong>Inicio:</strong> presentar la pregunta central y recuperar una idea previa. <strong>Desarrollo:</strong> leer el caso, identificar dos elementos y compararlos en parejas. <strong>Cierre:</strong> redactar una respuesta breve relacionada con el propósito. <strong>Evidencia:</strong> organizador y conclusión revisados con dos criterios. PROPUESTA: ofrecer un esquema de apoyo a quien lo necesite.</p></details>

          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 2 · Construcción guiada · 20 minutos</p><h3>Completa una mini-secuencia suficiente</h3><p>No necesitas desarrollar las rutas intermedia y avanzada. Esta preparación utiliza la ruta básica.</p></div>
            <div className={styles.form}>
              <label>Propósito observable<textarea rows={3} value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label>
              <label>Contexto, duración y recursos<textarea rows={3} value={context} onChange={(event) => setContext(event.target.value)} /></label>
              <label>Borrador de la IA o respuesta integrada<textarea rows={7} value={aiDraft} onChange={(event) => setAiDraft(event.target.value)} placeholder="Pega la respuesta o copia el ejemplo de contingencia." /></label>
              <label>Tu secuencia: inicio, desarrollo y cierre<textarea rows={7} value={sequence} onChange={(event) => setSequence(event.target.value)} /></label>
              <label>Evidencia del aprendizaje<textarea rows={4} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
              <label>Una mejora que realizaste<textarea rows={4} value={review} onChange={(event) => setReview(event.target.value)} /></label>
            </div>
          </div>

          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 3 · Revisión CAVIA ligera · 5 minutos</p><h3>¿Coherente o requiere revisión?</h3><p>La retroalimentación explica qué relación se está comprobando.</p></div>
            <div className={styles.quizList}>{prepChecks.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={checkAnswers[index]} onChange={(event) => { const next = [...checkAnswers]; next[index] = event.target.value; setCheckAnswers(next); setCheckScore(null); }}><option value="">Selecciona</option><option value="coherente">Coherente</option><option value="revisar">Requiere revisión</option></select>{checkScore !== null ? <small>{item.feedback}</small> : null}</label>)}</div>
            <button type="button" className={styles.secondaryButton} onClick={() => setCheckScore(prepChecks.filter((item, index) => item.answer === checkAnswers[index]).length)}>Comprobar criterios</button>
            {checkScore !== null ? <p className={styles.quizResult} role="status">{checkScore} de {prepChecks.length} correctas. {checkScore === prepChecks.length ? "Revisa ahora tu propia secuencia." : "Lee el criterio y vuelve a decidir."}</p> : null}
          </div>
          <details className={styles.detailsCard}><summary>Consultar fuente sobre revisión docente</summary><p>OpenAI señala que los resultados generados son puntos de partida y que la persona docente conserva la decisión sobre el material. Esta preparación convierte esa recomendación en un procedimiento concreto de revisión.</p><a href={sourceLinks[2].url} target="_blank" rel="noreferrer">{sourceLinks[2].label} ↗</a></details>
        </section>

        <section className={styles.section} id="evidencia">
          <Heading eyebrow="Evidencia y transición · 5 minutos" title="Guarda tu recorrido y continúa" description="No acredita la Sesión 3. Registra que completaste propósito, secuencia, evidencia y revisión." />
          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence}>
            <div className={styles.summaryBox}><p><strong>Caso:</strong> {currentCase.level} · {currentCase.subject}</p><p><strong>Propósito:</strong> {purpose || "Pendiente"}</p><p><strong>Secuencia:</strong> {sequence || "Pendiente"}</p><p><strong>Revisión:</strong> {review || "Pendiente"}</p></div>
            <p className={styles.privacyNote}><strong>Comprueba:</strong> registraste primero tu entrada, utilizaste el mismo correo y completaste la mini-secuencia sin datos personales.</p>
            <button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Guardando preparación…" : "Guardar preparación"}</button>
            <StatusBanner state={evidenceState} />
            {evidenceState.kind === "success" ? <div className={styles.transitionCard}><p className={styles.eyebrow}>Preparación terminada</p><h3>Ahora entra a la Sesión 3 principal</h3><p>Volverás a registrar tu asistencia; esa ruta contiene la evidencia acreditable y tres opciones de dificultad.</p><a className={styles.primaryButton} href="/sesion-3#registro-principal">Abrir sesión principal</a></div> : null}
          </form>
        </section>
      </div>

      <SessionNavigation current={3} position="bottom" />
      <footer className={styles.footer}><div><strong>AULA-IA · Preparación S3</strong><p>Acompañamiento metodológico, sin funciones de pago obligatorias.</p></div><div><a href="/">Sesión 1</a><a href="/sesion-2">Sesión 2</a><a href="/sesion-3">Sesión 3 principal</a><a href="#contenido">Volver arriba</a></div></footer>
    </main>
  );
}
