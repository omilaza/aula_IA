export const sessionThreeTitle = "De la intención a la acción: diseño de actividades y secuencias didácticas con IA";

export const prepAgenda = [
  { time: "0–5", minutes: 5, label: "Entrada y propósito", detail: "Registro de preparación y conexión con la sesión principal" },
  { time: "5–15", minutes: 10, label: "Propósito, actividad y evidencia", detail: "Distinguir y relacionar las tres piezas en un ejemplo breve" },
  { time: "15–30", minutes: 15, label: "Demostración acompañada", detail: "Transformar una petición general en un encargo docente completo" },
  { time: "30–50", minutes: 20, label: "Construcción guiada", detail: "Completar una plantilla y producir una mini-secuencia" },
  { time: "50–55", minutes: 5, label: "Revisión CAVIA ligera", detail: "Comprobar coherencia, acción, viabilidad, inclusión y ajuste" },
  { time: "55–60", minutes: 5, label: "Registro y transición", detail: "Guardar el recorrido y entrar a la sesión principal" },
];

export const mainAgenda = [
  { time: "0–5", minutes: 5, label: "Activación y asistencia", detail: "Conexión con fuentes y contexto trabajados en la Sesión 2", active: false },
  { time: "5–20", minutes: 15, label: "Microcontenido dialogado", detail: "Coherencia entre propósito, actividad, evidencia, tiempo e inclusión", active: false },
  { time: "20–40", minutes: 20, label: "Demostración comparativa", detail: "Del prompt general a una secuencia revisable y viable", active: true },
  { time: "40–75", minutes: 35, label: "Laboratorio de diseño", detail: "Diseñar una secuencia en uno de tres casos espejo", active: true },
  { time: "75–85", minutes: 10, label: "Auditoría CAVIA", detail: "Detectar desalineaciones y aplicar criterios docentes", active: true },
  { time: "85–90", minutes: 5, label: "Evidencia y cierre", detail: "Registrar el ajuste y transferirlo a una clase real", active: true },
];

export const cases = [
  {
    key: "basica",
    level: "Educación básica",
    subject: "Historia",
    title: "Dos voces sobre un cambio en la comunidad",
    learningPurpose: "Comparar dos testimonios simulados e identificar coincidencias, diferencias y preguntas pendientes.",
    context: "Sexto grado; 45 minutos; trabajo en parejas; lectura breve y cierre individual.",
    product: "Secuencia de inicio, desarrollo y cierre con organizador comparativo y boleto de salida.",
    source: `EJEMPLO SIMULADO AULA-IA. No describe una comunidad real.

Testimonio A: “Cuando se abrió la nueva biblioteca, algunas familias comenzaron a reunirse allí los sábados. Yo la recuerdo como un lugar para consultar libros y conversar”.

Testimonio B: “La biblioteca facilitó actividades escolares, pero no todas las personas podían asistir porque sus horarios eran distintos”.

Los testimonios expresan experiencias personales. No permiten calcular cuántas personas asistieron ni demostrar por sí solos que toda la comunidad cambió.`,
  },
  {
    key: "media",
    level: "Media superior",
    subject: "Filosofía",
    title: "¿Una herramienta decide por nosotros?",
    learningPurpose: "Distinguir tesis, razón, objeción y supuesto en dos posiciones breves sobre el uso de tecnología.",
    context: "Bachillerato; 50 minutos; discusión en equipos; producto individual de cierre.",
    product: "Secuencia de análisis argumentativo con pregunta detonadora, contraste y conclusión razonada.",
    source: `EJEMPLO SIMULADO AULA-IA. Posiciones creadas para la práctica.

Posición A: “Una herramienta amplía nuestras posibilidades cuando comprendemos sus límites y conservamos la decisión final”.

Posición B: “Delegar decisiones de manera automática puede reducir la reflexión, incluso cuando la herramienta ofrece resultados rápidos”.

Ninguna posición constituye por sí sola una conclusión universal. El grupo deberá identificar razones, supuestos y posibles contraejemplos.`,
  },
  {
    key: "superior",
    level: "Educación superior",
    subject: "Humanidades",
    title: "Interpretaciones y evidencia en un seminario",
    learningPurpose: "Construir y revisar una interpretación breve, diferenciando evidencia disponible, inferencia y pregunta de investigación.",
    context: "Licenciatura; seminario de 60 minutos; lectura previa; conversación académica y escritura breve.",
    product: "Secuencia de seminario con apertura, contraste de interpretaciones y producción escrita.",
    source: `EJEMPLO SIMULADO AULA-IA. Nota de trabajo sin resultados de investigación.

Un seminario comparará tres maneras de interpretar un acontecimiento: desde las decisiones de sus protagonistas, desde las condiciones de su época y desde la memoria construida posteriormente. La nota propone usar fragmentos previamente seleccionados, pero no establece cuál interpretación es correcta ni presenta evidencia suficiente para jerarquizarlas.

El producto deberá mostrar qué fragmento apoya cada interpretación y qué asunto requiere una fuente adicional.`,
  },
] as const;

