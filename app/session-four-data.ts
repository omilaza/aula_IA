export const sessionFourTitle =
  "Evaluar para mejorar: diagnóstico, retroalimentación y análisis de evidencias con IA";

export const prepAgenda = [
  { time: "0–5", minutes: 5, label: "Entrada y propósito", detail: "Registro independiente y conexión con la sesión principal" },
  { time: "5–15", minutes: 10, label: "Tres momentos de evaluación", detail: "Distinguir diagnóstica, formativa y sumativa en ejemplos breves" },
  { time: "15–30", minutes: 15, label: "Demostración acompañada", detail: "Relacionar propósito, evidencia, criterio y retroalimentación" },
  { time: "30–50", minutes: 20, label: "Construcción guiada", detail: "Redactar criterios y una retroalimentación accionable" },
  { time: "50–55", minutes: 5, label: "Revisión CAVIA ligera", detail: "Comprobar coherencia, acción, viabilidad, inclusión y ajuste" },
  { time: "55–60", minutes: 5, label: "Registro y transición", detail: "Guardar la práctica y entrar a la sesión principal" },
] as const;

export const mainAgenda = [
  { time: "0–5", minutes: 5, label: "Activación y asistencia", detail: "Registrar la entrada y recuperar una decisión de evaluación", active: false },
  { time: "5–15", minutes: 10, label: "Microcontenido dialogado", detail: "Evaluar, calificar y retroalimentar: propósitos distintos", active: false },
  { time: "15–30", minutes: 15, label: "Demostración comparativa", detail: "De una opinión general a retroalimentación basada en evidencia", active: true },
  { time: "30–65", minutes: 35, label: "Laboratorio por nivel", detail: "Analizar una evidencia y producir retroalimentación revisable", active: true },
  { time: "65–80", minutes: 15, label: "Auditoría CAVIA", detail: "Detectar inferencias, sesgos, omisiones y acciones poco claras", active: true },
  { time: "80–85", minutes: 5, label: "Ajuste docente", detail: "Conservar, corregir o retirar elementos de la salida de IA", active: true },
  { time: "85–90", minutes: 5, label: "Evidencia y cierre", detail: "Guardar el producto final y el siguiente paso", active: true },
] as const;

export const cases = [
  {
    key: "basica",
    level: "Educación básica",
    subject: "Historia",
    title: "Comparar dos testimonios sin convertir opiniones en hechos",
    learningPurpose:
      "Comparar dos testimonios simulados e identificar una coincidencia, una diferencia y una pregunta pendiente.",
    context: "Sexto grado; actividad de 45 minutos; producto individual posterior al trabajo en parejas.",
    evidenceProduct:
      "Organizador comparativo con una coincidencia, una diferencia, un fragmento de apoyo y una pregunta pendiente.",
    source: `EJEMPLO SIMULADO AULA-IA. No describe una comunidad real.

Testimonio A: “Cuando se abrió la biblioteca, algunas familias comenzaron a reunirse allí los sábados. Yo la recuerdo como un lugar para consultar libros y conversar”.

Testimonio B: “La biblioteca facilitó actividades escolares, pero no todas las personas podían asistir porque sus horarios eran distintos”.

Respuesta simulada del estudiante: “Los dos testimonios dicen que la biblioteca cambió por completo a toda la comunidad y que todas las familias asistían. La diferencia es que una persona iba a conversar y la otra no podía ir”.

La respuesta contiene una comparación inicial, pero generaliza más allá de la evidencia disponible. Los testimonios no permiten afirmar que toda la comunidad cambió ni que todas las familias asistían.`,
  },
  {
    key: "media",
    level: "Media superior",
    subject: "Filosofía",
    title: "Valorar un argumento sobre decisiones y tecnología",
    learningPurpose:
      "Identificar tesis, razón y objeción en un argumento breve, y valorar si la conclusión está respaldada.",
    context: "Bachillerato; discusión de 50 minutos; respuesta individual de cierre.",
    evidenceProduct:
      "Texto de seis a ocho líneas con tesis, una razón, una objeción y una conclusión revisada.",
    source: `EJEMPLO SIMULADO AULA-IA. Argumento creado para la práctica.

“Las herramientas digitales siempre mejoran nuestras decisiones porque entregan respuestas rápidas. Algunas personas advierten que una respuesta veloz puede ocultar errores, pero eso no importa si la mayoría de las veces funciona. Por lo tanto, deberíamos aceptar automáticamente sus recomendaciones”.

La respuesta presenta una tesis y menciona una objeción, pero la descarta sin responderla y usa “siempre” sin evidencia suficiente.`,
  },
  {
    key: "superior",
    level: "Educación superior",
    subject: "Humanidades",
    title: "Separar evidencia, inferencia y pregunta de investigación",
    learningPurpose:
      "Revisar una interpretación breve distinguiendo evidencia disponible, inferencia y asunto que requiere investigación adicional.",
    context: "Licenciatura; seminario de 60 minutos; lectura previa y escritura académica breve.",
    evidenceProduct:
      "Interpretación de un párrafo con fragmento de apoyo, inferencia explícita y pregunta de investigación.",
    source: `EJEMPLO SIMULADO AULA-IA. Nota de trabajo sin resultados de investigación.

Fuente de trabajo: “En dos cartas, la autora menciona que cambió el orden de los capítulos después de conversar con su editora”.

Respuesta simulada del estudiante: “Las cartas demuestran que la editora escribió la estructura definitiva de la obra y que la autora no participó en esa decisión”.

Las cartas permiten afirmar que existió una conversación y un cambio posterior. No permiten atribuir por sí solas la autoría de la estructura ni excluir la participación de la autora.`,
  },
] as const;

