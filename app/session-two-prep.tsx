"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./session-two.module.css";
import SessionNavigation from "./session-navigation";
import { courseSource, orderSteps, prepAgenda, sessionTwoTitle } from "./session-two-data";

type SaveState = { kind: "idle" | "loading" | "success" | "error"; message?: string; code?: string };

const PREP_DRAFT_KEY = "aula-ia-s2-prep-draft";
const IDENTITY_KEY = "aula-ia-s2-identity";

const sourceB = `TARJETA DE PRÁCTICA B · Texto simulado AULA-IA.

La retroalimentación es más útil cuando describe un aspecto observable del trabajo, reconoce qué se logró y propone un siguiente paso posible. Una valoración general como “muy bien” puede motivar, pero no informa por sí sola cómo mejorar. Esta tarjeta no ofrece porcentajes, resultados de investigación ni información sobre grupos reales.`;

const safeQuestions = [
  { text: "Antes de pegar un caso real, retiro nombres, correos y calificaciones.", answer: "segura" },
  { text: "Copio una contraseña en el chat para que la IA me ayude a entrar.", answer: "riesgosa" },
  { text: "Comparo la respuesta con el fragmento antes de usarla.", answer: "segura" },
  { text: "Si no encuentro un dato en la fuente, lo marco para verificar.", answer: "segura" },
] as const;

const orderedPractice = [
  { text: orderSteps[2], position: "3" },
  { text: orderSteps[0], position: "1" },
  { text: orderSteps[4], position: "5" },
  { text: orderSteps[1], position: "2" },
  { text: orderSteps[3], position: "4" },
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

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}