export const difficultyLevels = [
  {
    key: "basico",
    label: "Básico",
    description: "Completa una secuencia de tres momentos con una evidencia breve.",
    requirement: "Incluye propósito observable, inicio, desarrollo, cierre y boleto de salida.",
  },
  {
    key: "intermedio",
    label: "Intermedio",
    description: "Acumula la ruta Básica y añade fuente, apoyos, adaptación y revisión.",
    requirement: "Solicita propósito observable; tres momentos con tiempos; acciones de docente y alumnado; evidencia breve; boleto de salida; fuente identificada; apoyo para distintos ritmos; adaptación; criterio de revisión y lista de cotejo breve.",
  },
  {
    key: "avanzado",
    label: "Avanzado",
    description: "Acumula las rutas anteriores y exige dos vías de participación con revisión crítica.",
    requirement: "Solicita propósito observable; tres momentos con tiempos; acciones de docente y alumnado; evidencia breve; boleto de salida; fuente identificada; apoyo para distintos ritmos; adaptación; criterio de revisión; lista de cotejo breve; rutas A y B; explicación del propósito común; alternativa de acceso; contraejemplo; revisión crítica y decisiones justificadas sobre qué conservar, ajustar y retirar.",
  },
] as const;

const basicPromptRequirements = [
  "Propósito observable.",
  "Secuencia de tres momentos: inicio, desarrollo y cierre.",
  "Inicio, desarrollo y cierre con sus tiempos parciales.",
  "Acciones de la persona docente y del alumnado.",
  "Evidencia breve de aprendizaje.",
  "Boleto de salida.",
] as const;

const intermediatePromptRequirements = [
  ...basicPromptRequirements,
  "Fuente utilizada claramente identificada.",
  "Apoyo para distintos ritmos de aprendizaje.",
  "Adaptación pertinente al contexto.",
  "Criterio de revisión de la evidencia.",
  "Lista de cotejo breve para revisar el producto.",
] as const;

const advancedPromptRequirements = [
  ...intermediatePromptRequirements,
  "Ruta de participación A.",
  "Ruta de participación B.",
  "Explicación de cómo las rutas A y B alcanzan el mismo propósito.",
  "Alternativa de acceso.",
  "Contraejemplo relacionado con el contenido o la decisión didáctica.",
  "Revisión crítica de la secuencia.",
  "Decisión justificada sobre qué conservar.",
  "Decisión justificada sobre qué ajustar.",
  "Decisión justificada sobre qué retirar.",
] as const;

export const difficultyPromptRequirements = {
  basico: basicPromptRequirements,
  intermedio: intermediatePromptRequirements,
  avanzado: advancedPromptRequirements,
} as const;

export const difficultyContent = {
  basico: {
    description: "Construye una secuencia verificable de tres momentos con una evidencia breve.",
    requirement: "Solicita propósito observable; secuencia de tres momentos; inicio, desarrollo y cierre con tiempos; acciones de la persona docente y del alumnado; evidencia breve y boleto de salida.",
    finalInstruction: "Ruta Básica: registra propósito observable, tres momentos con tiempos, acciones de docente y alumnado, evidencia breve y boleto de salida. Los campos de auditoría docente permanecen como revisión transversal de la sesión y no añaden requisitos de las rutas superiores.",
  },
  intermedio: {
    description: "Acumula la ruta Básica y añade fuente, apoyos, adaptación y revisión.",
    requirement: "Solicita propósito observable; tres momentos con tiempos; acciones de docente y alumnado; evidencia breve; boleto de salida; fuente identificada; apoyo para distintos ritmos; adaptación; criterio de revisión y lista de cotejo breve.",
    finalInstruction: "Ruta Intermedia: completa todos los requisitos de Básico y añade fuente identificada, apoyo para distintos ritmos, adaptación, criterio de revisión y una lista de cotejo breve.",
  },
  avanzado: {
    description: "Acumula las rutas anteriores y exige dos vías de participación con revisión crítica.",
    requirement: "Solicita propósito observable; tres momentos con tiempos; acciones de docente y alumnado; evidencia breve; boleto de salida; fuente identificada; apoyo para distintos ritmos; adaptación; criterio de revisión; lista de cotejo breve; rutas A y B; explicación del propósito común; alternativa de acceso; contraejemplo; revisión crítica y decisiones justificadas sobre qué conservar, ajustar y retirar.",
    finalInstruction: "Ruta Avanzada: registra propósito observable; tres momentos con tiempos; acciones de docente y alumnado; evidencia breve; boleto de salida; fuente identificada; apoyo para distintos ritmos; adaptación; criterio; lista breve; rutas A y B y su propósito común; alternativa de acceso; contraejemplo; revisión crítica y decisiones justificadas de conservar, ajustar y retirar.",
  },
} as const;

