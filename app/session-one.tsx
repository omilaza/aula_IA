"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import EvidencePdfDownload from "./evidence-pdf-download";
import SessionNavigation from "./session-navigation";

type SaveState = { kind: "idle" | "loading" | "success" | "error"; message?: string; code?: string; pdfAccessCode?: string };
type ContextState = {
  topic: string;
  level: string;
  subject: string;
  group: string;
  purpose: string;
  time: string;
  resources: string;
  product: string;
  constraints: string;
  inclusion: string;
  verification: string;
  outputFormat: string;
};
type EvidenceIssue = { key: string; fieldId: string; label: string; message: string; severity: "critical" | "warning"; origin?: "configuration" };
type ExitDraft = { caseChosen: string; principalContext: string; risk: string; responseChangedBecause: string; preserve: string; correct: string; verify: string; confidence: number };

const S1_DRAFT_KEY = "aula-ia-s1-evidence-draft";
const S1_PROGRESS_KEY = "aula-ia-s1-progress";
const S1_EXIT_KEY = "aula-ia-s1-exit-draft";
const S1_IMPACT_KEY = "aula-ia-s1-configuration-impacts";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const agenda = [
  { time: "0–5", duration: 5, label: "Activación", detail: "Rompehielo y tablero en vivo", active: true },
  { time: "5–20", duration: 15, label: "Microteoría", detail: "IA generativa, límites, privacidad y contexto", active: false },
  { time: "20–40", duration: 20, label: "Demostración", detail: "Petición genérica vs. petición contextualizada", active: true },
  { time: "40–75", duration: 35, label: "Laboratorio", detail: "Construir, probar, leer críticamente y ajustar", active: true },
  { time: "75–85", duration: 10, label: "Revisión", detail: "Lista de cotejo y muestras comentadas", active: true },
  { time: "85–90", duration: 5, label: "Cierre", detail: "Evidencia de salida y transferencia", active: true },
];

const categoryLabels: Record<string, string> = {
  planeacion: "Planeación",
  adaptacion: "Adaptación",
  evaluacion: "Evaluación",
  retroalimentacion: "Retroalimentación",
  administracion: "Gestión",
  otra: "Otra",
};

const likertItems = [
  ["D1", "Puedo explicar en términos sencillos qué hace y qué no hace una IA generativa."],
  ["D2", "Puedo identificar cuándo una respuesta de IA necesita verificación."],
  ["D3", "Puedo reconocer datos personales o sensibles que no debo compartir con una IA."],
  ["D4", "Puedo convertir una petición genérica en una instrucción contextualizada."],
  ["D5", "Puedo comparar dos respuestas de IA con criterios pedagógicos."],
  ["D6", "Puedo decidir cuándo conviene no usar IA en una tarea docente."],
] as const;

const knowledgeItems = [
  {
    id: "D7",
    question: "Una docente quiere adaptar una actividad con IA. ¿Cuál es la entrada más segura?",
    options: [
      ["A", "La lista del grupo con calificaciones."],
      ["B", "Una descripción anonimizada del grupo, sin nombres ni identificadores."],
      ["C", "Capturas de expedientes para que la IA conozca todos los detalles."],
      ["D", "Correos personales para recibir una adaptación individual."],
    ],
  },
  {
    id: "D8",
    question: "¿Cuál instrucción está mejor contextualizada?",
    options: [
      ["A", "Haz una clase interesante sobre porcentajes."],
      ["B", "Explícame los porcentajes de forma fácil."],
      ["C", "Diseña una actividad de 20 minutos para segundo semestre, con 42 estudiantes, datos proporcionados, equipos de seis, evidencia individual y sin inventar causas."],
      ["D", "Dame muchas ideas creativas de matemáticas."],
    ],
  },
  {
    id: "D9",
    question: "La IA presenta una estadística muy convincente, pero no indica fuente. ¿Qué corresponde hacer?",
    options: [
      ["A", "Usarla porque la redacción es segura."],
      ["B", "Verificar la cifra y la fuente antes de usarla."],
      ["C", "Pedir que la repita con tono académico."],
      ["D", "Traducirla para comprobar si cambia."],
    ],
  },
  {
    id: "D10",
    question: "La IA cita una referencia curricular que no aparece en el documento oficial. ¿Cuál es la mejor decisión?",
    options: [
      ["A", "Consultar la fuente oficial y corregir o descartar la referencia."],
      ["B", "Mantenerla si coincide con el tema."],
      ["C", "Pedir a la IA que agregue más referencias parecidas."],
      ["D", "Omitir el título y conservar el contenido."],
    ],
  },
  {
    id: "D11",
    question: "¿Cuál es la función principal del contexto en una instrucción?",
    options: [
      ["A", "Garantizar que toda afirmación sea verdadera."],
      ["B", "Hacer que la respuesta sea siempre más larga."],
      ["C", "Reducir supuestos y mejorar la pertinencia, sin sustituir la verificación."],
      ["D", "Evitar que la persona docente revise el resultado."],
    ],
  },
  {
    id: "D12",
    question: "¿Cuál es el orden del modelo AULA-IA?",
    options: [
      ["A", "Ajustar, Usar, Leer, Analizar."],
      ["B", "Usar, Analizar, Ajustar, Leer."],
      ["C", "Leer, Usar, Aplicar, Archivar."],
      ["D", "Analizar, Usar IA con propósito, Leer críticamente, Ajustar y aplicar."],
    ],
  },
] as const;

const cases: Record<string, { tag: string; title: string; description: string; context: ContextState }> = {
  primaria: {
    tag: "Caso A · básico",
    title: "Cada gota tiene una razón",
    description: "5.º de primaria · 32 estudiantes · 15 minutos · un proyector",
    context: {
      topic: "uso responsable del agua en la vida cotidiana",
      level: "5.º de primaria",
      subject: "Ciencias",
      group: "32 estudiantes; sin datos identificables",
      purpose: "distinguir acciones que reducen el desperdicio de agua y justificar una decisión",
      time: "15 minutos",
      resources: "un proyector; sin dispositivos individuales",
      product: "actividad breve en tabla y boleto de salida individual",
      constraints: "no inventar cifras de consumo, normas, materiales ni videos inexistentes",
      inclusion: "un estudiante con baja visión; describir imágenes, usar alto contraste y leer opciones en voz alta",
      verification: "indicar si una fuente es indispensable y dejar la verificación final a la docente",
      outputFormat: "tabla con minuto, acción, pregunta docente y evidencia observable; terminar con boleto individual",
    },
  },
  bachillerato: {
    tag: "Caso B · intermedio",
    title: "Los datos también deciden",
    description: "2.º semestre de EMS · 42 estudiantes · equipos de seis · 20 minutos",
    context: {
      topic: "consumo semanal de agua: 11 200, 10 600, 9 800 y 9 500 litros",
      level: "2.º semestre de educación media superior",
      subject: "Matemáticas",
      group: "42 estudiantes organizados en equipos de seis",
      purpose: "calcular la disminución absoluta y porcentual entre las semanas 1 y 4 y formular una recomendación respaldada por los datos",
      time: "20 minutos",
      resources: "proyector y teléfonos compartidos; datos proporcionados en la consigna",
      product: "procedimiento por equipos, dos errores previsibles y evidencia individual",
      constraints: "usar únicamente los datos proporcionados; no inventar causas del cambio ni confundir porcentaje con puntos porcentuales",
      inclusion: "equipos de seis con evidencia individual para comprobar la comprensión de cada participante",
      verification: "mostrar 1 700 litros de disminución y 15.18 %, aproximadamente 15.2 %; separar resultado de causa posible",
      outputFormat: "instrucciones, procedimiento esperado, dos errores previsibles y boleto de salida individual",
    },
  },
  superior: {
    tag: "Caso C · avanzado",
    title: "De los datos a una recomendación prudente",
    description: "1.er semestre de Ingeniería Ambiental · 30 estudiantes · tres sitios",
    context: {
      topic: "Sitio A: pH 7.1, turbidez 1.2, cloro 0.30; B: 6.4, 6.8, 0.05; C: 7.8, 2.4, 0.20",
      level: "1.er semestre de Ingeniería Ambiental",
      subject: "Introducción al análisis de datos ambientales",
      group: "30 estudiantes",
      purpose: "distinguir datos, interpretación e incertidumbre",
      time: "por definir por la persona docente",
      resources: "conjunto de datos y criterios didácticos: pH 6.5–8.5, turbidez ≤ 5 y cloro 0.20–0.50",
      product: "tabla de hallazgos y plan preliminar de verificación",
      constraints: "no declarar potabilidad, no citar normas externas y no recomendar una intervención definitiva",
      inclusion: "tabla legible que separe dato observado, comparación, inferencia, incertidumbre y verificación",
      verification: "A y C cumplen los criterios proporcionados; B queda fuera en los tres indicadores; revisar muestreo y calibración y repetir la medición",
      outputFormat: "tabla con dato observado, comparación con criterio, inferencia permitida, incertidumbre y acción de verificación",
    },
  },
};