export const difficultyLevels = [
  {
    key: "basico",
    label: "Básico",
    description: "Define la evaluación y redacta retroalimentación con límites claros.",
    requirement:
      "Incluye propósito, momento, evidencia, dos criterios, un prompt con límites y formato, y retroalimentación final.",
  },
  {
    key: "intermedio",
    label: "Intermedio",
    description: "Acumula la ruta Básica y hace visible el razonamiento y el ajuste humano.",
    requirement:
      "Añade distinción entre evidencia e inferencia, dato faltante, adaptación y ajuste humano.",
  },
  {
    key: "avanzado",
    label: "Avanzado",
    description: "Acumula las rutas anteriores y contrasta evidencias, patrones, excepciones y riesgos.",
    requirement:
      "Añade contraste de una segunda evidencia, patrón o excepción, alternativa o contraejemplo, riesgo o sesgo, y ajuste de enseñanza con nueva evidencia.",
  },
] as const;

const basicPromptRequirements = [
  "Propósito de aprendizaje observable.",
  "Momento de evaluación claramente indicado.",
  "Evidencia del producto claramente identificada.",
  "Dos criterios de logro como mínimo.",
  "Prompt con límites y formato de salida explícitos.",
  "Retroalimentación final con logro, evidencia y siguiente paso.",
] as const;

const intermediatePromptRequirements = [
  ...basicPromptRequirements,
  "Separación entre evidencia disponible e inferencia.",
  "Dato faltante necesario para sostener una afirmación.",
  "Adaptación de acceso, expresión o apoyo.",
  "Ajuste humano realizado al borrador de IA.",
] as const;

const advancedPromptRequirements = [
  ...intermediatePromptRequirements,
  "Contraste con una segunda evidencia.",
  "Identificación de un patrón o una excepción.",
  "Alternativa o contraejemplo pertinente.",
  "Posible riesgo o sesgo.",
  "Ajuste de enseñanza y nueva evidencia que permitirá comprobarlo.",
] as const;

export const difficultyPromptRequirements = {
  basico: basicPromptRequirements,
  intermedio: intermediatePromptRequirements,
  avanzado: advancedPromptRequirements,
} as const;

export const difficultyContent = {
  basico: {
    description: "Retroalimenta con evidencia y un siguiente paso claro.",
    requirement: difficultyLevels[0].requirement,
    finalInstruction:
      "Ruta Básica: registra propósito, momento, evidencia, dos criterios, prompt con límites y formato, y retroalimentación final. La anonimización y decisión humana son requisitos transversales y no se cuentan en la dificultad.",
  },
  intermedio: {
    description: "Explica cómo llegaste a la valoración y ofrece apoyo.",
    requirement: `${difficultyLevels[0].requirement} ${difficultyLevels[1].requirement}`,
    finalInstruction:
      "Ruta Intermedia: completa los seis criterios de Básico y añade evidencia frente a inferencia, dato faltante, adaptación y ajuste humano.",
  },
  avanzado: {
    description: "Audita la retroalimentación y justifica la decisión docente final.",
    requirement: `${difficultyLevels[0].requirement} ${difficultyLevels[1].requirement} ${difficultyLevels[2].requirement}`,
    finalInstruction:
      "Ruta Avanzada: completa los diez criterios de Intermedio y añade segunda evidencia, patrón o excepción, alternativa o contraejemplo, riesgo o sesgo, y ajuste de enseñanza con nueva evidencia.",
  },
} as const;