const basicChecklist = [
  "El propósito es observable.",
  "La secuencia contiene tres momentos: inicio, desarrollo y cierre.",
  "Inicio, desarrollo y cierre indican sus tiempos parciales.",
  "Se distinguen las acciones de la persona docente y del alumnado.",
  "La secuencia incluye una evidencia breve de aprendizaje.",
  "La secuencia incluye un boleto de salida.",
] as const;

const intermediateChecklist = [
  ...basicChecklist,
  "La fuente utilizada está identificada.",
  "La secuencia ofrece apoyo para distintos ritmos de aprendizaje.",
  "La secuencia registra una adaptación pertinente.",
  "La evidencia incluye un criterio de revisión.",
  "El producto incorpora una lista de cotejo breve.",
] as const;

const advancedChecklist = [
  ...intermediateChecklist,
  "La secuencia contiene una ruta de participación A.",
  "La secuencia contiene una ruta de participación B.",
  "Se explica cómo las rutas A y B alcanzan el mismo propósito.",
  "La secuencia incluye una alternativa de acceso.",
  "El producto registra un contraejemplo.",
  "La persona docente realiza una revisión crítica de la secuencia.",
  "Se justifica qué conservar.",
  "Se justifica qué ajustar.",
  "Se justifica qué retirar.",
] as const;

export const difficultyEvidenceChecklist = {
  basico: basicChecklist,
  intermedio: intermediateChecklist,
  avanzado: advancedChecklist,
} as const;

export const alignmentQuestions = [
  {
    text: "Que el grupo contraste dos posiciones y justifique una conclusión.",
    answer: "proposito",
    feedback: "Describe lo que se espera que el grupo sea capaz de hacer; funciona como propósito observable.",
  },
  {
    text: "Subrayar tesis y razones, comparar en parejas y redactar una respuesta.",
    answer: "actividad",
    feedback: "Indica las acciones mediante las cuales se practica el aprendizaje esperado.",
  },
  {
    text: "Conclusión de cinco líneas que usa una razón y responde una objeción.",
    answer: "evidencia",
    feedback: "Permite observar si el propósito se alcanzó y con qué calidad.",
  },
];

export const reviewScenarios = [
  {
    text: "El propósito pide argumentar, pero la actividad solo solicita copiar definiciones.",
    answer: "desalineada",
    feedback: "Copiar definiciones no permite practicar ni observar la construcción de un argumento.",
  },
  {
    text: "El propósito pide comparar y la evidencia solicita una tabla de semejanzas, diferencias y conclusión.",
    answer: "alineada",
    feedback: "La evidencia hace visible la comparación solicitada en el propósito.",
  },
  {
    text: "La secuencia propone seis productos en 20 minutos.",
    answer: "ajustar",
    feedback: "La intención puede ser pertinente, pero el alcance debe reducirse para que sea viable.",
  },
  {
    text: "La IA propone una actividad atractiva que no utiliza la fuente ni responde al propósito.",
    answer: "retirar",
    feedback: "La fluidez o atractivo del borrador no compensa la falta de relación con el propósito y la fuente.",
  },
];

export const orderSteps = [
  "Definir qué aprendizaje será observable.",
  "Precisar contexto, tiempo, recursos y fuente.",
  "Diseñar actividades que practiquen ese aprendizaje.",
  "Definir una evidencia coherente con el propósito.",
  "Pedir un borrador a la IA, revisar y ajustar.",
];

export const evidenceChecklist = [
  "El propósito describe una acción observable del participante o del alumnado.",
  "Las actividades practican directamente el propósito.",
  "La evidencia permite observar el aprendizaje esperado.",
  "Los tiempos parciales caben en la duración disponible.",
  "La fuente, caso o contenido de referencia está identificado.",
  "El prompt distingue requisitos obligatorios de propuestas opcionales.",
  "La revisión docente identifica al menos una mejora necesaria.",
  "El producto final incluye un ajuste realizado por la persona participante.",
];