const checklistItems = [
  "La necesidad docente está formulada con claridad.",
  "Se indican nivel, asignatura o campo formativo.",
  "Se describen destinatarios sin datos identificables.",
  "Se precisan tiempo y recursos disponibles.",
  "Se pide un producto y un formato concretos.",
  "Se incluyen restricciones o necesidades de inclusión.",
  "Se protegen datos personales y sensibles.",
  "Se establecen fuentes, límites o asuntos por verificar.",
  "Se revisan aplicabilidad, exactitud y posibles sesgos.",
  "El prompt se ajusta después de leer la respuesta.",
];

async function send(payload: Record<string, unknown>) {
  const response = await fetch("/api/session-one", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(result.error || "No fue posible guardar."));
  return result;
}

function SaveNotice({ state }: { state: SaveState }) {
  if (state.kind === "idle") return null;
  return (
    <div className={`save-notice ${state.kind}`} role="status" aria-live="polite">
      <strong>{state.kind === "loading" ? "Guardando…" : state.kind === "success" ? "Listo" : "Revisa"}</strong>
      {state.message ? <span>{state.message}</span> : null}
      {state.code ? <code>{state.code}</code> : null}
    </div>
  );
}

function Field({ label, hint, children, issue, fieldId }: { label: string; hint?: string; children: ReactNode; issue?: EvidenceIssue; fieldId?: string }) {
  return (
    <label id={fieldId} tabIndex={issue ? -1 : undefined} className={`field ${issue ? issue.severity === "critical" ? "validation-field-error" : "validation-field-warning" : ""}`}>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
      {children}
      {issue ? <small className="validation-message">{issue.message}</small> : null}
    </label>
  );
}