export function SessionTwoPrep() {
  const [registration, setRegistration] = useState({ fullName: "", email: "", institution: "", role: "Docente", consent: false });
  const [registrationState, setRegistrationState] = useState<SaveState>({ kind: "idle" });
  const [sourceChoice, setSourceChoice] = useState<"A" | "B">("A");
  const [context, setContext] = useState("");
  const [product, setProduct] = useState("Una actividad breve con instrucciones y cierre");
  const [result, setResult] = useState("");
  const [supported, setSupported] = useState("");
  const [review, setReview] = useState("");
  const [evidenceState, setEvidenceState] = useState<SaveState>({ kind: "idle" });
  const [orderAnswers, setOrderAnswers] = useState<string[]>(Array(orderSteps.length).fill(""));
  const [orderScore, setOrderScore] = useState<number | null>(null);
  const [safeAnswers, setSafeAnswers] = useState<string[]>(Array(safeQuestions.length).fill(""));
  const [safeScore, setSafeScore] = useState<number | null>(null);
  const [copied, setCopied] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const chosenSource = sourceChoice === "A" ? courseSource : sourceB;
  const totalMinutes = prepAgenda.reduce((sum, item) => sum + item.minutes, 0);
  const practicePrompt = useMemo(() => `Usa únicamente la FUENTE. Para una práctica docente inicial, crea ${product.toLowerCase()}. Contexto: ${context || "formación docente; práctica general sin datos personales"}. Marca como PROPUESTA cualquier ejemplo creado. Si falta información, escribe INFORMACIÓN INSUFICIENTE. No agregues datos personales.\n\nFUENTE\n${chosenSource}\nFIN DE LA FUENTE`, [chosenSource, context, product]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const identity = JSON.parse(localStorage.getItem(IDENTITY_KEY) || "{}") as Record<string, string>;
        const saved = JSON.parse(localStorage.getItem(PREP_DRAFT_KEY) || "{}") as Record<string, string>;
        setRegistration((current) => ({ ...current, fullName: identity.fullName || "", email: identity.email || "", institution: identity.institution || "", role: identity.role || "Docente" }));
        if (saved.sourceChoice === "A" || saved.sourceChoice === "B") setSourceChoice(saved.sourceChoice);
        setContext(saved.context || "");
        setProduct(saved.product || "Una actividad breve con instrucciones y cierre");
        setResult(saved.result || "");
        setSupported(saved.supported || "");
        setReview(saved.review || "");
      } catch {
        // El recorrido continúa aunque el navegador no pueda recuperar un borrador.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PREP_DRAFT_KEY, JSON.stringify({ sourceChoice, context, product, result, supported, review }));
  }, [context, hydrated, product, result, review, sourceChoice, supported]);

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationState({ kind: "loading", message: "Registrando tu entrada a la preparación…" });
    try {
      const response = await postSessionTwo({ action: "leveling_attendance", ...registration });
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(registration));
      setRegistrationState({ kind: "success", message: typeof response.message === "string" ? response.message : "Entrada registrada.", code: typeof response.confirmationCode === "string" ? response.confirmationCode : undefined });
    } catch (error) {
      setRegistrationState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible registrar la entrada." });
    }
  }

  async function handleEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvidenceState({ kind: "loading", message: "Registrando tu preparación…" });
    try {
      const response = await postSessionTwo({
        action: "leveling_activity",
        email: registration.email,
        activity: "evidencia-preparatoria",
        evidenceType: "practica-guiada",
        response: { sourceChoice, context, product, prompt: practicePrompt, result, supported, review, safeCheck: safeScore },
        result: "Recorrido básico con fuente, contexto, revisión y guardado completado",
        completed: true,
      });
      const syncNote = " Guardado en la hoja institucional.";
      setEvidenceState({ kind: "success", message: `${typeof response.message === "string" ? response.message : "Preparación registrada."} Este registro no acredita la sesión principal.${syncNote}`, code: typeof response.confirmationCode === "string" ? response.confirmationCode : undefined });
    } catch (error) {
      setEvidenceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible registrar. Tu borrador permanece en este dispositivo." });
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
    <main className={`${styles.shell} ${styles.prepShell}`}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="AULA-IA, volver a la Sesión 1"><span aria-hidden="true">AI</span><span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinares</small></span></a>
        <nav aria-label="Navegación de preparación"><a href="#agenda">Agenda</a><a href="#practica">Práctica</a><a href="#evidencia">Registro</a><a href="/sesion-2">Sesión principal</a></nav>
      </header>
      <SessionNavigation current={2} position="top" />

      <div id="contenido">
        <section className={`${styles.hero} ${styles.prepHero}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Sesión 2 · Preparación para principiantes</p>
            <h1>Fuente, contexto y pestañas: paso a paso</h1>
            <p className={styles.lede}>Practica cómo abrir, copiar, regresar, revisar y guardar antes de entrar a “{sessionTwoTitle}”.</p>
            <div className={styles.metrics}><span><strong>{totalMinutes}</strong> minutos exactos</span><span><strong>20</strong> minutos de práctica guiada</span><span><strong>0</strong> presión: reintenta</span></div>
            <div className={styles.heroActions}><a className={styles.primaryButton} href="#registro-prep">Comenzar preparación</a><a className={styles.secondaryButton} href="/sesion-2">Ya puedo ir a la principal</a></div>
          </div>
          <div className={styles.prepMap} aria-label="Recorrido de preparación"><span>1. Leer</span><span>2. Copiar</span><span>3. Abrir IA</span><span>4. Pegar</span><span>5. Regresar</span><span>6. Guardar</span></div>
        </section>

        <aside className={styles.nonAccreditable}><strong>Importante:</strong> esta hora registra tu avance, pero no cuenta para la acreditación. Al terminar, entra a la sesión principal y registra nuevamente tu asistencia.</aside>

        <section className={styles.section} id="registro-prep">
          <Heading eyebrow="Paso 1" title="Registra tu entrada a la preparación" description="Este registro se guarda separado de la asistencia oficial de la Sesión 2." />
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
          <Heading eyebrow="Una hora acompañada" title="60 minutos exactos" description="Cada bloque tiene una sola acción central y una alternativa si la herramienta externa no está disponible." />
          <ol className={styles.agenda}>{prepAgenda.map((item) => <li key={item.time} className={item.minutes >= 15 ? styles.agendaActive : ""}><span>{item.time} min</span><div><strong>{item.label}</strong><p>{item.detail}</p></div>{item.minutes >= 15 ? <em>Práctica</em> : null}</li>)}</ol>
        </section>

        <section className={styles.section}>
          <Heading eyebrow="Habilidad digital · 10 minutos" title="Abrir otra pestaña sin perder AULA-IA" description="AULA-IA permanece abierta. La herramienta de IA se abre aparte; después regresas a copiar el resultado." />
          <div className={styles.tabSimulation}>
            <div className={styles.fakeBrowser}><div><span className={styles.activeTab}>AULA-IA</span><span>Herramienta de IA</span><b>+</b></div><p>Estás aquí. Copia el prompt, abre la herramienta, pega, espera y regresa.</p></div>
            <div className={styles.deviceTips}><article><h3>Computadora</h3><p>Abre el enlace en otra pestaña. Para copiar usa Ctrl+C; para pegar, Ctrl+V.</p></article><article><h3>Celular o tableta</h3><p>Usa el selector de pestañas. Mantén presionado el texto para ver Copiar o Pegar.</p></article></div>
          </div>
          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 1 · Elige el siguiente paso</p><h3>Ordena el recorrido</h3><p>Asigna del 1 al 5. No necesitas arrastrar.</p></div>
            <div className={styles.quizList}>{orderedPractice.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={orderAnswers[index]} onChange={(event) => { const next = [...orderAnswers]; next[index] = event.target.value; setOrderAnswers(next); setOrderScore(null); }}><option value="">Posición</option>{orderSteps.map((_, optionIndex) => <option key={optionIndex} value={String(optionIndex + 1)}>{optionIndex + 1}</option>)}</select></label>)}</div>
            <button type="button" className={styles.secondaryButton} onClick={() => setOrderScore(orderAnswers.filter((answer, index) => answer === orderedPractice[index].position).length)}>Comprobar orden</button>
            {orderScore !== null ? <p className={styles.quizResult} role="status">{orderScore} de {orderSteps.length} pasos en su lugar. {orderScore === orderSteps.length ? "Recorrido completo." : "Corrige y vuelve a intentarlo."}</p> : null}
          </div>
        </section>

        <section className={styles.section} id="practica">
          <Heading eyebrow="Demostración · 15 minutos" title="Fuente + contexto + petición" description="Usaremos un fragmento breve. No subiremos ningún archivo ni datos personales." />
          <div className={styles.sourcePanel}><div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Tarjeta {sourceChoice}</p><h3>{sourceChoice === "A" ? "Jornada de lectura" : "Retroalimentación útil"}</h3></div><button type="button" onClick={() => handleCopy("fuente", chosenSource)}>{copied === "fuente" ? "Copiada" : "Copiar fuente"}</button></div><pre>{chosenSource}</pre></div>
          <div className={styles.promptPanel}><div className={styles.sourceHeader}><div><p className={styles.eyebrow}>Petición completa</p><h3>Lista para adaptar</h3></div><button type="button" onClick={() => handleCopy("prompt", practicePrompt)}>{copied === "prompt" ? "Copiada" : "Copiar petición"}</button></div><pre>{practicePrompt}</pre></div>
          <div className={styles.toolLinks}><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Abrir ChatGPT ↗</a><a href="https://gemini.google.com/" target="_blank" rel="noreferrer">Abrir Gemini ↗</a><a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer">Abrir NotebookLM ↗</a></div>
          <details className={styles.sampleAnswer}><summary>No tengo acceso a una IA: mostrar respuesta de práctica</summary><p>La fuente A permite recuperar el propósito, los cuatro momentos, el producto y los límites de privacidad. No permite saber qué texto elegirá cada docente. Una propuesta útil debe conservar esas diferencias y no inventar nombres, normas o resultados.</p></details>

          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 2 · Práctica guiada · 20 minutos</p><h3>Completa los tres bloques</h3><p>Elige una tarjeta, describe un contexto general y define qué producto necesitas.</p></div>
            <div className={styles.form}>
              <label>Fuente de práctica<select value={sourceChoice} onChange={(event) => setSourceChoice(event.target.value as "A" | "B")}><option value="A">A · Jornada de lectura</option><option value="B">B · Retroalimentación útil</option></select></label>
              <label>Contexto sin datos personales<textarea rows={3} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Ejemplo: primer semestre, trabajo individual, 15 minutos." /></label>
              <label>Producto solicitado<input value={product} onChange={(event) => setProduct(event.target.value)} /></label>
              <label>Resultado de la IA o respuesta de muestra<textarea rows={7} value={result} onChange={(event) => setResult(event.target.value)} placeholder="Regresa a AULA-IA y pega aquí el resultado." /></label>
              <label>Una parte apoyada por la fuente<textarea rows={3} value={supported} onChange={(event) => setSupported(event.target.value)} /></label>
              <label>Algo que debo revisar o verificar<textarea rows={3} value={review} onChange={(event) => setReview(event.target.value)} /></label>
            </div>
          </div>

          <div className={styles.interaction}>
            <div><p className={styles.eyebrow}>Interacción 3 · Decisión segura y útil · 5 minutos</p><h3>Identifica prácticas seguras</h3><p>Lee cada decisión y elige. Puedes reintentar.</p></div>
            <div className={styles.quizList}>{safeQuestions.map((item, index) => <label key={item.text}><span>{item.text}</span><select value={safeAnswers[index]} onChange={(event) => { const next = [...safeAnswers]; next[index] = event.target.value; setSafeAnswers(next); setSafeScore(null); }}><option value="">Elige</option><option value="segura">Segura y útil</option><option value="riesgosa">Riesgosa</option></select></label>)}</div>
            <button type="button" className={styles.secondaryButton} onClick={() => setSafeScore(safeQuestions.filter((item, index) => item.answer === safeAnswers[index]).length)}>Comprobar decisiones</button>
            {safeScore !== null ? <p className={styles.quizResult} role="status">{safeScore} de {safeQuestions.length} correctas. {safeScore === safeQuestions.length ? "Comprobación completada." : "Recuerda: nunca compartas contraseñas ni datos personales."}</p> : null}
          </div>
        </section>

        <section className={styles.section} id="evidencia">
          <Heading eyebrow="Evidencia de preparación · 5 minutos" title="Guarda tu primer recorrido" description="No acredita la Sesión 2. Sirve para registrar avance y detectar dónde necesitas apoyo." />
          <form className={`${styles.form} ${styles.evidenceForm}`} onSubmit={handleEvidence}>
            <div className={styles.summaryBox}><p><strong>Fuente:</strong> tarjeta {sourceChoice}</p><p><strong>Contexto:</strong> {context || "Pendiente"}</p><p><strong>Producto:</strong> {product || "Pendiente"}</p><p><strong>Revisión:</strong> {review || "Pendiente"}</p></div>
            <p className={styles.privacyNote}><strong>Comprueba:</strong> usaste el mismo correo del registro, pegaste un resultado o la respuesta de muestra y no incluiste datos personales.</p>
            <button className={styles.primaryButton} type="submit" disabled={evidenceState.kind === "loading"}>{evidenceState.kind === "loading" ? "Registrando preparación…" : "Guardar preparación"}</button>
            <StatusBanner state={evidenceState} />
            {evidenceState.kind === "success" ? <div className={styles.transitionCard}><p className={styles.eyebrow}>Preparación terminada</p><h3>Ahora entra a la Sesión 2 principal</h3><p>Allí volverás a registrar tu asistencia; esa ruta sí contiene la evidencia acreditable.</p><a className={styles.primaryButton} href="/sesion-2#registro-principal">Abrir sesión principal</a></div> : null}
          </form>
        </section>
      </div>

      <SessionNavigation current={2} position="bottom" />
      <footer className={styles.footer}><div><strong>AULA-IA · Preparación S2</strong><p>Acompañamiento básico, sin estigmas y sin funciones de pago obligatorias.</p></div><div><a href="/">Sesión 1</a><a href="/sesion-2">Sesión 2 principal</a><a href="#contenido">Volver arriba</a></div></footer>
    </main>
  );
}