export const caviaChecklist = [
  "C · Coherencia: propósito, actividad y evidencia se corresponden.",
  "A · Acción: se explica qué hará el estudiante, no solo qué hará el docente.",
  "V · Viabilidad: los tiempos suman y los recursos realmente existen.",
  "I · Inclusión: existe al menos una opción razonable de acceso, participación o expresión.",
  "A · Ajuste docente: se corrigió al menos una propuesta genérica, supuesto o problema de la salida de IA.",
] as const;

export const sourceLinks = [
  {
    label: "UNESCO · Marco de competencias de IA para docentes",
    url: "https://unesdoc.unesco.org/ark:/48223/pf0000391104",
    support: "Respalda una integración pedagógica de la IA centrada en la agencia y responsabilidad docente.",
  },
  {
    label: "OpenAI Academy · Write Better Prompts for Teachers",
    url: "https://academy.openai.com/en/public/clubs/k-12-education-aacga/blogs/write-better-prompts-teachers-2026-05-28",
    support: "Documenta el patrón tarea, contexto y formato de salida para encargos docentes más claros.",
  },
  {
    label: "OpenAI · ¿Cómo pueden los educadores empezar con ChatGPT?",
    url: "https://help.openai.com/es-419/articles/8313929-how-can-educators-get-started-with-chatgpt",
    support: "Señala que los resultados son puntos de partida sujetos a la revisión y decisión profesional del docente.",
  },
  {
    label: "Google · Conoce NotebookLM",
    url: "https://support.google.com/notebooklm/answer/16164461",
    support: "Describe el trabajo con fuentes incorporadas y las citas en línea para rastrear respuestas.",
  },
  {
    label: "Google · Consejos para instrucciones de Gems",
    url: "https://support.google.com/gemini/answer/15235603",
    support: "Explica el uso de rol, tarea, contexto y formato como componentes de una instrucción.",
  },
  {
    label: "DigCompEdu · Marco europeo de competencia digital docente",
    url: "https://joint-research-centre.ec.europa.eu/digcompedu/digcompedu-framework_en",
    support: "Relaciona objetivos, contexto, recursos, evaluación, evidencia y participación activa.",
  },
  {
    label: "CAST · Pautas de Diseño Universal para el Aprendizaje 3.0",
    url: "https://udlguidelines.cast.org/",
    support: "Orienta la creación de opciones de participación, representación y expresión.",
  },
] as const;

export const additionalActivities = [
  {
    time: "3–5 minutos",
    title: "La evidencia perdida",
    purpose: "Detectar rápidamente una secuencia sin evidencia observable.",
    instruction: "Muestra un propósito y dos cierres; el grupo vota cuál permite observar mejor el aprendizaje.",
    interaction: "Selección y justificación de una frase.",
    feedback: "La opción adecuada debe producir información relacionada directamente con el propósito.",
  },
  {
    time: "5–10 minutos",
    title: "Cirugía de tiempos",
    purpose: "Ajustar una secuencia que excede la duración disponible.",
    instruction: "Reduce una propuesta de 70 a 45 minutos sin eliminar el propósito ni la evidencia.",
    interaction: "Ordenar, retirar y justificar decisiones.",
    feedback: "El ajuste es válido cuando conserva la práctica central y una evidencia suficiente.",
  },
  {
    time: "10–15 minutos",
    title: "El mismo propósito, tres niveles",
    purpose: "Explorar transferencia entre básico, media superior y superior.",
    instruction: "Adapta un mismo propósito cambiando complejidad, apoyo y evidencia; no cambies solo el vocabulario.",
    interaction: "Producción breve y comparación en parejas.",
    feedback: "Una adaptación real modifica el nivel de razonamiento, los apoyos y la evidencia esperada.",
  },
] as const;

export const faq = [
  ["¿Necesito completar los tres niveles de dificultad?", "No. Elige uno según tu experiencia y tiempo; los demás permanecen como rutas opcionales."],
  ["¿Debo usar una herramienta específica?", "No. La actividad esencial funciona con ChatGPT o Gemini; NotebookLM es opcional cuando deseas anclar el trabajo a fuentes."],
  ["¿La IA decide el propósito y la evaluación?", "No. Puede proponer borradores, pero la persona docente define, revisa y ajusta las decisiones pedagógicas."],
  ["¿Qué hago si la herramienta externa no abre?", "Usa la respuesta de contingencia integrada y completa la revisión dentro de AULA-IA."],
  ["¿La preparación acredita?", "No. Registra avance, pero la acreditación requiere asistencia y evidencia en la sesión principal."],
] as const;