export function SessionOne() {
  const [participantEmail, setParticipantEmail] = useState("");
  const [registeredAttendanceEmail, setRegisteredAttendanceEmail] = useState("");
  const [attendanceState, setAttendanceState] = useState<SaveState>({ kind: "idle" });
  const [iceState, setIceState] = useState<SaveState>({ kind: "idle" });
  const [diagnosticState, setDiagnosticState] = useState<SaveState>({ kind: "idle" });
  const [labState, setLabState] = useState<SaveState>({ kind: "idle" });
  const [exitState, setExitState] = useState<SaveState>({ kind: "idle" });
  const [iceCounts, setIceCounts] = useState<Record<string, number>>({});
  const [iceTotal, setIceTotal] = useState(0);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<string, string>>({});
  const [route, setRoute] = useState("basica");
  const [caseKey, setCaseKey] = useState("propio");
  const [context, setContext] = useState<ContextState>({
    topic: "",
    level: "",
    subject: "",
    group: "",
    purpose: "",
    time: "",
    resources: "",
    product: "",
    constraints: "",
    inclusion: "",
    verification: "",
    outputFormat: "",
  });
  const [promptV1, setPromptV1] = useState("");
  const [promptV2, setPromptV2] = useState("");
  const [responseV1, setResponseV1] = useState("");
  const [responseV2, setResponseV2] = useState("");
  const [review, setReview] = useState("");
  const [checklist, setChecklist] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const [labProgressState, setLabProgressState] = useState<SaveState>({ kind: "idle" });
  const [exitProgressState, setExitProgressState] = useState<SaveState>({ kind: "idle" });
  const [labValidationIssues, setLabValidationIssues] = useState<EvidenceIssue[]>([]);
  const [exitValidationIssues, setExitValidationIssues] = useState<EvidenceIssue[]>([]);
  const [configurationImpacts, setConfigurationImpacts] = useState<EvidenceIssue[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [exitDraft, setExitDraft] = useState<ExitDraft>({ caseChosen: "propio", principalContext: "", risk: "", responseChangedBecause: "", preserve: "", correct: "", verify: "", confidence: 0 });

  const activeMinutes = agenda.filter((item) => item.active).reduce((sum, item) => sum + item.duration, 0);
  const maxCount = Math.max(1, ...Object.values(iceCounts));
  const diagnosticComplete = Object.keys(diagnosticAnswers).length;

  const labCompletion = useMemo(() => {
    const fields = Object.values(context).filter((value) => value.trim()).length;
    return Math.min(100, Math.round(((fields + (promptV2 ? 2 : 0) + (review ? 2 : 0) + Math.min(Object.keys(checklist).length, 10)) / 26) * 100));
  }, [context, promptV2, review, checklist]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(S1_DRAFT_KEY) || "{}") as Record<string, unknown>;
        const savedExit = JSON.parse(localStorage.getItem(S1_EXIT_KEY) || "{}") as Partial<ExitDraft>;
        const savedProgress = JSON.parse(localStorage.getItem(S1_PROGRESS_KEY) || "{}") as { savedAt?: string };
        const savedImpacts = JSON.parse(localStorage.getItem(S1_IMPACT_KEY) || "[]") as EvidenceIssue[];
        if (typeof saved.participantEmail === "string") setParticipantEmail(saved.participantEmail);
        if (typeof saved.route === "string") setRoute(saved.route);
        if (typeof saved.caseKey === "string") setCaseKey(saved.caseKey);
        if (saved.context && typeof saved.context === "object") setContext((current) => ({ ...current, ...(saved.context as Partial<ContextState>) }));
        if (typeof saved.promptV1 === "string") setPromptV1(saved.promptV1);
        if (typeof saved.promptV2 === "string") setPromptV2(saved.promptV2);
        if (typeof saved.responseV1 === "string") setResponseV1(saved.responseV1);
        if (typeof saved.responseV2 === "string") setResponseV2(saved.responseV2);
        if (typeof saved.review === "string") setReview(saved.review);
        if (saved.checklist && typeof saved.checklist === "object") setChecklist(saved.checklist as Record<string, string>);
        setExitDraft((current) => ({ ...current, ...savedExit }));
        if (Array.isArray(savedImpacts)) { setConfigurationImpacts(savedImpacts); setLabValidationIssues(savedImpacts); }
        if (savedProgress.savedAt) setLabProgressState({ kind: "success", message: `Avance local recuperado (${savedProgress.savedAt}). Aún falta la evidencia de salida para acreditar.` });
      } catch {
        // Un borrador local dañado no impide realizar la sesión.
      } finally { setHydrated(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(S1_DRAFT_KEY, JSON.stringify({ participantEmail, route, caseKey, context, promptV1, promptV2, responseV1, responseV2, review, checklist }));
  }, [participantEmail, route, caseKey, context, promptV1, promptV2, responseV1, responseV2, review, checklist, hydrated]);

  useEffect(() => { if (hydrated) localStorage.setItem(S1_EXIT_KEY, JSON.stringify(exitDraft)); }, [exitDraft, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(S1_IMPACT_KEY, JSON.stringify(configurationImpacts)); }, [configurationImpacts, hydrated]);

  function focusIssue(issue: EvidenceIssue) { window.requestAnimationFrame(() => { const element = document.getElementById(issue.fieldId); element?.scrollIntoView({ behavior: "smooth", block: "center" }); element?.focus({ preventScroll: true }); }); }
  function labIssue(key: string) { return labValidationIssues.find((issue) => issue.key === key); }
  function exitIssue(key: string) { return exitValidationIssues.find((issue) => issue.key === key); }
  function clearLabIssue(key: string) { setLabValidationIssues((current) => current.filter((issue) => issue.key !== key)); setConfigurationImpacts((current) => current.filter((issue) => issue.key !== key)); setLabProgressState({ kind: "idle" }); }
  function updateChecklistValue(item: string, value: string) {
    const next = { ...checklist, [item]: value };
    const unvalued = checklistItems.filter((checklistItem) => !next[checklistItem]);
    const yesCount = Object.values(next).filter((checklistValue) => checklistValue === "si").length;
    setChecklist(next);
    setLabValidationIssues((current) => {
      const remaining = current.filter((issue) => issue.key !== "checklist");
      if (!unvalued.length && yesCount >= 6) return remaining;
      return [...remaining, {
        key: "checklist",
        fieldId: "s1-checklist",
        label: "Diez indicadores y seis respuestas Sí",
        severity: "critical",
        message: `${unvalued.length ? `Faltan valorar ${unvalued.length}: ${unvalued.join(" · ")}. ` : ""}Se requieren al menos 6 respuestas Sí; actualmente hay ${yesCount}.`,
      }];
    });
    setLabProgressState({ kind: "idle" });
  }
  function updateContext(key: keyof ContextState, value: string) { setContext((current) => ({ ...current, [key]: value })); clearLabIssue(`context.${key}`); }

  function persistLabProgress(message = "Tu avance quedó guardado en este dispositivo. No genera comprobante final ni acredita la sesión hasta completar el laboratorio y la evidencia de salida.") {
    const savedAt = new Date().toLocaleString("es-MX");
    try {
      localStorage.setItem(S1_DRAFT_KEY, JSON.stringify({ participantEmail, route, caseKey, context, promptV1, promptV2, responseV1, responseV2, review, checklist }));
      localStorage.setItem(S1_PROGRESS_KEY, JSON.stringify({ savedAt, email: participantEmail.trim().toLowerCase(), status: "avance-local" }));
      setLabProgressState({ kind: "success", message });
    } catch { setLabProgressState({ kind: "error", message: "No fue posible confirmar el guardado local. Mantén esta página abierta." }); }
  }

  function collectLabIssues() {
    const issues: EvidenceIssue[] = [];
    const add = (key: string, fieldId: string, label: string, value: string, minimum: number) => { const length = value.trim().length; if (length < minimum) issues.push({ key, fieldId, label, severity: "critical", message: `${label}: escribe al menos ${minimum} caracteres; actualmente hay ${length}.` }); };
    const email = participantEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) issues.push({ key: "email", fieldId: "s1-lab-email", label: "Correo para vincular la evidencia", severity: "critical", message: "Escribe un correo válido." });
    else if (registeredAttendanceEmail && email !== registeredAttendanceEmail) issues.push({ key: "email", fieldId: "s1-lab-email", label: "Correo para vincular la evidencia", severity: "critical", message: "Debe coincidir con la asistencia registrada." });
    const contextLabels: Record<keyof ContextState, string> = { topic: "Tema o necesidad", level: "Nivel y grado/semestre", subject: "Asignatura o campo", group: "Características relevantes del grupo", purpose: "Propósito de aprendizaje", time: "Tiempo disponible", resources: "Recursos disponibles", product: "Producto o evidencia", constraints: "Restricciones y privacidad", inclusion: "Inclusión y accesibilidad", verification: "Qué deberá verificarse", outputFormat: "Formato de salida esperado" };
    for (const [key, label] of Object.entries(contextLabels) as Array<[keyof ContextState, string]>) add(`context.${key}`, `s1-context-${key}`, label, context[key], 3);
    add("promptV1", "s1-prompt-v1", "Petición V1", promptV1, 5);
    add("promptV2", "s1-prompt-v2", "Petición V2 contextualizada", promptV2, 30);
    add("review", "s1-review", "Comparación crítica", review, 20);
    const unvalued = checklistItems.filter((item) => !checklist[item]);
    const yesCount = Object.values(checklist).filter((value) => value === "si").length;
    if (unvalued.length || yesCount < 6) issues.push({ key: "checklist", fieldId: "s1-checklist", label: "Diez indicadores y seis respuestas Sí", severity: "critical", message: `${unvalued.length ? `Faltan valorar ${unvalued.length}: ${unvalued.join(" · ")}. ` : ""}Se requieren al menos 6 respuestas Sí; actualmente hay ${yesCount}.` });
    for (const impact of configurationImpacts) if (!issues.some((issue) => issue.key === impact.key)) issues.push(impact);
    return issues;
  }

  function updateExit(key: keyof ExitDraft, value: string | number) { setExitDraft((current) => ({ ...current, [key]: value })); setExitValidationIssues((current) => current.filter((issue) => issue.key !== key)); setExitProgressState({ kind: "idle" }); }
  function collectExitIssues() {
    const issues: EvidenceIssue[] = [];
    const add = (key: keyof ExitDraft, fieldId: string, label: string, minimum: number) => { const length = String(exitDraft[key] || "").trim().length; if (length < minimum) issues.push({ key, fieldId, label, severity: "critical", message: `${label}: completa al menos ${minimum} caracteres.` }); };
    add("caseChosen", "s1-exit-case", "Caso elegido", 1); add("principalContext", "s1-exit-context", "Principal contexto agregado", 5); add("risk", "s1-exit-risk", "Riesgo o supuesto detectado", 5); add("responseChangedBecause", "s1-exit-change", "La respuesta cambió porque", 5); add("preserve", "s1-exit-preserve", "Conservaría", 3); add("correct", "s1-exit-correct", "Corregiría", 3); add("verify", "s1-exit-verify", "Verificaría", 3);
    if (!Number.isInteger(exitDraft.confidence) || exitDraft.confidence < 1 || exitDraft.confidence > 5) issues.push({ key: "confidence", fieldId: "s1-exit-confidence", label: "Confianza", severity: "critical", message: "Selecciona un valor de 1 a 5." });
    const email = participantEmail.trim().toLowerCase(); if (!EMAIL_PATTERN.test(email)) issues.push({ key: "email", fieldId: "s1-exit-email", label: "Correo de registro", severity: "critical", message: "Escribe un correo válido." }); else if (registeredAttendanceEmail && email !== registeredAttendanceEmail) issues.push({ key: "email", fieldId: "s1-exit-email", label: "Correo de registro", severity: "critical", message: "Debe coincidir con la asistencia registrada." });
    return issues;
  }

  async function refreshIcebreaker() {
    try {
      const response = await fetch("/api/session-one?view=icebreaker", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { total: number; counts: Record<string, number> };
      setIceTotal(data.total || 0);
      setIceCounts(data.counts || {});
    } catch {
      // The activity remains usable if the aggregate is briefly unavailable.
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session-one?view=icebreaker", { cache: "no-store", signal: controller.signal })
      .then(async (response): Promise<{ total: number; counts: Record<string, number> } | null> => {
        if (!response.ok) return null;
        return (await response.json()) as { total: number; counts: Record<string, number> };
      })
      .then((data) => {
        if (!data) return;
        setIceTotal(data.total || 0);
        setIceCounts(data.counts || {});
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function submitAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim().toLowerCase();
    setParticipantEmail(email);
    setAttendanceState({ kind: "loading" });
    try {
      const result = await send({
        action: "attendance",
        email,
        fullName: data.get("fullName"),
        institution: data.get("institution"),
        role: data.get("role"),
        consent: data.get("consent") === "yes",
      });
      setAttendanceState({ kind: "success", message: "Tu asistencia a la Sesión 1 quedó registrada.", code: String(result.confirmationCode) });
      setRegisteredAttendanceEmail(email);
    } catch (error) {
      setAttendanceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar." });
    }
  }

  async function submitIcebreaker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIceState({ kind: "loading" });
    try {
      await send({ action: "icebreaker", category: data.get("category"), task: data.get("task") });
      form.reset();
      setIceState({ kind: "success", message: "Tu respuesta se sumó al tablero sin mostrar tu identidad." });
      await refreshIcebreaker();
    } catch (error) {
      setIceState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar." });
    }
  }

  async function submitDiagnostic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDiagnosticState({ kind: "loading" });
    try {
      const result = await send({ action: "diagnostic", phase: "pre", email: participantEmail, answers: diagnosticAnswers });
      setDiagnosticState({
        kind: "success",
        message: `Diagnóstico inicial enviado: ${String(result.knowledgeScore)}/6 en situaciones de decisión. No es una calificación.`,
        code: String(result.confirmationCode),
      });
    } catch (error) {
      setDiagnosticState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar." });
    }
  }

  function loadCase(key: string) {
    if (key === caseKey) return;
    if (Object.values(checklist).some(Boolean) && !window.confirm("Cambiar de caso sustituirá la ficha de contexto. Tus prompts y comparaciones se conservarán para revisión, pero los diez indicadores se reiniciarán. ¿Deseas continuar?")) return;
    const impacts: EvidenceIssue[] = [
      { key: "promptV2", fieldId: "s1-prompt-v2", label: "Petición V2 contextualizada", severity: "critical", origin: "configuration", message: "El prompt se conservó; revísalo con el nuevo caso." },
      { key: "review", fieldId: "s1-review", label: "Comparación crítica", severity: "critical", origin: "configuration", message: "La comparación se conservó; confirma que corresponda al nuevo caso." },
    ];
    setCaseKey(key);
    setContext(cases[key].context);
    setRoute(key === "primaria" ? "basica" : key === "bachillerato" ? "intermedia" : "avanzada");
    setChecklist({});
    setConfigurationImpacts(impacts);
    setLabValidationIssues([...impacts, { key: "checklist", fieldId: "s1-checklist", label: "Diez indicadores y seis respuestas Sí", severity: "critical", message: "Valora de nuevo los diez indicadores para el caso elegido." }]);
    setLabState({ kind: "idle" });
    document.getElementById("constructor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changeRoute(nextRoute: string) {
    if (nextRoute === route) return;
    if (Object.values(checklist).some(Boolean) && !window.confirm("Cambiar de ruta conservará tus textos, pero reiniciará los indicadores porque el prompt debe revisarse con los requisitos de la nueva ruta. ¿Deseas continuar?")) return;
    const impacts: EvidenceIssue[] = [
      { key: "promptV2", fieldId: "s1-prompt-v2", label: "Petición V2 contextualizada", severity: "critical", origin: "configuration", message: "La ruta cambió: revisa o reconstruye el prompt V2." },
      { key: "review", fieldId: "s1-review", label: "Comparación crítica", severity: "critical", origin: "configuration", message: "La comparación se conservó; confirma que responda a la nueva ruta." },
    ];
    setRoute(nextRoute);
    setChecklist({});
    setConfigurationImpacts(impacts);
    setLabValidationIssues([...impacts, { key: "checklist", fieldId: "s1-checklist", label: "Diez indicadores y seis respuestas Sí", severity: "critical", message: "Valora de nuevo los diez indicadores para la nueva ruta." }]);
    setLabState({ kind: "idle" });
  }

  function buildPrompts() {
    const topic = context.topic.trim() || "el tema indicado";
    setPromptV1(`Diseña una actividad sobre ${topic}.`);
    const advanced = route === "avanzada"
      ? "\nAntes de responder, formula hasta tres preguntas aclaratorias si falta información. Declara supuestos, riesgos de uso y una alternativa equivalente sin IA."
      : route === "intermedia"
        ? "\nSi falta una condición esencial, indícala antes de proponer. Incluye una breve justificación de las decisiones didácticas."
        : "";
    setPromptV2(`Actúa como apoyo para el diseño didáctico; la decisión final corresponde al docente.\n\nCONTEXTO\n- Nivel: ${context.level}\n- Asignatura o campo: ${context.subject}\n- Grupo: ${context.group}\n- Tema: ${topic}\n- Propósito de aprendizaje: ${context.purpose}\n- Tiempo: ${context.time}\n- Recursos disponibles: ${context.resources}\n- Producto o evidencia: ${context.product}\n- Restricciones y privacidad: ${context.constraints}\n- Inclusión y accesibilidad: ${context.inclusion}\n\nTAREA\nDiseña una actividad viable para este contexto. Usa únicamente la información proporcionada; no inventes referencias curriculares, cifras ni fuentes.\n\nFORMATO DE SALIDA\n${context.outputFormat}\n\nCONTROL DE CALIDAD\n${context.verification || "Señala qué datos o afirmaciones deben verificarse antes de usar la propuesta."}${advanced}`);
    clearLabIssue("promptV1");
    clearLabIssue("promptV2");
  }

  async function copyPrompt(value: string, label: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1800);
  }

  async function submitLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    persistLabProgress("La información quedó conservada como avance local mientras se valida el laboratorio.");
    const issues = collectLabIssues();
    setLabValidationIssues(issues);
    if (issues.length) {
      setLabState({ kind: "error", message: `No se puede completar el laboratorio todavía: hay ${issues.length} requisitos críticos enumerados y resaltados.` });
      focusIssue(issues[0]);
      return;
    }
    setLabState({ kind: "loading" });
    try {
      const result = await send({
        action: "lab",
        email: participantEmail,
        route,
        caseKey,
        context,
        promptV1,
        promptV2,
        responseV1,
        responseV2,
        review,
        checklist,
      });
      setLabState({ kind: "success", message: "Tu laboratorio quedó guardado. Este código confirma el paso intermedio; completa la evidencia de salida para obtener la acreditación y el PDF.", code: String(result.evidenceCode) });
      setConfigurationImpacts([]);
      setLabValidationIssues([]);
    } catch (error) {
      setLabState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar." });
    }
  }

  async function submitExit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      localStorage.setItem(S1_EXIT_KEY, JSON.stringify(exitDraft));
      setExitProgressState({ kind: "success", message: "Avance de salida guardado en este dispositivo. Todavía no acredita." });
    } catch {
      setExitProgressState({ kind: "error", message: "No fue posible confirmar el guardado local; mantén la página abierta." });
    }
    const issues = collectExitIssues();
    setExitValidationIssues(issues);
    if (issues.length) {
      setExitState({ kind: "error", message: `No se puede acreditar todavía: hay ${issues.length} requisitos críticos enumerados y resaltados.` });
      focusIssue(issues[0]);
      return;
    }
    setExitState({ kind: "loading" });
    try {
      const result = await send({
        action: "exit",
        email: participantEmail,
        ...exitDraft,
      });
      setExitState({
        kind: "success",
        message: `Evidencia enviada y vinculada con el laboratorio ${String(result.linkedLabEvidenceCode)}.`,
        code: String(result.evidenceCode),
        pdfAccessCode: typeof result.pdfAccessCode === "string" ? result.pdfAccessCode : undefined,
      });
      setExitValidationIssues([]);
    } catch (error) {
      setExitState({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar." });
    }
  }

  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Inicio de la Sesión 1">
          <span className="brand-mark" aria-hidden="true">A1</span>
          <span><strong>AULA-IA</strong><small>Red de Docentes Transdisciplinar</small></span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#agenda">Agenda</a>
          <a href="#laboratorio">Laboratorio</a>
          <a href="#salida">Evidencia</a>
        </nav>
        <span className="session-badge">Sesión 1 de 6</span>
      </header>
      <SessionNavigation current={1} position="top" />

      <main id="contenido">
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <p className="eyebrow">Curso introductorio para docentes · 90 minutos</p>
            <h1>De la pregunta rápida al <em>trabajo con contexto</em></h1>
            <p className="hero-lead">Aprende a transformar una petición genérica en una instrucción pedagógica situada, probarla con criterio y conservar una evidencia útil para tu práctica.</p>
            <div className="hero-actions">
              <a className="button primary" href="#entrada">Registrar entrada</a>
              <a className="button secondary" href="#laboratorio">Ir al laboratorio</a>
            </div>
            <div className="hero-proof" aria-label="Datos de la sesión">
              <span><strong>90</strong> min exactos</span>
              <span><strong>{activeMinutes}</strong> min de aplicación</span>
              <span><strong>3</strong> rutas de práctica</span>
            </div>
          </div>
          <aside className="hero-card" aria-label="Idea clave de la sesión">
            <span className="card-kicker">Idea para debatir</span>
            <blockquote>“Una respuesta convincente no siempre es una respuesta correcta.”</blockquote>
            <p>Pregunta guía: ¿qué debe aportar el juicio docente que una respuesta fluida no puede garantizar?</p>
            <div className="aula-strip" aria-label="Ciclo AULA-IA">
              <span><b>A</b>nalizar</span><span><b>U</b>sar</span><span><b>L</b>eer</span><span><b>A</b>justar</span>
            </div>
          </aside>
        </section>

        <section className="session-rail" aria-label="Mapa del curso">
          <span className="active">01 · Contexto</span>
          <a href="/sesion-2">02 · Fuentes</a>
          <a href="/sesion-3">03 · Secuencias</a>
          <a href="/sesion-4">04 · Evaluación</a>
          <a href="/sesion-5">05 · Instrumentos</a>
          <span aria-disabled="true">06 · Cierre · Próximamente</span>
        </section>

        <section className="section" id="agenda">
          <div className="section-heading split">
            <div><p className="eyebrow">Ruta de trabajo</p><h2>Los 90 minutos, sin tiempo oculto</h2></div>
            <div className="metric"><strong>75 min</strong><span>demostración, práctica, producción, revisión o aplicación</span></div>
          </div>
          <div className="timeline">
            {agenda.map((item) => (
              <article key={item.time} className={item.active ? "active-work" : "theory"}>
                <span className="time">{item.time}</span>
                <div><strong>{item.label}</strong><p>{item.detail}</p></div>
                <small>{item.duration} min</small>
              </article>
            ))}
          </div>
        </section>

        <section className="section entry-section" id="entrada">
          <div className="section-heading">
            <p className="eyebrow">Antes de iniciar</p><h2>Entrada: asistencia y diagnóstico</h2>
            <p>Estos dos registros se realizan una sola vez. El diagnóstico mide el punto de partida; no califica ni condiciona la acreditación.</p>
          </div>
          <div className="two-column">
            <form className="panel form-panel" onSubmit={submitAttendance}>
              <div className="panel-number">01</div><h3>Lista de asistencia original</h3>
              <Field label="Nombre completo"><input name="fullName" autoComplete="name" required /></Field>
              <Field label="Correo" hint="Usa el mismo en diagnóstico, laboratorio y salida."><input name="email" type="email" autoComplete="email" value={participantEmail} onChange={(event) => setParticipantEmail(event.target.value)} required /></Field>
              <Field label="Institución"><input name="institution" autoComplete="organization" required /></Field>
              <Field label="Función docente"><select name="role" defaultValue="" required><option value="" disabled>Selecciona</option><option>Docente frente a grupo</option><option>Coordinación o dirección</option><option>Orientación o apoyo</option><option>Formación docente</option><option>Otra función educativa</option></select></Field>
              <label className="check-line"><input name="consent" type="checkbox" value="yes" required /><span>Acepto el tratamiento mínimo de estos datos para asistencia, seguimiento y acreditación del curso.</span></label>
              <button className="button primary full" type="submit" disabled={attendanceState.kind === "loading"}>Registrar asistencia</button>
              <SaveNotice state={attendanceState} />
            </form>

            <form className="panel form-panel diagnostic" onSubmit={submitDiagnostic}>
              <div className="panel-number">02</div><h3>Diagnóstico inicial · 12 reactivos</h3>
              <div className="progress-label"><span>Respondidos</span><strong>{diagnosticComplete}/12</strong></div>
              <div className="progress-track" aria-hidden="true"><span style={{ width: `${(diagnosticComplete / 12) * 100}%` }} /></div>
              <Field label="Correo de registro"><input type="email" value={participantEmail} onChange={(event) => setParticipantEmail(event.target.value)} required /></Field>
              <details>
                <summary>D1–D6 · Autopercepción (escala 1–5)</summary>
                <p className="scale-help">1 = todavía no · 2 = con mucha ayuda · 3 = con alguna ayuda · 4 = de forma autónoma · 5 = puedo explicarlo o apoyar a otra persona</p>
                {likertItems.map(([id, text]) => (
                  <fieldset className="question" key={id}>
                    <legend><b>{id}</b> {text}</legend>
                    <div className="likert" aria-label={`Escala para ${id}`}>
                      {[1, 2, 3, 4, 5].map((value) => <label key={value}><input type="radio" name={id} value={value} checked={diagnosticAnswers[id] === String(value)} onChange={() => setDiagnosticAnswers((current) => ({ ...current, [id]: String(value) }))} /><span>{value}</span></label>)}
                    </div>
                  </fieldset>
                ))}
              </details>
              <details>
                <summary>D7–D12 · Situaciones de decisión</summary>
                {knowledgeItems.map((item) => (
                  <fieldset className="question options" key={item.id}>
                    <legend><b>{item.id}</b> {item.question}</legend>
                    {item.options.map(([value, text]) => <label key={value}><input type="radio" name={item.id} value={value} checked={diagnosticAnswers[item.id] === value} onChange={() => setDiagnosticAnswers((current) => ({ ...current, [item.id]: value }))} /><span><b>{value}.</b> {text}</span></label>)}
                  </fieldset>
                ))}
              </details>
              <button className="button primary full" type="submit" disabled={diagnosticState.kind === "loading"}>Enviar diagnóstico inicial</button>
              <SaveNotice state={diagnosticState} />
            </form>
          </div>
        </section>

        <section className="section ice-section" id="rompehielo">
          <div className="section-heading split">
            <div><p className="eyebrow">0–5 min · Rompehielo</p><h2>El minuto que quiero recuperar</h2><p>Escribe una tarea docente repetitiva que te gustaría simplificar. No incluyas nombres ni datos de estudiantes.</p></div>
            <div className="time-box"><strong>5:00</strong><span>máximo</span></div>
          </div>
          <div className="two-column">
            <form className="panel form-panel" onSubmit={submitIcebreaker}>
              <Field label="¿Qué tarea te gustaría simplificar?"><textarea name="task" minLength={4} maxLength={160} placeholder="Ejemplo: convertir observaciones breves en una retroalimentación clara…" required /></Field>
              <Field label="Categoría"><select name="category" defaultValue="planeacion">{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <button className="button primary full" type="submit" disabled={iceState.kind === "loading"}>Sumar al tablero</button>
              <SaveNotice state={iceState} />
            </form>
            <div className="panel dashboard-panel" aria-live="polite">
              <div className="dashboard-head"><div><span>Tablero del grupo</span><strong>{iceTotal} respuestas</strong></div><button className="text-button" type="button" onClick={refreshIcebreaker}>Actualizar</button></div>
              <div className="bars">
                {Object.entries(categoryLabels).map(([key, label]) => {
                  const count = iceCounts[key] || 0;
                  return <div className="bar-row" key={key}><div><span>{label}</span><b>{count}</b></div><div className="bar-track"><span style={{ width: `${(count / maxCount) * 100}%` }} /></div></div>;
                })}
              </div>
              <p className="privacy-note">El tablero publica solo totales por categoría; las respuestas individuales no se muestran.</p>
            </div>
          </div>
        </section>

        <section className="section concepts" id="ideas-clave">
          <div className="section-heading"><p className="eyebrow">5–20 min · Microteoría</p><h2>Cuatro ideas antes de pedir</h2></div>
          <div className="concept-grid">
            <article><span>01</span><h3>Genera probabilidades</h3><p>Produce texto, imágenes u otros contenidos plausibles a partir de patrones. No comprende ni verifica como una persona.</p></article>
            <article><span>02</span><h3>Fluidez ≠ confiabilidad</h3><p>Una respuesta puede sonar segura y aun contener datos, referencias o inferencias incorrectas.</p></article>
            <article><span>03</span><h3>El contexto orienta</h3><p>Nivel, propósito, tiempo, recursos y producto reducen supuestos; aun así, la salida requiere revisión.</p></article>
            <article><span>04</span><h3>El docente decide</h3><p>La IA puede apoyar la producción. La pertinencia, la ética y la responsabilidad siguen siendo profesionales.</p></article>
          </div>
          <div className="safety-grid">
            <div className="safety safe"><strong>Sí compartir</strong><p>Escenarios anonimizados, propósitos, recursos, criterios y materiales autorizados.</p></div>
            <div className="safety caution"><strong>Revisar antes</strong><p>Políticas institucionales, derechos de autor, resultados sensibles y documentos internos.</p></div>
            <div className="safety stop"><strong>No compartir</strong><p>Nombres, matrículas, diagnósticos, expedientes, contraseñas o datos que identifiquen a una persona.</p></div>
          </div>
        </section>

        <section className="section demo-section" id="demostracion">
          <div className="section-heading split"><div><p className="eyebrow">20–40 min · Demostración</p><h2>La misma intención, dos resultados distintos</h2></div><span className="active-pill">20 min activos</span></div>
          <div className="compare-grid">
            <article className="prompt-card generic"><span>Petición V1 · genérica</span><p>“Diseña una actividad sobre el uso responsable del agua.”</p><ul><li>No define nivel ni grupo.</li><li>No limita tiempo o recursos.</li><li>No pide producto ni verificación.</li></ul></article>
            <article className="prompt-card contextual"><span>Petición V2 · contextualizada</span><p>“Para 5.º de primaria, diseña una actividad de 15 minutos para 32 estudiantes, con un proyector, sin dispositivos individuales, adaptación para baja visión y boleto de salida…”</p><ul><li>Reduce supuestos.</li><li>Hace visible la viabilidad.</li><li>Permite revisar con criterios.</li></ul></article>
          </div>
          <div className="aula-cycle">
            <div><b>A</b><strong>Analizar</strong><span>¿Qué decisión necesito apoyar?</span></div>
            <div><b>U</b><strong>Usar IA con propósito</strong><span>Dar contexto y pedir una salida concreta.</span></div>
            <div><b>L</b><strong>Leer críticamente</strong><span>Buscar omisiones, invenciones, sesgos y límites.</span></div>
            <div><b>A</b><strong>Ajustar y aplicar</strong><span>Corregir la petición o decidir no usar la salida.</span></div>
          </div>
        </section>

        <section className="section lab-section" id="laboratorio">
          <div className="section-heading split">
            <div><p className="eyebrow">40–75 min · Laboratorio AULA-IA</p><h2>Construye una petición que sí conoce tu aula</h2><p>Elige un caso espejo o trabaja con un caso propio anonimizado. Puedes probar los prompts en ChatGPT o Gemini con una cuenta gratuita.</p></div>
            <div className="lab-progress"><span>Avance estimado</span><strong>{labCompletion}%</strong><div><i style={{ width: `${labCompletion}%` }} /></div></div>
          </div>
          <div className="route-picker" role="group" aria-label="Nivel de reto">
            {[['basica','Básica','Completar y comparar'],['intermedia','Intermedia','Justificar decisiones'],['avanzada','Avanzada','Preguntar, declarar supuestos y alternativa sin IA']].map(([value, label, detail]) => <button key={value} type="button" className={route === value ? "selected" : ""} onClick={() => changeRoute(value)}><strong>{label}</strong><span>{detail}</span></button>)}
          </div>
          <div className="case-grid">
            {Object.entries(cases).map(([key, item]) => <article key={key}><span>{item.tag}</span><h3>{item.title}</h3><p>{item.description}</p><button className="text-button" type="button" onClick={() => loadCase(key)}>Cargar ficha →</button></article>)}
          </div>

          <form className="lab-form" id="constructor" onSubmit={submitLab} noValidate>
            <section className="lab-step">
              <div className="step-heading"><span>A</span><div><h3>Analizar el contexto</h3><p>Describe condiciones pedagógicas, no personas identificables.</p></div></div>
              <div className="form-grid">
                <Field fieldId="s1-context-topic" issue={labIssue("context.topic")} label="Tema o necesidad"><input value={context.topic} onChange={(e) => updateContext("topic", e.target.value)} /></Field>
                <Field fieldId="s1-context-level" issue={labIssue("context.level")} label="Nivel y grado/semestre"><input value={context.level} onChange={(e) => updateContext("level", e.target.value)} /></Field>
                <Field fieldId="s1-context-subject" issue={labIssue("context.subject")} label="Asignatura o campo"><input value={context.subject} onChange={(e) => updateContext("subject", e.target.value)} /></Field>
                <Field fieldId="s1-context-group" issue={labIssue("context.group")} label="Características relevantes del grupo" hint="Sin nombres, diagnósticos ni identificadores."><input value={context.group} onChange={(e) => updateContext("group", e.target.value)} /></Field>
                <Field fieldId="s1-context-purpose" issue={labIssue("context.purpose")} label="Propósito de aprendizaje"><textarea value={context.purpose} onChange={(e) => updateContext("purpose", e.target.value)} /></Field>
                <Field fieldId="s1-context-time" issue={labIssue("context.time")} label="Tiempo disponible"><input value={context.time} onChange={(e) => updateContext("time", e.target.value)} /></Field>
                <Field fieldId="s1-context-resources" issue={labIssue("context.resources")} label="Recursos disponibles"><textarea value={context.resources} onChange={(e) => updateContext("resources", e.target.value)} /></Field>
                <Field fieldId="s1-context-product" issue={labIssue("context.product")} label="Producto o evidencia"><textarea value={context.product} onChange={(e) => updateContext("product", e.target.value)} /></Field>
                <Field fieldId="s1-context-constraints" issue={labIssue("context.constraints")} label="Restricciones y privacidad"><textarea value={context.constraints} onChange={(e) => updateContext("constraints", e.target.value)} /></Field>
                <Field fieldId="s1-context-inclusion" issue={labIssue("context.inclusion")} label="Inclusión y accesibilidad"><textarea value={context.inclusion} onChange={(e) => updateContext("inclusion", e.target.value)} /></Field>
                <Field fieldId="s1-context-verification" issue={labIssue("context.verification")} label="Qué deberá verificarse"><textarea value={context.verification} onChange={(e) => updateContext("verification", e.target.value)} /></Field>
                <Field fieldId="s1-context-outputFormat" issue={labIssue("context.outputFormat")} label="Formato de salida esperado"><textarea value={context.outputFormat} onChange={(e) => updateContext("outputFormat", e.target.value)} /></Field>
              </div>
            </section>

            <section className="lab-step">
              <div className="step-heading"><span>U</span><div><h3>Usar IA con propósito</h3><p>Genera dos versiones y ejecútalas en la herramienta disponible.</p></div></div>
              <button className="button accent" type="button" onClick={buildPrompts}>Construir V1 y V2</button>
              <div className="prompt-editor-grid">
                <Field fieldId="s1-prompt-v1" issue={labIssue("promptV1")} label="V1 · petición rápida"><textarea className="prompt-editor" value={promptV1} onChange={(e) => { setPromptV1(e.target.value); clearLabIssue("promptV1"); }} /></Field>
                <Field fieldId="s1-prompt-v2" issue={labIssue("promptV2")} label="V2 · petición contextualizada"><textarea className="prompt-editor tall" value={promptV2} onChange={(e) => { setPromptV2(e.target.value); clearLabIssue("promptV2"); }} /></Field>
              </div>
              <div className="tool-row">
                <button className="button secondary" type="button" onClick={() => copyPrompt(promptV1, "v1")}>{copied === "v1" ? "V1 copiada" : "Copiar V1"}</button>
                <button className="button secondary" type="button" onClick={() => copyPrompt(promptV2, "v2")}>{copied === "v2" ? "V2 copiada" : "Copiar V2"}</button>
                <a className="button ghost" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Abrir ChatGPT ↗</a>
                <a className="button ghost" href="https://gemini.google.com/" target="_blank" rel="noreferrer">Abrir Gemini ↗</a>
              </div>
              <p className="fine-print">No necesitas funciones avanzadas: un chat gratuito permite realizar esta comparación. Proyectos, Work, plugins, skills y Sites se presentan solo como panorama cuando estén disponibles.</p>
            </section>

            <section className="lab-step">
              <div className="step-heading"><span>L</span><div><h3>Leer críticamente</h3><p>Pega las respuestas o resume lo observado. No incluyas datos de estudiantes.</p></div></div>
              <div className="prompt-editor-grid">
                <Field label="Respuesta a V1 (opcional)"><textarea value={responseV1} onChange={(e) => setResponseV1(e.target.value)} /></Field>
                <Field label="Respuesta a V2 (opcional)"><textarea value={responseV2} onChange={(e) => setResponseV2(e.target.value)} /></Field>
              </div>
              <Field fieldId="s1-review" issue={labIssue("review")} label="Comparación crítica" hint="¿Qué mejoró? ¿Qué sigue siendo dudoso, inviable, poco inclusivo o requiere fuente?"><textarea className="review-editor" value={review} onChange={(e) => { setReview(e.target.value); clearLabIssue("review"); }} /></Field>
            </section>

            <section className="lab-step">
              <div className="step-heading"><span>A</span><div><h3>Ajustar y aplicar</h3><p>Valora los diez indicadores. Para acreditar esta evidencia se requieren al menos seis respuestas “Sí”.</p></div></div>
              <div id="s1-checklist" tabIndex={-1} className={`checklist ${labIssue("checklist") ? "validation-field-error" : ""}`}>
                {checklistItems.map((item, index) => <label key={item}><span><b>{index + 1}.</b> {item}</span><select aria-label={`Valoración del indicador ${index + 1}`} value={checklist[item] ?? ""} onChange={(event) => updateChecklistValue(item, event.target.value)}><option value="" disabled>Valorar</option><option value="si">Sí</option><option value="proceso">En proceso</option><option value="no">No</option></select></label>)}
                {labIssue("checklist") ? <p className="validation-message">{labIssue("checklist")?.message}</p> : null}
              </div>
              <p className="fine-print">Interpretación: 8–10 “Sí”, listo para prueba docente; 6–7, requiere ajuste; 0–5, conviene completar primero la ficha de contexto.</p>
              <div className="evidence-save">
                <Field fieldId="s1-lab-email" issue={labIssue("email")} label="Correo para vincular la evidencia"><input type="email" value={participantEmail} onChange={(event) => { setParticipantEmail(event.target.value); clearLabIssue("email"); }} /></Field>
                <button className="button primary" type="submit" disabled={labState.kind === "loading"}>Guardar evidencia del laboratorio</button>
              </div>
              {labValidationIssues.length ? <div className="validation-summary" role="alert"><h3>No se puede completar todavía</h3><p>Corrige los requisitos críticos. Tu avance permanece en este dispositivo.</p><ol>{labValidationIssues.map((issue) => <li key={issue.key}><button type="button" onClick={() => focusIssue(issue)}>{issue.label}: {issue.message}</button></li>)}</ol></div> : null}
              <button className="button secondary" type="button" onClick={() => persistLabProgress()}>Guardar avance sin acreditar</button>
              <SaveNotice state={labProgressState} />
              <SaveNotice state={labState} />
            </section>
          </form>
        </section>

        <section className="section review-section" id="revision">
          <div className="section-heading split"><div><p className="eyebrow">75–85 min · Revisión</p><h2>Semáforo para decidir si una salida sirve</h2></div><span className="active-pill">10 min activos</span></div>
          <div className="review-grid">
            <article className="green"><strong>Usar con ajustes menores</strong><p>Es pertinente, viable, protege datos y hace visibles los puntos por verificar.</p></article>
            <article className="amber"><strong>Reformular y volver a probar</strong><p>La idea es útil, pero faltan condiciones, criterios, inclusión o un formato operativo.</p></article>
            <article className="red"><strong>Descartar o no usar IA</strong><p>Expone datos, inventa referencias, sustituye una decisión profesional o crea un riesgo innecesario.</p></article>
          </div>
        </section>

        <section className="section exit-section" id="salida">
          <div className="section-heading split"><div><p className="eyebrow">85–90 min · Cierre</p><h2>Evidencia de salida</h2><p>Completa este boleto de salida para cerrar la Sesión 1.</p></div><div className="time-box"><strong>5:00</strong><span>máximo</span></div></div>
          <form className="panel exit-form" onSubmit={submitExit} noValidate>
            <p className="form-intro">Este envío se vincula por correo con la ficha y el prompt V2 que guardaste en el laboratorio.</p>
            <Field fieldId="s1-exit-case" issue={exitIssue("caseChosen")} label="Caso elegido"><select value={exitDraft.caseChosen} onChange={(event) => updateExit("caseChosen", event.target.value)}><option value="propio">Caso propio seguro</option><option value="primaria">Caso 1 · Primaria</option><option value="bachillerato">Caso 2 · Media superior</option><option value="superior">Caso 3 · Superior</option></select></Field>
            <Field fieldId="s1-exit-context" issue={exitIssue("principalContext")} label="Principal contexto agregado"><textarea value={exitDraft.principalContext} onChange={(event) => updateExit("principalContext", event.target.value)} placeholder="El dato que más cambió la pertinencia o viabilidad…" /></Field>
            <Field fieldId="s1-exit-risk" issue={exitIssue("risk")} label="Riesgo o supuesto detectado"><textarea value={exitDraft.risk} onChange={(event) => updateExit("risk", event.target.value)} placeholder="Fiabilidad, aplicabilidad o responsabilidad…" /></Field>
            <Field fieldId="s1-exit-change" issue={exitIssue("responseChangedBecause")} label="La respuesta cambió porque…"><textarea value={exitDraft.responseChangedBecause} onChange={(event) => updateExit("responseChangedBecause", event.target.value)} /></Field>
            <div className="decision-grid">
              <Field fieldId="s1-exit-preserve" issue={exitIssue("preserve")} label="Conservaría…"><textarea value={exitDraft.preserve} onChange={(event) => updateExit("preserve", event.target.value)} /></Field>
              <Field fieldId="s1-exit-correct" issue={exitIssue("correct")} label="Corregiría…"><textarea value={exitDraft.correct} onChange={(event) => updateExit("correct", event.target.value)} /></Field>
              <Field fieldId="s1-exit-verify" issue={exitIssue("verify")} label="Verificaría…"><textarea value={exitDraft.verify} onChange={(event) => updateExit("verify", event.target.value)} /></Field>
            </div>
            <fieldset id="s1-exit-confidence" tabIndex={-1} className={`confidence ${exitIssue("confidence") ? "validation-field-error" : ""}`}><legend>¿Qué tan seguro/a te sientes para contextualizar una petición?</legend><div className="likert">{[1,2,3,4,5].map((value) => <label key={value}><input type="radio" name="confidence" value={value} checked={exitDraft.confidence === value} onChange={() => updateExit("confidence", value)} /><span>{value}</span></label>)}</div>{exitIssue("confidence") ? <p className="validation-message">{exitIssue("confidence")?.message}</p> : null}</fieldset>
            <Field fieldId="s1-exit-email" issue={exitIssue("email")} label="Correo de registro" hint="Debe ser el mismo usado al guardar el laboratorio."><input type="email" value={participantEmail} onChange={(event) => { setParticipantEmail(event.target.value); setExitValidationIssues((current) => current.filter((issue) => issue.key !== "email")); }} /></Field>
            {exitValidationIssues.length ? <div className="validation-summary" role="alert"><h3>No se puede acreditar todavía</h3><p>Corrige los requisitos críticos. No se generó folio ni comprobante final.</p><ol>{exitValidationIssues.map((issue) => <li key={issue.key}><button type="button" onClick={() => focusIssue(issue)}>{issue.label}: {issue.message}</button></li>)}</ol></div> : null}
            <button className="button secondary" type="button" onClick={() => { try { localStorage.setItem(S1_EXIT_KEY, JSON.stringify(exitDraft)); setExitProgressState({ kind: "success", message: "Avance de salida guardado en este dispositivo. Todavía no acredita." }); } catch { setExitProgressState({ kind: "error", message: "No fue posible confirmar el guardado local." }); } }}>Guardar avance sin acreditar</button>
            <button className="button primary" type="submit" disabled={exitState.kind === "loading"}>Enviar evidencia de salida</button>
            <SaveNotice state={exitProgressState} />
            <SaveNotice state={exitState} />
          </form>
          <EvidencePdfDownload session="S1" email={participantEmail} pdfAccessCode={exitState.pdfAccessCode} />
          <aside className="weekly-card">
            <span>Actividad semanal · carga abierta</span><h3>Antes y después con contexto</h3>
            <p>Aplica AULA-IA a una tarea real, segura y no sensible. Entrega:</p>
            <ol className="weekly-deliverables"><li>Descripción breve del caso.</li><li>Prompt genérico y fragmento de la primera respuesta.</li><li>Ficha de contexto.</li><li>Prompt contextualizado y fragmento de la segunda respuesta.</li><li>Una corrección realizada por ti.</li><li>Reflexión de 100–150 palabras sobre utilidad, límite y decisión profesional.</li></ol>
            <strong>Nombre sugerido:</strong><p>S1_Apellido_Nombre_Contexto.docx o .pdf. Referencia no obligatoria: 30–45 minutos fuera del tiempo oficial.</p>
          </aside>
        </section>

        <section className="section resources-section" id="recursos">
          <div className="section-heading"><p className="eyebrow">Aula virtual</p><h2>Recursos para continuar</h2></div>
          <div className="resource-grid">
            <article className="resource-card"><span>Material final</span><strong>Presentación · Sesión 1</strong><small>Versión editable y versión de consulta</small><div className="download-links"><a href="/recursos/presentacion-sesion-1.pptx" download>PPTX</a><a href="/recursos/presentacion-sesion-1.pdf" download>PDF</a></div></article>
            <article className="resource-card"><span>Material final</span><strong>Cuadernillo del participante</strong><small>Versión editable y versión de consulta</small><div className="download-links"><a href="/recursos/cuadernillo-sesion-1.docx" download>DOCX</a><a href="/recursos/cuadernillo-sesion-1.pdf" download>PDF</a></div></article>
            <article className="resource-card"><span>Material final</span><strong>Hoja de trabajo</strong><small>Versión editable y versión de consulta</small><div className="download-links"><a href="/recursos/hoja-trabajo-sesion-1.docx" download>DOCX</a><a href="/recursos/hoja-trabajo-sesion-1.pdf" download>PDF</a></div></article>
            <article className="resource-card"><span>Material final</span><strong>Banco de prompts</strong><small>Versión editable y versión de consulta</small><div className="download-links"><a href="/recursos/banco-prompts-sesion-1.docx" download>DOCX</a><a href="/recursos/banco-prompts-sesion-1.pdf" download>PDF</a></div></article>
            <a href="/recursos/ficha-contexto-s1.txt" download><span>Descarga</span><strong>Ficha de contexto AULA-IA</strong><small>Plantilla reutilizable en texto</small></a>
            <a href="/recursos/guia-aula-ia.txt" download><span>Descarga</span><strong>Guía rápida del ciclo</strong><small>Preguntas de control para cada fase</small></a>
            <a href="https://unesdoc.unesco.org/ark:/48223/pf0000386693" target="_blank" rel="noreferrer"><span>Fuente</span><strong>UNESCO · IA generativa</strong><small>Orientación para educación e investigación ↗</small></a>
            <a href="https://learn.chatgpt.com/docs" target="_blank" rel="noreferrer"><span>Ayuda oficial</span><strong>ChatGPT · documentación</strong><small>Funciones vigentes y disponibilidad ↗</small></a>
            <a href="https://support.google.com/gemini/?hl=es" target="_blank" rel="noreferrer"><span>Ayuda oficial</span><strong>Gemini · centro de ayuda</strong><small>Uso y controles de la herramienta ↗</small></a>
          </div>
        </section>

        <section className="privacy-section" id="privacidad">
          <div><p className="eyebrow">Privacidad y uso responsable</p><h2>Se guarda lo necesario, no más.</h2></div>
          <div><p>Asistencia, diagnóstico, laboratorio y salida se conservan en la base del sitio para seguimiento del curso. El tablero público solo muestra conteos por categoría. No se solicitan matrículas, expedientes, diagnósticos ni datos de estudiantes.</p><p>Puedes usar un caso simulado. Antes de copiar cualquier contenido a ChatGPT o Gemini, elimina nombres, correos, identificadores y datos sensibles; consulta además la política de tu institución.</p></div>
        </section>
      </main>
      <SessionNavigation current={1} position="bottom" />

      <footer>
        <div><strong>AULA-IA · Sesión 1</strong><span>Red de Docentes Transdisciplinar de México, S.C.</span></div>
        <div><a href="https://reddocentes.com" target="_blank" rel="noreferrer">reddocentes.com</a><a href="https://reddocentes.mx" target="_blank" rel="noreferrer">reddocentes.mx</a><a href="#privacidad">Privacidad</a></div>
      </footer>
    </>
  );
}
