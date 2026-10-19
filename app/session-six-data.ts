export const sessionSixTitle = "Sesión 6 · Integración y producto final";

export const sessionSixTotalMinutes = 90;
export const sessionSixOrientationMinutes = 15;
export const sessionSixApplicationMinutes = 75;

export const sessionSixAgenda = [
  { range: "0–5", minutes: 5, title: "Bienvenida y recuperación del recorrido", mode: "Orientación" },
  { range: "5–15", minutes: 10, title: "Arquitectura del producto y recuperación de trabajos", mode: "Orientación" },
  { range: "15–45", minutes: 30, title: "Laboratorio 1 · Integrar el proyecto", mode: "Aplicación" },
  { range: "45–65", minutes: 20, title: "Laboratorio 2 · Auditar congruencia y límites", mode: "Aplicación" },
  { range: "65–80", minutes: 15, title: "Aceptar, adaptar o rechazar con justificación", mode: "Aplicación" },
  { range: "80–88", minutes: 8, title: "Evidencia final y primer paso de aplicación", mode: "Aplicación" },
  { range: "88–90", minutes: 2, title: "Cierre del curso", mode: "Aplicación" },
] as const;

export const sessionConnections = [
  { session: "Sesión 1", title: "Contexto y prompt pertinente", contribution: "Define la necesidad, el propósito y la petición que orientan el trabajo." },
  { session: "Sesión 2", title: "Fuentes y trazabilidad", contribution: "Distingue qué información está sustentada, qué debe verificarse y de dónde proviene." },
  { session: "Sesión 3", title: "Secuencia didáctica congruente", contribution: "Conecta propósito, actividades, evidencias y condiciones reales de aplicación." },
  { session: "Sesión 4", title: "Evaluación y retroalimentación", contribution: "Convierte la evidencia en criterios, retroalimentación y ajustes revisados por el docente." },
  { session: "Sesión 5", title: "Instrumento, datos y decisión", contribution: "Interpreta hallazgos con límites y propone una decisión que pueda verificarse." },
] as const;

export const integrationChain = [
  "Contexto",
  "Propósito",
  "Actividad",
  "Evidencia",
  "Instrumento",
  "Datos",
  "Hallazgo",
  "Decisión",
  "Nueva evidencia",
] as const;

export type SupportRoute = "basica" | "intermedia" | "avanzada";

export const supportRoutes: ReadonlyArray<{
  key: SupportRoute;
  label: string;
  subtitle: string;
  description: string;
  support: readonly string[];
}> = [
  {
    key: "basica",
    label: "Básica",
    subtitle: "Integración guiada",
    description: "Organiza el mismo núcleo del proyecto con ejemplos breves, frases de inicio y una ruta paso a paso.",
    support: ["Puede partir de un caso ficticio", "Usa preguntas y comienzos de frase", "Revisa un componente a la vez"],
  },
  {
    key: "intermedia",
    label: "Intermedia",
    subtitle: "Adaptación al contexto propio",
    description: "Integra el proyecto en un contexto docente real, sin datos personales, con preguntas de verificación.",
    support: ["Adapta productos anteriores", "Justifica los principales ajustes", "Comprueba la congruencia completa"],
  },
  {
    key: "avanzada",
    label: "Avanzada",
    subtitle: "Auditoría y transferencia",
    description: "Profundiza en triangulación, contingencia, límites y verificación de la decisión docente.",
    support: ["Contrasta más de una evidencia", "Explicita límites y contingencia", "Define cómo verificará la decisión"],
  },
];

export const auditChecklist = [
  { key: "context_alignment", label: "La necesidad, el contexto y el propósito se corresponden." },
  { key: "source_traceability", label: "Las fuentes están identificadas y se distingue lo que debe verificarse." },
  { key: "sequence_coherence", label: "La secuencia conecta propósito, actividades y condiciones reales." },
  { key: "evidence_alignment", label: "La evidencia esperada permite observar el aprendizaje propuesto." },
  { key: "instrument_alignment", label: "El instrumento y los criterios valoran esa evidencia, no otra." },
  { key: "data_limits", label: "La lectura de datos declara límites, faltantes y lo que no permite afirmar." },
  { key: "teacher_decision", label: "La decisión docente está justificada y puede verificarse con seguimiento." },
  { key: "inclusion_follow_up", label: "La propuesta incluye una adaptación y una nueva evidencia de seguimiento." },
] as const;