const basicChecklist = [
  "El propósito de aprendizaje es observable.",
  "El momento de evaluación está claramente indicado.",
  "La evidencia del producto está claramente identificada.",
  "La valoración usa al menos dos criterios de logro.",
  "El prompt declara límites y formato de salida.",
  "La retroalimentación final incluye logro, evidencia y siguiente paso.",
] as const;

const intermediateChecklist = [
  ...basicChecklist,
  "Se distingue la evidencia disponible de la inferencia.",
  "Se identifica un dato faltante necesario para sostener una afirmación.",
  "Se registra una adaptación pertinente de acceso, expresión o apoyo.",
  "Se documenta un ajuste humano al borrador de IA.",
] as const;

const advancedChecklist = [
  ...intermediateChecklist,
  "La valoración contrasta una segunda evidencia.",
  "Se identifica un patrón o una excepción.",
  "La revisión incorpora una alternativa o un contraejemplo pertinente.",
  "Se identifica un posible riesgo o sesgo.",
  "Se propone un ajuste de enseñanza y la nueva evidencia que permitirá comprobarlo.",
] as const;

export const difficultyEvidenceChecklist = {
  basico: basicChecklist,
  intermedio: intermediateChecklist,
  avanzado: advancedChecklist,
} as const;

export const evaluationMoments = [
  { key: "diagnostica", label: "Diagnóstica", description: "Recupera el punto de partida para decidir apoyos; no anticipa por sí sola el resultado final." },
  { key: "formativa", label: "Formativa", description: "Produce información durante el proceso para orientar el siguiente paso." },
  { key: "sumativa", label: "Sumativa", description: "Valora un resultado al cierre con criterios comunicados; no sustituye la retroalimentación cuando esta es necesaria." },
] as const;

export const momentQuestions = [
  {
    text: "Antes de iniciar el tema, el grupo responde tres preguntas para decidir qué apoyo necesita.",
    answer: "diagnostica",
    feedback: "La información se obtiene al inicio para conocer el punto de partida.",
  },
  {
    text: "Durante un borrador, la persona docente señala un logro y propone el siguiente paso.",
    answer: "formativa",
    feedback: "La información se usa mientras el aprendizaje puede ajustarse.",
  },
  {
    text: "Al finalizar una unidad, se valora el producto con criterios comunicados previamente.",
    answer: "sumativa",
    feedback: "La valoración resume el logro al cierre de un periodo o unidad.",
  },
] as const;

export const reviewScenarios = [
  {
    text: "La IA afirma que el estudiante “no comprendió”, pero no cita ningún fragmento de su producto.",
    answer: "ajustar",
    feedback: "La valoración debe vincularse con evidencia observable y evitar inferir estados internos.",
  },
  {
    text: "La retroalimentación identifica una comparación correcta, cita el fragmento y pide revisar una generalización.",
    answer: "conservar",
    feedback: "Reconoce un logro y orienta una mejora con base en evidencia.",
  },
  {
    text: "El mensaje incluye siete correcciones simultáneas para una actividad de cinco minutos.",
    answer: "reducir",
    feedback: "Conviene priorizar uno o dos pasos que puedan realizarse en el tiempo disponible.",
  },
  {
    text: "La IA asigna una calificación final sin conocer la consigna, los criterios ni el contexto.",
    answer: "retirar",
    feedback: "Sin propósito, criterios y evidencia suficiente, la calificación no es defendible.",
  },
] as const;

export const caviaChecklist = [
  "C · Coherencia: propósito, criterio, evidencia y retroalimentación se corresponden.",
  "A · Acción: el siguiente paso indica qué puede hacer el estudiante.",
  "V · Viabilidad: el siguiente paso cabe en el tiempo y usa recursos disponibles.",
  "I · Inclusión: el lenguaje respeta a la persona y ofrece una vía razonable de participación o expresión.",
  "A · Ajuste docente: la persona docente conserva, corrige o retira la propuesta de la IA.",
] as const;