export type AuditChecklistKey = (typeof auditChecklist)[number]["key"];

export const finalEvidenceFields = [
  "Necesidad docente y contexto sin datos personales",
  "Propósito observable y fuentes identificables",
  "Prompt contextualizado en su versión final revisada",
  "Secuencia de actividades y evidencia esperada",
  "Instrumento y criterios de evaluación",
  "Lectura prudente de datos, límites y faltantes",
  "Decisión docente y nueva evidencia de seguimiento",
  "Adaptación para inclusión o apoyo",
  "Aporte de la IA y ajustes realizados por el docente",
  "Primer paso concreto de aplicación",
] as const;

export const reviewOptions = [
  { key: "aceptar", label: "Aceptar", prompt: "Aceptar: conservaré esta parte porque está sustentada y es congruente con…" },
  { key: "adaptar", label: "Adaptar", prompt: "Adaptar: modificaré esta parte porque mi contexto requiere…" },
  { key: "rechazar", label: "Rechazar", prompt: "Rechazar: no utilizaré esta parte porque no está sustentada, no es viable o…" },
] as const;

export const sessionSixFaq = [
  { question: "¿Debo empezar un proyecto nuevo?", answer: "No. Recupera y mejora productos de las sesiones anteriores. Si no tienes alguno, completa ese componente con la guía de tu ruta." },
  { question: "¿La ruta cambia el valor de la evidencia?", answer: "No. Las tres rutas entregan el mismo núcleo. Solo cambia el nivel de apoyo para construirlo y revisarlo." },
  { question: "¿Debo utilizar datos reales del alumnado?", answer: "No. Trabaja con casos ficticios, anonimizados o con descripciones generales que no permitan identificar personas." },
  { question: "¿Tengo que aceptar lo que proponga la IA?", answer: "No. Debes aceptar, adaptar o rechazar sus aportes y justificar la decisión con criterios pedagógicos y evidencia." },
] as const;

type IntegrationPromptInput = {
  route: SupportRoute;
  projectTitle: string;
  teachingNeed: string;
  educationalLevel: string;
  subject: string;
  pedagogicalContext: string;
  learningPurpose: string;
  sourceTraceability: string;
};

function promptValue(value: string, fallback: string) {
  return value.trim() || `[${fallback}]`;
}

export function buildIntegrationPrompt(input: IntegrationPromptInput) {
  const route = supportRoutes.find((item) => item.key === input.route) ?? supportRoutes[0];
  return `Actúa como asistente de integración didáctica. Ayúdame a producir un BORRADOR que yo revisaré y decidiré como docente.

PROYECTO
Título: ${promptValue(input.projectTitle, "título del proyecto")}
Necesidad docente: ${promptValue(input.teachingNeed, "necesidad observable")}
Nivel educativo: ${promptValue(input.educationalLevel, "nivel")}
Asignatura o área: ${promptValue(input.subject, "asignatura")}
Contexto sin datos personales: ${promptValue(input.pedagogicalContext, "contexto, tiempo y recursos")}
Propósito de aprendizaje: ${promptValue(input.learningPurpose, "propósito observable")}
Fuentes y aspectos por verificar: ${promptValue(input.sourceTraceability, "fuentes identificables y límites")}

RUTA DE APOYO: ${route.label.toUpperCase()} · ${route.subtitle}
${route.support.map((item, index) => `${index + 1}. ${item}.`).join("\n")}

Integra el proyecto en este orden:
1. Contexto y propósito.
2. Secuencia de actividades.
3. Evidencia esperada.
4. Instrumento y criterios.
5. Lectura prudente de datos o resultados.
6. Datos faltantes y límites.
7. Decisión docente y nueva evidencia de seguimiento.
8. Adaptación para inclusión o apoyo.

Al final separa claramente: a) lo que propuso la IA; b) lo que requiere verificación; c) tres decisiones que debe tomar el docente. No inventes fuentes, resultados, diagnósticos ni datos del alumnado.`;
}