export const sourceLinks = [
  {
    label: "UNESCO · Marco de competencias de IA para docentes",
    url: "https://www.unesco.org/en/articles/ai-competency-framework-teachers?hub=195885",
    support: "Sustenta una integración de la IA centrada en la agencia, responsabilidad y desarrollo profesional docente.",
  },
  {
    label: "UNESCO · Guía para IA generativa en educación e investigación",
    url: "https://unesdoc.unesco.org/ark:/48223/pf0000389227",
    support: "Orienta el uso humano, seguro, inclusivo y pedagógicamente pertinente de sistemas generativos.",
  },
  {
    label: "OpenAI · Uso de ChatGPT para evaluación y retroalimentación",
    url: "https://help.openai.com/en/articles/8313397-how-can-chatgpt-be-used-for-assessment-and-feedback",
    support: "Indica que los modelos pueden apoyar borradores de retroalimentación, pero la decisión evaluativa requiere juicio humano.",
  },
  {
    label: "OpenAI Academy · Write Better Prompts for Teachers",
    url: "https://academy.openai.com/en/public/clubs/k-12-education-aacga/blogs/write-better-prompts-teachers-2026-05-28",
    support: "Documenta el uso de tarea, contexto y formato de salida para instrucciones docentes más claras.",
  },
  {
    label: "Google · Usar el chat en NotebookLM",
    url: "https://support.google.com/notebooklm/answer/16179559?hl=es",
    support: "Describe respuestas ancladas en las fuentes del cuaderno y citas que permiten volver al fragmento original.",
  },
  {
    label: "CAST · Retroalimentación orientada a la acción",
    url: "https://udlguidelines.cast.org/engagement/effort-persistence/feedback/",
    support: "Orienta comentarios específicos, oportunos, accesibles y centrados en progreso, estrategia y siguiente acción.",
  },
  {
    label: "OCDE · Evaluación formativa y retroalimentación",
    url: "https://www.oecd.org/en/publications/unlocking-high-quality-teaching_f5b82176-en.html",
    support: "Describe la evaluación formativa como un proceso de metas, diagnóstico, retroalimentación y adaptación al pensamiento del alumnado.",
  },
  {
    label: "SEP · La evaluación formativa como reto pedagógico-didáctico",
    url: "https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/07/2324_s81_La_evaluacion_formativa_reto_pedagogico_didactico.pdf",
    support: "Relaciona evidencia, error, diálogo y retroalimentación con ajustes de enseñanza y aprendizaje.",
  },
] as const;

export const additionalActivities = [
  {
    time: "3–5 minutos",
    title: "Elogio o información",
    purpose: "Distinguir una frase amable de una retroalimentación útil.",
    instruction: "Clasifica cuatro mensajes y transforma uno de ellos en logro + evidencia + siguiente paso.",
    interaction: "Clasificación y reescritura breve.",
    feedback: "Una frase accionable explica qué funcionó, con qué evidencia y qué hacer después.",
  },
  {
    time: "5–10 minutos",
    title: "Una prioridad, no siete",
    purpose: "Priorizar la retroalimentación según propósito y tiempo.",
    instruction: "Reduce una lista de siete observaciones a un logro y dos siguientes pasos.",
    interaction: "Selección, orden y justificación.",
    feedback: "La prioridad debe responder al propósito y ser realizable antes de la siguiente evidencia.",
  },
  {
    time: "10–15 minutos",
    title: "La misma evidencia, tres niveles",
    purpose: "Explorar cómo cambian criterio, apoyo y profundidad.",
    instruction: "Adapta una retroalimentación para básica, media superior y superior sin limitarte a cambiar vocabulario.",
    interaction: "Producción y contraste en parejas.",
    feedback: "La adaptación modifica el razonamiento esperado, el apoyo y la evidencia suficiente.",
  },
] as const;

export const faq = [
  ["¿Necesito completar las tres dificultades?", "No. Elige una; las demás son opciones para avanzar a tu ritmo."],
  ["¿La IA puede asignar la calificación final?", "La plataforma la usa para producir borradores. La decisión y responsabilidad de evaluación permanecen en la persona docente y en las reglas institucionales."],
  ["¿Debo copiar trabajos reales del alumnado?", "No. Usa los casos simulados o anonimiza por completo cualquier ejemplo autorizado."],
  ["¿Qué hago si ChatGPT, Gemini o NotebookLM no abren?", "Usa la respuesta de contingencia integrada y completa la revisión dentro de AULA-IA."],
  ["¿La preparación acredita?", "No. Registra avance, pero la acreditación requiere asistencia y evidencia de la sesión principal."],
] as const;

export const contingencyFeedback = `BORRADOR DE CONTINGENCIA AULA-IA

Logro observado: La respuesta identifica una diferencia entre las dos fuentes.

Evidencia: El fragmento “una persona iba a conversar y la otra no podía ir” intenta contrastar las experiencias.

Aspecto por revisar: La afirmación “toda la comunidad” no está respaldada por los testimonios.

Siguiente paso: Sustituye esa generalización por una frase limitada a lo que cada testimonio permite afirmar y agrega una pregunta sobre la información que falta.

Nota docente: Este texto es un borrador simulado. Debe revisarse con el propósito, los criterios y el contexto antes de utilizarse.`;
